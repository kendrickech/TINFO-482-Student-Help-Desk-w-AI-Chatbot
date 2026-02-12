import { useMemo, useState } from "react";

function Tickets({ user, tickets, onCreateTicket, onDeleteTicket }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("low");

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const visibleTickets = useMemo(() => {
    if (!user) return [];
    if (user.role === "admin") return tickets;
    return tickets.filter((t) => t.createdBy === user.username);
  }, [tickets, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!title.trim() || !description.trim()) {
      setMessage("Please enter a title and description.");
      return;
    }

    try {
      setSubmitting(true);

      // IMPORTANT: do not send createdBy from the client
      // backend should use session user_id and return createdBy
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
                      {(t.priority || "low").toUpperCase()}
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
                  {t.createdAt ? new Date(t.createdAt).toLocaleString() : "Unknown time"}
                </p>
              </div>
            ))}
        </div>
      )}
    </>
  );
}

export default Tickets;
