import json
import os
import re
from pathlib import Path

from flask import Blueprint, jsonify, request, session
from openai import OpenAI

from aiHelper import (
    get_similar_tickets,
    create_ticket_from_ai,
    get_latest_ticket,
    get_ticket_by_user_id_and_id,
)

ai_bp = Blueprint("ai", __name__)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

policy_path = Path(__file__).resolve().parent / "chatbot_policy.txt"

try:
    CHATBOT_POLICY = policy_path.read_text(encoding="utf-8")
except Exception:
    CHATBOT_POLICY = "You are an AI IT Help Desk Assistant."


def extract_ticket_id(text):
    match = re.search(r"\b(\d+)\b", text)
    return int(match.group(1)) if match else None


def normalize_priority(value):
    allowed = {"low", "medium", "high", "urgent"}
    value = (value or "").strip().lower()
    return value if value in allowed else "medium"


def classify_ticket(issue):
    try:
        classification = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an IT help desk ticket classifier.\n\n"
                        "Generate a short help desk ticket title and assign a priority.\n\n"
                        "Priority must be one of:\n"
                        "low\n"
                        "medium\n"
                        "high\n"
                        "urgent\n\n"
                        "Respond with valid JSON only in this format:\n"
                        '{"title":"...","priority":"..."}'
                    ),
                },
                {
                    "role": "user",
                    "content": issue,
                },
            ],
        )

        raw = (classification.choices[0].message.content or "").strip()
        data = json.loads(raw)

        title = (data.get("title") or issue[:100]).strip()
        priority = normalize_priority(data.get("priority"))

        if not title:
            title = "AI Help Desk Ticket"

        return {
            "title": title[:255],
            "priority": priority,
        }

    except Exception:
        return {
            "title": (issue[:100] or "AI Help Desk Ticket").strip()[:255],
            "priority": "medium",
        }


@ai_bp.post("/chat")
def chat():
    try:
        user_id = session.get("user_id")

        if not user_id:
            return jsonify({
                "error": "Unauthorized. Please log in to use the chatbot."
            }), 401

        data = request.get_json(silent=True) or {}
        user_message = (data.get("message") or "").strip()

        if not user_message:
            return jsonify({"reply": "Please enter a message."}), 400

        lower_msg = user_message.lower()

        if "history" not in session:
            session["history"] = []

        #
        # HANDLE TICKET CREATION STEP FIRST
        #
        if session.get("awaiting_ticket_info"):
            issue = user_message.strip()

            ticket_meta = classify_ticket(issue)
            title = ticket_meta["title"]
            priority = ticket_meta["priority"]

            ticket_id = create_ticket_from_ai(
                user_id,
                title,
                issue,
                priority,
            )

            session.pop("awaiting_ticket_info", None)

            if not ticket_id:
                return jsonify({
                    "reply": "I couldn't create your ticket right now. Please try again."
                }), 500

            reply_text = (
                f"Support ticket created.\n\n"
                f"Ticket Number: {ticket_id}\n"
                f"Title: {title}\n"
                f"Status: open\n"
                f"Priority: {priority}\n\n"
                f"You can track this ticket from your account."
            )

            session["history"].append({"role": "user", "content": user_message})
            session["history"].append({"role": "assistant", "content": reply_text})
            session["history"] = session["history"][-20:]
            session.modified = True

            return jsonify({"reply": reply_text})

        #
        # STORE USER MESSAGE
        #
        session["history"].append({
            "role": "user",
            "content": user_message,
        })
        session["history"] = session["history"][-20:]
        session.modified = True

        #
        # RESET CHAT
        #
        if "reset chat" in lower_msg:
            session["history"] = []
            session.pop("awaiting_ticket_info", None)
            session.modified = True
            return jsonify({"reply": "Chat reset. How can I help you today?"})

        #
        # CREATE TICKET INTENT
        #
        create_ticket_trigger = any(
            phrase in lower_msg
            for phrase in [
                "create ticket",
                "open ticket",
                "submit ticket",
                "make a ticket",
                "report issue",
            ]
        )

        if create_ticket_trigger:
            session["awaiting_ticket_info"] = True
            session.modified = True

            reply_text = (
                "I can create a support ticket for you.\n\n"
                "Please describe the issue."
            )

            session["history"].append({"role": "assistant", "content": reply_text})
            session["history"] = session["history"][-20:]
            session.modified = True

            return jsonify({"reply": reply_text})

        #
        # CHECK LATEST TICKET
        #
        latest_ticket_trigger = any(
            phrase in lower_msg
            for phrase in [
                "my latest ticket",
                "my recent ticket",
                "latest ticket status",
                "recent ticket status",
            ]
        )

        if latest_ticket_trigger:
            ticket = get_latest_ticket(user_id)

            if not ticket:
                reply_text = "I couldn't find any tickets under your account."
            else:
                reply_text = (
                    f"Latest Ticket Found\n\n"
                    f"Ticket Number: {ticket['id']}\n"
                    f"Title: {ticket['title']}\n"
                    f"Description: {ticket['description']}\n"
                    f"Status: {ticket['status']}\n"
                    f"Priority: {ticket['priority']}"
                )

            session["history"].append({"role": "assistant", "content": reply_text})
            session["history"] = session["history"][-20:]
            session.modified = True

            return jsonify({"reply": reply_text})

        #
        # CHECK SPECIFIC TICKET STATUS
        #
        ticket_id = extract_ticket_id(user_message)

        wants_status = (
            "status" in lower_msg
            or "check ticket" in lower_msg
            or "ticket status" in lower_msg
            or ticket_id is not None
        )

        if wants_status and ticket_id is not None:
            ticket = get_ticket_by_user_id_and_id(user_id, ticket_id)

            if ticket:
                reply_text = (
                    f"Ticket Found\n\n"
                    f"Ticket Number: {ticket['id']}\n"
                    f"Title: {ticket['title']}\n"
                    f"Description: {ticket['description']}\n"
                    f"Status: {ticket['status']}\n"
                    f"Priority: {ticket['priority']}"
                )
            else:
                reply_text = f"I couldn't find ticket #{ticket_id} under your account."

            session["history"].append({"role": "assistant", "content": reply_text})
            session["history"] = session["history"][-20:]
            session.modified = True

            return jsonify({"reply": reply_text})

        if wants_status and ticket_id is None:
            reply_text = "Please provide the ticket number you want me to check."

            session["history"].append({"role": "assistant", "content": reply_text})
            session["history"] = session["history"][-20:]
            session.modified = True

            return jsonify({"reply": reply_text})

        #
        # AI TROUBLESHOOTING
        #
        similar_tickets = get_similar_tickets(user_message)
        ticket_context = ""

        for t in similar_tickets:
            ticket_context += (
                f"Issue: {t['issue']}\n"
                f"Related info: {t['solution']}\n\n"
            )

        history_for_model = session["history"][-10:]

        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": CHATBOT_POLICY,
                },
                {
                    "role": "system",
                    "content": (
                        "Relevant previous tickets:\n" + ticket_context
                        if ticket_context
                        else "No relevant previous ticket context."
                    ),
                },
                *history_for_model,
            ],
        )

        reply = (response.choices[0].message.content or "").strip()

        if not reply:
            reply = "I'm sorry, I couldn't generate a response right now."

        session["history"].append({
            "role": "assistant",
            "content": reply,
        })
        session["history"] = session["history"][-20:]
        session.modified = True

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"error": str(e)}), 500