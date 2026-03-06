import { useEffect, useState, useCallback } from "react";

const API_BASE = "http://localhost:5000";

export default function Admin({ currentUser }) {
    const [users, setUsers] = useState([]);
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);

    const ROLE_OPTIONS = ["student", "technician", "admin"];

    const loadUsers = useCallback(async () => {
        setStatus("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/users`, {
                credentials: "include",
            });

            if (!res.ok) {
                const text = await res.text();
                setStatus(`Could not load users (${res.status}): ${text}`);
                setUsers([]);
                return;
            }

            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            setStatus(`Could not load users: ${err?.message || "Network error"}`);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const updateRole = async (user_id, role) => {
        setStatus("");

        try {
            const res = await fetch(`${API_BASE}/users/${user_id}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ role }),
            });

            if (!res.ok) {
                const text = await res.text();
                setStatus(`Failed to update role (${res.status}): ${text}`);
                return;
            }

            await loadUsers();
            setStatus("Role updated.");
        } catch (err) {
            setStatus(`Failed to update role: ${err?.message || "Network/CORS error"}`);
        }
    };

    const removeUser = async (user_id) => {
        setStatus("");

        try {
            const res = await fetch(`${API_BASE}/users/${user_id}`, {
                method: "DELETE",
                credentials: "include",
            });

            if (!res.ok) {
                const text = await res.text();
                setStatus(`Failed to delete user (${res.status}): ${text}`);
                return;
            }

            await loadUsers();
            setStatus("User deleted.");
        } catch (err) {
            setStatus(`Failed to delete user: ${err?.message || "Network/CORS error"}`);
        }
    };

    if (!currentUser) {
        return (
            <div className="card">
                <h1 className="page-title">Admin Panel</h1>
                <p>Loading current user...</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
            <div className="card" style={{ marginBottom: 18 }}>
                <h1 className="page-title" style={{ marginTop: 0, marginBottom: 8 }}>
                    Admin Panel
                </h1>
                <p style={{ color: "var(--uw-muted)", marginTop: 0 }}>
                    Manage users, update roles, and remove accounts.
                </p>

                {status && (
                    <p style={{ color: status.toLowerCase().includes("failed") || status.toLowerCase().includes("could not") ? "crimson" : "green" }}>
                        {status}
                    </p>
                )}

                <button onClick={loadUsers} disabled={loading} className="secondary-btn">
                    {loading ? "Refreshing..." : "Refresh Users"}
                </button>
            </div>

            {users.length === 0 ? (
                <div className="card">
                    <p style={{ color: "var(--uw-muted)", margin: 0 }}>
                        {loading ? "Loading users..." : "No users found."}
                    </p>
                </div>
            ) : (
                <div className="ticket-grid">
                    {users.map((u) => {
                        const isMe = u.username === currentUser.username;

                        return (
                            <div
                                key={u.id}
                                className="card"
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 14,
                                    flexWrap: "wrap",
                                }}
                            >
                                <div>
                                    <strong style={{ fontSize: 18, color: "var(--uw-purple)" }}>{u.username}</strong>
                                    <div className="ticket-meta" style={{ marginTop: 6 }}>
                                        Role: <b>{u.role}</b>
                                    </div>
                                    {u.email && (
                                        <div className="ticket-meta">Email: {u.email}</div>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                    {isMe ? (
                                        <span className="badge">(This is you)</span>
                                    ) : (
                                        <>
                                            <select
                                                className="select"
                                                value={u.role}
                                                onChange={(e) => updateRole(u.id, e.target.value)}
                                                style={{ minWidth: 150 }}
                                            >
                                                {ROLE_OPTIONS.map((r) => (
                                                    <option key={r} value={r}>
                                                        {r}
                                                    </option>
                                                ))}
                                            </select>

                                            <button
                                                onClick={() => removeUser(u.id)}
                                                className="secondary-btn"
                                            >
                                                Delete User
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}