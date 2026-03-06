import { useEffect, useState, useCallback } from "react";

const API_BASE = "http://localhost:5000";

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
}

function TicketComments({ ticketId, onCommentPosted }) {
    const [comments, setComments] = useState([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState("");

    const loadComments = useCallback(async () => {
        if (!ticketId) return;
        setLoading(true);
        setError("");
        try {
            const data = await apiFetch(`/tickets/${ticketId}/comments`);
            setComments(data.comments || []);
        } catch (e) {
            setError(e?.message || "Failed to load comments");
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    const submitComment = async (e) => {
        e.preventDefault();
        const trimmed = message.trim();
        if (!trimmed) return;

        setPosting(true);
        setError("");

        try {
            await apiFetch(`/tickets/${ticketId}/comments`, {
                method: "POST",
                body: JSON.stringify({ message: trimmed }),
            });

            setMessage("");
            await loadComments();

            if (typeof onCommentPosted === "function") {
                onCommentPosted();
            }
        } catch (e) {
            setError(e?.message || "Failed to add comment");
        } finally {
            setPosting(false);
        }
    };

    return (
        <div className="card" style={{ marginTop: 20 }}>
            <h3 className="page-title" style={{ marginTop: 0, fontSize: 22 }}>
                Comments
            </h3>

            {error && <p style={{ color: "crimson" }}>{error}</p>}

            {loading ? (
                <p style={{ color: "var(--uw-muted)" }}>Loading comments...</p>
            ) : comments.length === 0 ? (
                <p style={{ color: "var(--uw-muted)" }}>No comments yet.</p>
            ) : (
                <div className="ticket-grid">
                    {comments.map((c) => (
                        <div
                            key={c.comment_id}
                            style={{
                                border: "1px solid var(--uw-border)",
                                borderRadius: 12,
                                padding: 12,
                                background: "#faf9f7",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    flexWrap: "wrap",
                                    marginBottom: 6,
                                }}
                            >
                                <strong style={{ color: "var(--uw-purple)" }}>{c.username}</strong>
                                <span className="ticket-meta">
                                    {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
                                </span>
                            </div>

                            <div style={{ color: "var(--uw-text)" }}>{c.message}</div>
                        </div>
                    ))}
                </div>
            )}

            <form
                onSubmit={submitComment}
                style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 10,
                    alignItems: "stretch",
                    flexWrap: "wrap",
                }}
            >
                <input
                    className="input"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write a comment..."
                    style={{ flex: 1, minWidth: 240 }}
                />
                <button disabled={posting} className="primary-btn">
                    {posting ? "Posting..." : "Post"}
                </button>
            </form>
        </div>
    );
}

export default TicketComments;