import { useState } from "react";

export default function Chatbot() {

    const [message, setMessage] = useState("");

    const [isOpen, setIsOpen] = useState(false);

    const [isMinimized, setIsMinimized] = useState(false);

    const [isListening, setIsListening] = useState(false);

    const [messages, setMessages] = useState([
        {
            sender: "bot",
            text:
`Hello! I'm IT Help Desk Assistant at UWT.

How can I help you today?`
        }
    ]);


//////////////////////////////////////////////////
// SEND MESSAGE
//////////////////////////////////////////////////

    const sendMessage = async () => {

        if (!message.trim()) return;

        const userMessage = message;

        setMessages(prev => [
            ...prev,
            { sender: "user", text: userMessage }
        ]);

        setMessage("");

      const response = await fetch("http://127.0.0.1:5000/chat", {
            method: "POST",
            credentials: "include", // IMPORTANT for Flask session cookie
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: userMessage }),
        });

        const data = await response.json();

        const botReply =
            data.reply ||
            data.error ||
            "Unknown error";


        setMessages(prev => [
            ...prev,
            {
                sender: "bot",
                text: botReply
            }
        ]);

    };


//////////////////////////////////////////////////
// ENTER KEY SEND
//////////////////////////////////////////////////

    const handleEnter = (e) => {

        if (e.key === "Enter") {

            sendMessage();

        }

    };


//////////////////////////////////////////////////
// VOICE INPUT (MIC)
//////////////////////////////////////////////////

const startListening = () => {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        alert("Speech recognition not supported");

        return;

    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";

    recognition.start();

    setIsListening(true);

    recognition.onresult = (event) => {

        const text =
        event.results[0][0].transcript;

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
// VOICE OUTPUT (AI SPEAKS)
//////////////////////////////////////////////////

const speakText = (text) => {

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-US";

    window.speechSynthesis.speak(speech);

};



//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

return (

  <>
  {/* CHAT BUBBLE */}

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
      boxShadow: "0px 4px 12px rgba(0,0,0,0.3)"
    }}
  >

    💬 Chat with us!

  </div>

)}

    {/* CHAT WINDOW */}

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
          overflow: "hidden"
        }}
      >


        {/* HEADER */}

        <div
          style={{
            background: "#5b3a96",
            color: "white",
            padding: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >

          <div>IT HelpDesk AI</div>

          <div style={{ display: "flex", gap: 10 }}>

            <span
              style={{ cursor: "pointer" }}
              onClick={() => setIsMinimized(!isMinimized)}
            >
              _
            </span>

            <span
              style={{ cursor: "pointer" }}
              onClick={() => setIsOpen(false)}
            >
              X
            </span>

          </div>

        </div>



        {/* BODY */}

        {!isMinimized && (

          <>

            <div
              style={{
                flex: 1,
                padding: 10,
                overflowY: "auto",
                background: "#f5f5f5"
              }}
            >

              {messages.map((msg, index) => (

                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent:
                      msg.sender === "user"
                        ? "flex-end"
                        : "flex-start",
                    marginBottom: 10
                  }}
                >

                  <div
                    style={{
                      background:
                        msg.sender === "user"
                          ? "#5b3a96"
                          : "#e0e0e0",

                      color:
                        msg.sender === "user"
                          ? "white"
                          : "black",

                      padding: "8px 12px",
                      borderRadius: 15,
                      maxWidth: "70%",
                    }}
                  >
                    <div style={{ whiteSpace: "pre-line" }}>
                      {msg.text}
                    </div>

                    {msg.sender === "bot" && (

                      <div style={{ marginTop: 5 }}>

                        <button
                          onClick={() =>
                            speakText(msg.text)
                          }
                          style={{
                            fontSize: 12,
                            border: "none",
                            background: "#ddd",
                            padding: "3px 6px",
                            cursor: "pointer",
                            borderRadius: 5
                          }}
                        >
                          🔊 Listen
                        </button>

                      </div>

                    )}

                  </div>

                </div>

              ))}

            </div>



            {/* INPUT AREA */}

            <div
              style={{
                display: "flex",
                borderTop: "1px solid #ccc",
                alignItems: "center"
              }}
            >

              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleEnter}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: 10,
                  border: "none",
                  outline: "none"
                }}
              />


              {/* MIC */}

              <button
                onClick={startListening}
                style={{
                  background: isListening
                    ? "red"
                    : "#eee",
                  border: "none",
                  padding: "10px",
                  cursor: "pointer",
                  fontSize: 18
                }}
              >
                🎤
              </button>


              {/* SEND */}

              <button
                onClick={sendMessage}
                style={{
                  background: "#5b3a96",
                  color: "white",
                  border: "none",
                  padding: "10px 15px",
                  cursor: "pointer"
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