import { useEffect, useState } from "react";

function TicketComments({ ticketId }) {
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const loadComments = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:5000/tickets/${ticketId}/comments`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load comments");
      setComments(data.comments || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) loadComments();
  }, [ticketId]);

  const submitComment = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setPosting(true);
    setError("");

    try {
      const res = await fetch(`http://localhost:5000/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add comment");

      setMessage("");
      loadComments();
    } catch (e) {
      setError(e.message);
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
            {c.created_at && new Date(c.created_at).toLocaleString()}
            <div>{c.message}</div>
          </div>
        ))
      )}

      <form onSubmit={submitComment} style={{ marginTop: 10 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a comment..."
        />
        <button disabled={posting}>
          {posting ? "Posting..." : "Post"}
        </button>
      </form>
    </div>
  );
}

export default TicketComments;