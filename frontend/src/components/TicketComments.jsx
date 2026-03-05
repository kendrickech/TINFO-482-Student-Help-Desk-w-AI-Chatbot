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

      // Let parent refresh ticket / lists if it wants to
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
    <div style={{ marginTop: 20 }}>
      <h3>Comments</h3>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {loading ? (
        <p>Loading comments...</p>
      ) : comments.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        comments.map((c) => (
          <div key={c.comment_id} style={{ marginBottom: 10 }}>
            <strong>{c.username}</strong> •{" "}
            {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
            <div>{c.message}</div>
          </div>
        ))
      )}

      <form onSubmit={submitComment} style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a comment..."
          style={{ flex: 1, padding: 8 }}
        />
        <button disabled={posting} style={{ padding: "8px 10px" }}>
          {posting ? "Posting..." : "Post"}
        </button>
      </form>
    </div>
  );
}

export default TicketComments;