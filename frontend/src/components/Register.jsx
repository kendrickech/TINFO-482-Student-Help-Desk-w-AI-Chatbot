import { useState } from "react";

function Register() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [email, setemail] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        
            const response = await fetch("http://localhost:5000/api/register", {
                method: "POST",
                headers: {
                "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password, email }),
            });
            const data = await response.json();
            setMessage(data.message || data.error);
        };

        return (
            <div>
                <h2>Register</h2>

                <form onSubmit={handleSubmit}>

                <input
                    type="email"
                    placeholder="School Email"
                    onChange={(e) => setemail(e.target.value)}
                />

                <input
                    placeholder="Username"
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="Password"
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button type="submit">Register</button>
                </form>

                <p>{message}</p>
            </div>

        );

    }
export default Register;

