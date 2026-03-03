import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      // Try to parse JSON safely (some backends return empty body on errors)
      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setMessage(data.error || data.message || "Login failed.");
        return;
      }

      setMessage(data.message || "Logged in!");

      // Tell App.jsx “login succeeded” so it can fetch /me and set user
      if (onLogin) await onLogin();

      // If App.jsx doesn't navigate, do it here as a fallback
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.log(err);
      setMessage("Network error. Is the Flask server running?");
    }
  };

  return (
    <div>
      <h2>Login</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit">Log in</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}

export default Login;
