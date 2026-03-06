import { useState } from "react";

const API_BASE = "http://localhost:5000";

function Register() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password, email }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                setMessage(data.error || "Registration failed.");
                return;
            }

            setMessage(data.message || "Account created! Redirecting to login...");

            setTimeout(() => {
                window.location.href = "/login";
            }, 1200);

        } catch {
            setMessage("Network error. Is the Flask server running?");
        }
    };

    return (
        <div className="page">
            <div
                className="card"
                style={{
                    maxWidth: 450,
                    margin: "80px auto",
                    padding: 30,
                }}
            >
                <h2 className="page-title" style={{ marginBottom: 16 }}>
                    Create Help Desk Account
                </h2>

                <form
                    onSubmit={handleSubmit}
                    style={{ display: "grid", gap: 14 }}
                >
                    <div>
                        <label style={{ fontSize: 14 }}>School Email</label>
                        <input
                            className="input"
                            type="email"
                            placeholder="you@uw.edu"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: 14 }}>Username</label>
                        <input
                            className="input"
                            placeholder="Choose a username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: 14 }}>Password</label>
                        <input
                            className="input"
                            type="password"
                            placeholder="Create a password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="primary-btn">
                        Register
                    </button>
                </form>

                {message && (
                    <p style={{ marginTop: 14, color: message.includes("error") ? "crimson" : "green" }}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}

export default Register;