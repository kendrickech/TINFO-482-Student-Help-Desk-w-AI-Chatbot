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
print("DEBUG: NEW ai.py LOADED")

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("OPENAI_API_KEY is not set")

client = OpenAI(api_key=api_key)

policy_path = Path(__file__).resolve().parent / "chatbot_policy.txt"

try:
    CHATBOT_POLICY = policy_path.read_text(encoding="utf-8")
except Exception:
    CHATBOT_POLICY = "You are an AI IT Help Desk Assistant."


def extract_ticket_id(text):
    match = re.search(r"\b(\d+)\b", text or "")
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

    except Exception as e:
        print("DEBUG: classify_ticket failed:", e)
        return {
            "title": (issue[:100] or "AI Help Desk Ticket").strip()[:255],
            "priority": "medium",
        }


def user_confirmed_ticket(message):
    msg = (message or "").strip().lower()

    confirmations = {
        "yes",
        "yes please",
        "yeah",
        "yep",
        "sure",
        "please do",
        "create it",
        "create ticket",
        "open ticket",
        "submit ticket",
        "ok",
        "okay",
        "go ahead",
        "do it",
    }

    return msg in confirmations


def build_ticket_created_reply(ticket_id, title, priority):
    return (
        f"Support ticket created.\n\n"
        f"Ticket Number: {ticket_id}\n"
        f"Title: {title}\n"
        f"Status: open\n"
        f"Priority: {priority}\n\n"
        f"You can track this ticket from your account."
    )


def create_ticket_for_issue(user_id, issue):
    ticket_meta = classify_ticket(issue)
    title = ticket_meta["title"]
    priority = ticket_meta["priority"]

    print("DEBUG: attempting ticket creation")
    print("DEBUG: user_id =", user_id)
    print("DEBUG: title =", title)
    print("DEBUG: priority =", priority)
    print("DEBUG: issue =", issue)

    ticket_id = create_ticket_from_ai(
        user_id,
        title,
        issue,
        priority,
    )

    print("DEBUG: create_ticket_from_ai returned =", ticket_id)

    if not ticket_id:
        return None, None, None

    return ticket_id, title, priority


@ai_bp.post("/chat")
def chat():


    try:
        print("DEBUG: /chat route hit")

        user_id = session.get("user_id")
        print("DEBUG: session user_id =", session.get("user_id"))
        
        if not user_id:
            return jsonify({
                "error": "Unauthorized. Please log in to use the chatbot."
            }), 401

        data = request.get_json(silent=True) or {}
        user_message = (data.get("message") or "").strip()
        print("DEBUG: incoming message =", user_message)

        if not user_message:
            return jsonify({"reply": "Please enter a message."}), 400

        lower_msg = user_message.lower()

        if lower_msg == "debug create ticket":
            ticket_id = create_ticket_from_ai(
                user_id,
                "Debug Ticket",
                "This is a forced debug ticket.",
                "medium",
            )

            print("DEBUG: forced ticket creation returned:", ticket_id)

            if not ticket_id:
                return jsonify({"reply": "Forced ticket creation failed."}), 500

            return jsonify({"reply": f"Forced ticket created with ID {ticket_id}"})        

        if "history" not in session:
            session["history"] = []

        #
        # RESET CHAT
        #
        if "reset chat" in lower_msg:
            session["history"] = []
            session.pop("awaiting_ticket_info", None)
            session.pop("confirm_ticket_creation", None)
            session.pop("last_issue_message", None)
            session.modified = True
            return jsonify({"reply": "Chat reset. How can I help you today?"})

        #
        # STORE USER MESSAGE + LAST ISSUE
        #
        session["history"].append({
            "role": "user",
            "content": user_message,
        })
        session["history"] = session["history"][-20:]
        session["last_issue_message"] = user_message
        session.modified = True

        #
        # USER CONFIRMED TICKET CREATION AFTER ESCALATION
        #
        if session.get("confirm_ticket_creation") and user_confirmed_ticket(user_message):
            print("DEBUG: confirm_ticket_creation branch hit")

            issue = session.get("last_issue_message_before_confirmation") or session.get("last_issue_message") or user_message

            ticket_id, title, priority = create_ticket_for_issue(user_id, issue)

            session.pop("confirm_ticket_creation", None)
            session.pop("last_issue_message_before_confirmation", None)
            session.modified = True

            if not ticket_id:
                return jsonify({
                    "reply": "I couldn't create your support ticket right now. Please try again."
                }), 500

            reply_text = build_ticket_created_reply(ticket_id, title, priority)

            session["history"].append({"role": "assistant", "content": reply_text})
            session["history"] = session["history"][-20:]
            session.modified = True

            return jsonify({"reply": reply_text})

        #
        # USER SAID NO TO TICKET CREATION
        #
        if session.get("confirm_ticket_creation") and lower_msg in {"no", "no thanks", "not now", "cancel"}:
            print("DEBUG: user declined ticket creation")

            session.pop("confirm_ticket_creation", None)
            session.pop("last_issue_message_before_confirmation", None)
            session.modified = True

            reply_text = "Okay. Let me know if you'd like help troubleshooting more or if you want me to create a ticket later."

            session["history"].append({"role": "assistant", "content": reply_text})
            session["history"] = session["history"][-20:]
            session.modified = True

            return jsonify({"reply": reply_text})

        #
        # HANDLE EXPLICIT TICKET CREATION STEP
        #
        if session.get("awaiting_ticket_info"):
            print("DEBUG: awaiting_ticket_info branch hit")

            issue = user_message.strip()

            ticket_id, title, priority = create_ticket_for_issue(user_id, issue)

            session.pop("awaiting_ticket_info", None)
            session.modified = True

            if not ticket_id:
                return jsonify({
                    "reply": "I couldn't create your ticket right now. Please try again."
                }), 500

            reply_text = build_ticket_created_reply(ticket_id, title, priority)

            session["history"].append({"role": "assistant", "content": reply_text})
            session["history"] = session["history"][-20:]
            session.modified = True

            return jsonify({"reply": reply_text})

        #
        # EXPLICIT CREATE TICKET INTENT
        #
        create_ticket_trigger = any(
            phrase in lower_msg
            for phrase in [
                "create ticket",
                "open ticket",
                "submit ticket",
                "make a ticket",
                "report issue",
                "file a ticket",
                "file ticket",
            ]
        )

        if create_ticket_trigger:
            print("DEBUG: explicit create ticket trigger hit")
            print("DEBUG: setting awaiting_ticket_info = True")

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
            print("DEBUG: latest ticket branch hit")

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
            print("DEBUG: specific ticket lookup branch hit")

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
        # DETECT USER REPORTING AN IT ISSUE
        #
        issue_keywords = [
            "not working",
            "won't work",
            "cannot",
            "can't",
            "error",
            "broken",
            "issue",
            "problem",
            "doesn't work",
            "wifi",
            "printer",
            "login",
            "email",
        ]

        if any(keyword in lower_msg for keyword in issue_keywords):

            # prevent it triggering if we already asked
            if not session.get("confirm_ticket_creation"):

                print("DEBUG: issue detected -> offering ticket creation")

                session["confirm_ticket_creation"] = True
                session["last_issue_message_before_confirmation"] = user_message
                session.modified = True

                reply_text = (
                    "It sounds like you're experiencing a technical issue.\n\n"
                    "Would you like me to create a support ticket for this problem?"
                )

                session["history"].append({"role": "assistant", "content": reply_text})
                session["history"] = session["history"][-20:]
                session.modified = True

                return jsonify({"reply": reply_text})

        #
        # FAILED TROUBLESHOOTING / ESCALATION DETECTION
        #
        failure_phrases = [
            "that didn't work",
            "that did not work",
            "still not working",
            "it didn't work",
            "it did not work",
            "still broken",
            "not fixed",
            "problem still happening",
            "issue still happening",
            "no that didn't help",
            "no that did not help",
            "didn't fix it",
            "did not fix it",
        ]

        if any(phrase in lower_msg for phrase in failure_phrases):
            print("DEBUG: escalation prompt branch hit")
            print("DEBUG: setting confirm_ticket_creation = True")

            previous_issue = None
            for msg in reversed(session["history"][:-1]):
                if msg.get("role") == "user":
                    previous_issue = msg.get("content")
                    break

            session["confirm_ticket_creation"] = True
            session["last_issue_message_before_confirmation"] = previous_issue or session.get("last_issue_message") or user_message
            session.modified = True

            reply_text = (
                "It looks like this issue may require assistance from the IT support team.\n\n"
                "Would you like me to create a support ticket for you?"
            )

            session["history"].append({"role": "assistant", "content": reply_text})
            session["history"] = session["history"][-20:]
            session.modified = True

            return jsonify({"reply": reply_text})

        #
        # AI TROUBLESHOOTING
        #
        print("DEBUG: normal AI response branch hit")

        similar_tickets = get_similar_tickets(user_message)
        ticket_context = ""

        for t in similar_tickets:
            issue_text = t.get("issue") or t.get("description") or ""
            solution_text = t.get("solution") or ""
            ticket_context += (
                f"Issue: {issue_text}\n"
                f"Related info: {solution_text}\n\n"
            )

        history_for_model = session["history"][-10:]

        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        CHATBOT_POLICY
                        + "\n\n"
                        + "Application rules:\n"
                        + "- The user is already authenticated.\n"
                        + "- Do not ask for the user's name, email, student number, or credentials.\n"
                        + "- Do not say a ticket has been created, submitted, updated, or saved unless the backend has explicitly confirmed it.\n"
                        + "- If troubleshooting fails, you may suggest creating a support ticket, but do not claim it already exists.\n"
                        + "- Only provide IT help desk support.\n"
                    ),
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

        #
        # BLOCK FAKE TICKET CREATION CLAIMS
        #
        fake_ticket_phrases = [
            "i have created a support ticket",
            "i created a support ticket",
            "your ticket has been created",
            "i submitted a ticket",
            "ticket has been submitted",
            "the it support team will contact you soon",
            "please provide your name",
            "please provide your email",
            "what is your email",
            "what is your name",
        ]

        if any(phrase in reply.lower() for phrase in fake_ticket_phrases):
            reply = (
                "I can help troubleshoot the issue, or if you'd like, I can help create a support ticket for you."
            )

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
        print("DEBUG: /chat error =", str(e))
        return jsonify({"error": str(e)}), 500