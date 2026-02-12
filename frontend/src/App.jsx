import { useEffect, useMemo, useState, useCallback } from "react";
import { NavLink, Routes, Route, Navigate, useNavigate } from "react-router-dom";

import Login from "./components/Login";
import Register from "./components/Register";
import Admin from "./components/Admin";

function NavItem({ to, children }) {
    return (
        <NavLink
            to={to}
            style={({ isActive }) => ({
                textDecoration: "none",
                color: "black",
                padding: "8px 10px",
                borderRadius: 10,
                background: isActive ? "lightgray" : "transparent",
            })}
        >
            {children}
        </NavLink>
    );
}

function Layout({ user, onLogout, children }) {
    return (
        <div style={{ fontFamily: "Arial" }}>
            <nav
                style={{
                    padding: 16,
                    borderBottom: "1px solid #ddd",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                }}
            >
                <strong style={{ marginRight: 8 }}>Help Desk</strong>

                {!user && (
                    <>
                        <NavItem to="/login">Login</NavItem>
                        <NavItem to="/register">Register</NavItem>
                    </>
                )}

                {user && (
                    <>
                        <NavItem to="/dashboard">Dashboard</NavItem>
                        <NavItem to="/tickets">Tickets</NavItem>

                        {user.role === "admin" && <NavItem to="/admin">Admin</NavItem>}

                        <span style={{ marginLeft: "auto" }}>
                            {user.username} ({user.role})
                        </span>
                        <button onClick={onLogout} style={{ padding: "6px 10px" }}>
                            Log out
                        </button>
                    </>
                )}
            </nav>

            <main style={{ padding: 24 }}>{children}</main>
        </div>
    );
}

function Home() {
    return (
        <div style={{ textAlign: "center", marginTop: 80 }}>
            <h1>Campus IT Help Desk</h1>
            <p style={{ color: "#555", marginTop: 10 }}>
                Submit and manage IT support requests
            </p>

            <div
                style={{
                    marginTop: 30,
                    display: "flex",
                    gap: 12,
                    justifyContent: "center",
                }}
            >
                <NavLink to="/login">Login</NavLink>

                <NavLink
                    to="/register"
                    style={{
                        background: "white",
                        color: "black",
                        border: "1px solid #ccc",
                    }}
                >
                    Register
                </NavLink>
            </div>
        </div>
    );
}

function Dashboard({ user }) {
    return (
        <>
            <h1>Dashboard</h1>
            <p>Welcome {user.username}!</p>
            <p>Role: {user.role}</p>
            {/*
            {user.role === "admin" ? (
                <p>You can see admin-level dashboard info.</p>
            ) : (
                <p>You can see student-level dashboard info.</p>
            )}*/}
        </>
    );
}

function Tickets({ user, tickets, onCreateTicket, onDeleteTicket }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("low");
    const [message, setMessage] = useState("");

    const visibleTickets = useMemo(() => {
        if (!user) return [];
        if (user.role === "admin") return tickets;
        return tickets.filter((t) => t.createdBy === user.username);
    }, [tickets, user]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setMessage("");

        if (!title.trim() || !description.trim()) {
            setMessage("Please enter a title and description.");
            return;
        }

        onCreateTicket({
            title: title.trim(),
            description: description.trim(),
            priority,
            createdBy: user.username,
        });

        setTitle("");
        setDescription("");
        setPriority("low");
        setMessage("Ticket submitted!");
    };

    return (
        <>
            <h1>Tickets</h1>

            {user.role !== "admin" && (
                <div style={{ maxWidth: 600, marginBottom: 24 }}>
                    <h3>Submit a Ticket</h3>

                    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "grid", gap: 6 }}>
                            <label>Title</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Wi-Fi not working"
                                style={{ padding: 10 }}
                            />
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                            <label>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the issue and any steps you already tried..."
                                rows={4}
                                style={{ padding: 10, resize: "vertical" }}
                            />
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                            <label>Priority</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                style={{ padding: 10 }}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>

                        <button type="submit" style={{ padding: "10px 12px" }}>
                            Submit Ticket
                        </button>

                        {message && <p>{message}</p>}
                    </form>
                </div>
            )}

            <h3>{user.role === "admin" ? "All Tickets" : "My Tickets"}</h3>

            {visibleTickets.length === 0 ? (
                <p style={{ color: "#666" }}>No tickets yet.</p>
            ) : (
                <div style={{ display: "grid", gap: 10, maxWidth: 800 }}>
                    {visibleTickets
                        .slice()
                        .reverse()
                        .map((t) => (
                            <div
                                key={t.id}
                                style={{
                                    border: "1px solid #ddd",
                                    borderRadius: 10,
                                    padding: 12,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 12,
                                        alignItems: "center",
                                    }}
                                >
                                    <strong>{t.title}</strong>

                                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                        <span
                                            style={{
                                                border: "1px solid #ccc",
                                                padding: "2px 8px",
                                                borderRadius: 999,
                                                fontSize: 12,
                                            }}
                                        >
                                            {t.priority.toUpperCase()}
                                        </span>

                                        {user.role === "admin" && (
                                            <button
                                                onClick={() => onDeleteTicket(t.id)}
                                                style={{ padding: "6px 10px" }}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <p style={{ marginTop: 8, marginBottom: 8 }}>{t.description}</p>

                                <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                                    Submitted by: {t.createdBy}
                                    {" • "}
                                    {new Date(t.createdAt).toLocaleString()}
                                </p>
                            </div>
                        ))}
                </div>
            )}
        </>
    );
}


function ProtectedRoute({ user, children }) {
    if (!user) return <Navigate to="/login" replace />;
    return children;
}


function AdminRoute({ user, children }) {
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
    return children;
}


export default function App() {
    const [user, setUser] = useState(null);
    const [checking, setChecking] = useState(true);
    const navigate = useNavigate();


    const handleLoginSuccess = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:5000/me", {
                credentials: "include",
            });

            // If not logged in / session missing
            if (!res.ok) {
                setUser(null);
                return null;
            }

            // Parse JSON safely
            let data = null;
            try {
                data = await res.json();
            } catch {
                setUser(null);
                return null;
            }

            if (data?.authenticated) {
                const nextUser = {
                    username: data.username ?? "user",
                    role: data.user_role,
                };
                setUser(nextUser);
                return nextUser;
            }

            setUser(null);
            return null;
        } catch {
            setUser(null);
            return null;
        }
    });


    // Check session cookie on load
    useEffect(() => {
        (async () => {
            setChecking(true);
            await handleLoginSuccess(); // hydrates user if cookie exists
            setChecking(false);
        })();
    }, []);


    const handleLogout = async () => {
        try {
            await fetch("http://localhost:5000/logout", {
                method: "POST",
                credentials: "include",
            });
        } catch {
            // ignore
        } finally {
            setUser(null);
            navigate("/login", { replace: true });
        }
    };


    const [tickets, setTickets] = useState([]);


    const createTicket = (ticket) => {
        setTickets((prev) => [
            ...prev,
            {
                ...ticket,
                id: crypto.randomUUID(),
                createdAt: Date.now(),
            },
        ]);
    };

    const deleteTicket = (ticketId) => {
        setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    };

    if (checking) return <div style={{ padding: 24 }}>Loading...</div>;

    return (
        <Layout user={user} onLogout={handleLogout}>
            <Routes>
                <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />

                <Route path="/home" element={<Home />} />

                <Route
                    path="/login"
                    element={
                        user ? (
                            <Navigate to="/dashboard" replace />
                        ) : (
                            <Login onLogin={handleLoginSuccess} />
                        )
                    }
                />

                <Route
                    path="/register"
                    element={user ? <Navigate to="/dashboard" replace /> : <Register />}
                />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute user={user}>
                            <Dashboard user={user} />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/tickets"
                    element={
                        <ProtectedRoute user={user}>
                            <Tickets
                                user={user}
                                tickets={tickets}
                                onCreateTicket={createTicket}
                                onDeleteTicket={deleteTicket}
                            />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin"
                    element={
                        <AdminRoute user={user}>
                            <Admin currentUser={user} />
                        </AdminRoute>
                    }
                />

                <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
            </Routes>
        </Layout>
    );
}
