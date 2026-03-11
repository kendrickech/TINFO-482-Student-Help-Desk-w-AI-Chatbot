import { useEffect, useRef, useState } from "react";

const API_BASE = "http://localhost:5000";

const STARTER_MESSAGES = [
  {
    sender: "bot",
    text: `Hello! I'm the IT Help Desk Assistant at UWT.

How can I help you today?`,
  },
];

export default function Chatbot() {
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("chatbotMessages");
      return saved ? JSON.parse(saved) : STARTER_MESSAGES;
    } catch {
      return STARTER_MESSAGES;
    }
  });

  const messagesEndRef = useRef(null);

  //////////////////////////////////////////////////
  // SAVE CHAT TO LOCAL STORAGE
  //////////////////////////////////////////////////

  useEffect(() => {
    localStorage.setItem("chatbotMessages", JSON.stringify(messages));
  }, [messages]);

  //////////////////////////////////////////////////
  // AUTO SCROLL
  //////////////////////////////////////////////////

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, isMinimized]);

  //////////////////////////////////////////////////
  // SEND MESSAGE
  //////////////////////////////////////////////////

  const sendMessage = async () => {
    if (!message.trim() || isSending) return;

    const userMessage = message.trim();

    setMessages((prev) => [...prev, { sender: "user", text: userMessage }]);

    setMessage("");
    setIsSending(true);

    try {
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "You must be logged in to use the chatbot.",
          },
        ]);
        return;
      }

      const botReply = data.reply || data.error || "Something went wrong.";

      setMessages((prev) => [...prev, { sender: "bot", text: botReply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Unable to reach the server right now.",
        },
      ]);

      console.error("Chatbot request failed:", error);
    } finally {
      setIsSending(false);
    }
  };

  //////////////////////////////////////////////////
  // ENTER KEY SEND
  //////////////////////////////////////////////////

  const handleEnter = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  //////////////////////////////////////////////////
  // VOICE INPUT
  //////////////////////////////////////////////////

  const startListening = () => {
    if (isListening) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.start();

    setIsListening(true);

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setMessage(text);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  //////////////////////////////////////////////////
  // VOICE OUTPUT
  //////////////////////////////////////////////////

  const speakText = (text) => {
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US";

    window.speechSynthesis.speak(speech);
  };

  //////////////////////////////////////////////////
  // CLEAR CHAT
  //////////////////////////////////////////////////

  const clearChat = () => {
    setMessages(STARTER_MESSAGES);
    localStorage.setItem("chatbotMessages", JSON.stringify(STARTER_MESSAGES));
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////

  return (
    <>
      {!isOpen && (
        <div
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: 25,
            right: 25,
            background: "#5b3a96",
            color: "white",
            borderRadius: "40px",
            padding: "14px 22px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            fontSize: 18,
            boxShadow: "0px 4px 12px rgba(0,0,0,0.3)",
            zIndex: 1000,
          }}
        >
          💬 Chat with us!
        </div>
      )}

      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            width: 350,
            height: isMinimized ? 60 : 500,
            background: "white",
            borderRadius: 10,
            boxShadow: "0px 5px 20px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#5b3a96",
              color: "white",
              padding: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>IT HelpDesk AI</div>

            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ cursor: "pointer" }} onClick={clearChat}>
                ⟳
              </span>

              <span
                style={{ cursor: "pointer" }}
                onClick={() => setIsMinimized(!isMinimized)}
              >
                _
              </span>

              <span
                style={{ cursor: "pointer" }}
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setIsOpen(false);
                }}
              >
                ✕
              </span>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div
                style={{
                  flex: 1,
                  padding: 10,
                  overflowY: "auto",
                  background: "#f5f5f5",
                }}
              >
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      justifyContent:
                        msg.sender === "user" ? "flex-end" : "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        background:
                          msg.sender === "user" ? "#5b3a96" : "#e0e0e0",
                        color: msg.sender === "user" ? "white" : "black",
                        padding: "8px 12px",
                        borderRadius: 15,
                        maxWidth: "70%",
                      }}
                    >
                      <div style={{ whiteSpace: "pre-line" }}>{msg.text}</div>

                      {msg.sender === "bot" && (
                        <div style={{ marginTop: 5 }}>
                          <button
                            onClick={() => speakText(msg.text)}
                            style={{
                              fontSize: 12,
                              border: "none",
                              background: "#ddd",
                              padding: "3px 6px",
                              cursor: "pointer",
                              borderRadius: 5,
                            }}
                          >
                            🔊 Listen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div style={{ color: "#666", fontSize: 14 }}>
                    AI is typing...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div
                style={{
                  display: "flex",
                  borderTop: "1px solid #ccc",
                  alignItems: "center",
                }}
              >
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleEnter}
                  placeholder="Type a message..."
                  disabled={isSending}
                  style={{
                    flex: 1,
                    padding: 10,
                    border: "none",
                    outline: "none",
                  }}
                />

                <button
                  onClick={startListening}
                  disabled={isSending || isListening}
                  style={{
                    background: isListening ? "red" : "#eee",
                    border: "none",
                    padding: "10px",
                    cursor: "pointer",
                    fontSize: 18,
                  }}
                >
                  🎤
                </button>

                <button
                  onClick={sendMessage}
                  disabled={isSending}
                  style={{
                    background: "#5b3a96",
                    color: "white",
                    border: "none",
                    padding: "10px 15px",
                    cursor: "pointer",
                    opacity: isSending ? 0.7 : 1,
                  }}
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}