import { useEffect, useMemo, useState } from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Chatbot from "./components/Chatbot";

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
            {user.role === "admin" ? (
                <p>You can see admin-level dashboard info.</p>
            ) : (
                <p>You can see student-level dashboard info.</p>
            )}
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


function Admin({ currentUser }) {
    const [users, setUsers] = useState([]);
    const [status, setStatus] = useState("");

    const loadUsers = async () => {
        setStatus("");
        const res = await fetch("http://localhost:5000/users", {
            credentials: "include",
        });

        if (!res.ok) {
            setStatus("Could not load users");
            return;
        }

        const data = await res.json();
        setUsers(data);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const updateRole = async (id, role) => {
        setStatus("");

        const res = await fetch(`http://localhost:5000/users/${id}/role`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ role }),
        });

        if (!res.ok) {
            setStatus("Failed to update role.");
            return;
        }

        await loadUsers();
        setStatus("Role updated.");
    };

    const removeUser = async (id) => {
        setStatus("");

        const res = await fetch(`http://localhost:5000/users/${id}`, {
            method: "DELETE",
            credentials: "include",
        });

        if (!res.ok) {
            setStatus("Failed to delete user.");
            return;
        }

        await loadUsers();
        setStatus("User deleted.");
    };

    return (
        <>
            <h1>Admin Panel</h1>
            <p>Manage users (promote to admin, demote, delete).</p>

            {status && <p>{status}</p>}

            <button onClick={loadUsers} style={{ padding: "6px 10px", marginBottom: 12 }}>
                Refresh Users
            </button>

            {users.length === 0 ? (
                <p style={{ color: "#666" }}>No users found.</p>
            ) : (
                <div style={{ display: "grid", gap: 10, maxWidth: 800 }}>
                    {users.map((u) => (
                        <div
                            key={u.id}
                            style={{
                                border: "1px solid #ddd",
                                borderRadius: 10,
                                padding: 12,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <div>
                                <strong>{u.username}</strong>
                                <div style={{ fontSize: 12, color: "#666" }}>
                                    Role: <b>{u.role}</b>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 8 }}>
                                {u.username !== currentUser.username && (
                                    <>
                                        <button
                                            onClick={() => updateRole(u.id, "admin")}
                                            disabled={u.role === "admin"}
                                            style={{ padding: "6px 10px" }}
                                        >
                                            Make Admin
                                        </button>

                                        <button
                                            onClick={() => updateRole(u.id, "student")}
                                            disabled={u.role === "student"}
                                            style={{ padding: "6px 10px" }}
                                        >
                                            Make Student
                                        </button>

                                        <button
                                            onClick={() => removeUser(u.id)}
                                            style={{ padding: "6px 10px" }}
                                        >
                                            Delete User
                                        </button>
                                    </>
                                )}

                                {u.username === currentUser.username && (
                                    <span style={{ fontSize: 12, color: "#666" }}>
                                        (This is you)
                                    </span>
                                )}
                            </div>
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

    const handleLogout = async () => {
        setUser(null);
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

    return (
        <Layout user={user} onLogout={handleLogout}>
            <Chatbot />
            <Routes>
                <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />

                <Route path="/home" element={<Home />} />

                <Route
                    path="/login"
                    element={
                        user ? <Navigate to="/dashboard" replace /> : <Login onLogin={(u) => setUser(u)} />
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
