import os
import re

from flask import Flask, jsonify, request, session
from flask_cors import CORS
from auth import auth_bp
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI

from aiHelper import (
    get_similar_tickets,
    create_guest_ticket,
    get_ticket_by_name_and_id
)

# -------------------------
# ENVIRONMENT
# -------------------------

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

policy_path = Path(__file__).resolve().parent / "chatbot_policy.txt"

try:
    CHATBOT_POLICY = policy_path.read_text(encoding="utf-8")
except Exception:
    CHATBOT_POLICY = "You are an AI IT Help Desk Assistant."


# -------------------------
# APP SETUP
# -------------------------

app = Flask(__name__)

app.secret_key = os.getenv("FLASK_SECRET_KEY")

CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:3000",
        "http://localhost:5173"
    ]
)

app.register_blueprint(auth_bp)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# -------------------------
# HEALTH CHECK
# -------------------------

@app.get("/health")
def health():
    return jsonify({"status": "ok"})


# -------------------------
# CHAT ENDPOINT
# -------------------------

@app.post("/chat")
def chat():

    try:

        data = request.get_json() or {}

        user_message = (data.get("message") or "").strip()

        lower_msg = user_message.lower()


        #############################################
        # CONVERSATION MEMORY
        #############################################

        if "history" not in session:
            session["history"] = []

        session["history"].append({
            "role": "user",
            "content": user_message
        })


        #############################################
        # CREATE TICKET FLOW
        #############################################

        # Step 1 → User asks to create ticket

        if ( "create" in lower_msg and "ticket" in lower_msg
        ) or "yes" == lower_msg:

            session["awaiting_ticket_info"] = True

            return jsonify({
                "reply":
                """I can create a support ticket.
            Please provide me with your:

            • Name
            • Contact Information (email or phone)
            • Issue

            Example:

            John Doe, johnDoe@email.com, Laptop not turning on
            """
            })


        # Step 2 → User provides ticket info

        if session.get("awaiting_ticket_info"):

            parts = user_message.split(",")

            if len(parts) < 3:

                return jsonify({
                    "reply":
                    """Missing information.
                    Please use this format:

                    Name: 

                    Contact: 

                    Issue:
                    """ 
                })

            name = parts[0].strip()
            contact = parts[1].strip()
            issue = ",".join(parts[2:]).strip()


            ticket_id = create_guest_ticket(
                name,
                contact,
                issue
            )


            session.pop("awaiting_ticket_info", None)


            reply_text = f"""Support Ticket Created

            Name: {name}

            Ticket Number: {ticket_id}

            Issue: {issue}
            
            Status: New

            Save your ticket number to check status later. 
            """

            session["history"].append({
                "role": "assistant",
                "content": reply_text
            })


            return jsonify({
                "reply": reply_text
            })


        #############################################
        # CHECK TICKET STATUS
        #############################################

        def extract_ticket_id(text):

            m = re.search(r"\b(\d+)\b", text)

            if m:
                return int(m.group(1))

            return None


        def extract_username(text):

            m = re.search(
                r"(?:my name is|name is|name:)\s*([a-zA-Z0-9_]+)",
                text,
                re.IGNORECASE
            )

            if m:
                return m.group(1)


            tokens = re.findall(r"[a-zA-Z0-9_]+", text)

            ignore = {
                "check",
                "ticket",
                "status",
                "my",
                "please",
                "number",
                "id",
                "is",
                "the",
                "and",
                "name"
            }

            for t in tokens:

                if t.lower() not in ignore and not t.isdigit():
                    return t

            return None


        ticket_id = extract_ticket_id(user_message)

        username = extract_username(user_message)


        wants_status = (
            "status" in lower_msg
            or (ticket_id and username)
        )


        if wants_status:

            if not ticket_id or not username:

                return jsonify({ 
                    "reply":
                    """I can check your ticket status.

                    Provide me with your username and ticket number.

                    Example:
                    johnDoe, 22
                """
                })


            ticket = get_ticket_by_name_and_id(
                username,
                ticket_id
            )


            if ticket:

                reply_text = f"""Ticket Found
                Name: {username}
                
                Ticket Number: {ticket['id']}
                
                Issue:
                {ticket['description']}
                
                Status: 
                {ticket['status']}
                """

            else:

                reply_text = f"""No ticket was found with number {ticket_id} under the username {username}. Please double-check the information and try again."""

            session["history"].append({
                "role": "assistant",
                "content": reply_text
            })


            return jsonify({
                "reply": reply_text
            })


        #############################################
        # AI TROUBLESHOOTING
        #############################################

        similar_tickets = get_similar_tickets(user_message)

        ticket_context = ""

        for t in similar_tickets:

            ticket_context += f"""
            Issue: {t['issue']}
            Solution: {t['solution']}
            """


        response = client.chat.completions.create(

            model="gpt-4.1-mini",

            messages=[

                {
                    "role": "system",
                    "content": CHATBOT_POLICY
                },

                {
                    "role": "system",
                    "content":
                    "Previous tickets:\n" + ticket_context
                }

            ] + session["history"]

        )


        reply = response.choices[0].message.content.strip()


        session["history"].append({
            "role": "assistant",
            "content": reply
        })


        return jsonify({
            "reply": reply
        })


    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500



if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)