import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:5000";

function Login({ onLogin }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password }),
            });

            let data = {};
            try {
                data = await response.json();
            } catch { }

            if (!response.ok) {
                setMessage(data.error || data.message || "Login failed.");
                return;
            }

            if (onLogin) await onLogin();

            navigate("/dashboard", { replace: true });
        } catch {
            setMessage("Network error. Is the Flask server running?");
        }
    };

    return (
        <div className="page">
            <div
                className="card"
                style={{
                    maxWidth: 420,
                    margin: "80px auto",
                    padding: 30,
                }}
            >
                <h2 className="page-title" style={{ marginBottom: 16 }}>
                    Help Desk Login
                </h2>

                <form
                    onSubmit={handleSubmit}
                    style={{ display: "grid", gap: 14 }}
                >
                    <div>
                        <label style={{ fontSize: 14 }}>Username</label>
                        <input
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: 14 }}>Password</label>
                        <input
                            className="input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    <button type="submit" className="primary-btn">
                        Log in
                    </button>
                </form>

                {message && (
                    <p style={{ marginTop: 12, color: "crimson" }}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}

export default Login;