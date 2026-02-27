import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

function Tickets({
    user,
    tickets,
    onCreateTicket,
    onDeleteTicket,
    onUpdateTicket,
    canManage = false,
    canDelete = false,
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("low");

    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const visibleTickets = useMemo(() => {
        if (!user) return [];
        if (canManage) return tickets;
        return tickets.filter((t) => t.createdBy === user.username);
    }, [tickets, user, canManage]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        if (!title.trim() || !description.trim()) {
            setMessage("Please enter a title and description.");
            return;
        }

        try {
            setSubmitting(true);

            await onCreateTicket({
                title: title.trim(),
                description: description.trim(),
                priority,
            });

            setTitle("");
            setDescription("");
            setPriority("low");
            setMessage("Ticket submitted!");
        } catch (err) {
            setMessage(err?.message || "Failed to submit ticket.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return <p>Please log in to view tickets.</p>;

    return (
        <>
            <h1>Tickets</h1>

            {!canManage && (
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
                                disabled={submitting}
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
                                disabled={submitting}
                            />
                        </div>

                        <div style={{ display: "grid", gap: 6 }}>
                            <label>Priority</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                style={{ padding: 10 }}
                                disabled={submitting}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>

                        <button type="submit" style={{ padding: "10px 12px" }} disabled={submitting}>
                            {submitting ? "Submitting..." : "Submit Ticket"}
                        </button>

                        {message && <p>{message}</p>}
                    </form>
                </div>
            )}

            <h3>{canManage ? "All Tickets" : "My Tickets"}</h3>

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
                                    <strong>
                                        <Link to={`/tickets/${t.id}`} style={{ textDecoration: "none" }}>
                                            {t.title}
                                        </Link>
                                    </strong>

                                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                        <span
                                            style={{
                                                border: "1px solid #ccc",
                                                padding: "2px 8px",
                                                borderRadius: 999,
                                                fontSize: 12,
                                            }}
                                        >
                                            {(t.priority || "low").toUpperCase()}
                                        </span>

                                        {canDelete && (
                                            <button onClick={() => onDeleteTicket(t.id)} style={{ padding: "6px 10px" }}>
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <p style={{ marginTop: 8, marginBottom: 8 }}>{t.description}</p>

                                <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
                                    Submitted by: {t.createdBy} {" • "}
                                    {t.createdAt ? new Date(t.createdAt).toLocaleString() : "Unknown time"}
                                </p>

                                {canManage && (
                                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#666" }}>
                                        Assigned to:{" "}
                                        {t.assignedUsername ? `${t.assignedUsername} (${t.assignedRole})` : "Unassigned"}
                                    </p>
                                )}

                                {canManage && onUpdateTicket && (
                                    <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                                        <label style={{ fontSize: 12 }}>
                                            Status{" "}
                                            <select
                                                value={t.status || "open"}
                                                onChange={(e) => onUpdateTicket(t.id, { status: e.target.value })}
                                                style={{ marginLeft: 6, padding: 6 }}
                                            >
                                                <option value="open">open</option>
                                                <option value="in_progress">in_progress</option>
                                                <option value="resolved">resolved</option>
                                            </select>
                                        </label>
                                    </div>
                                )}
                            </div>
                        ))}
                </div>
            )}
        </>
    );
}

export default Tickets;