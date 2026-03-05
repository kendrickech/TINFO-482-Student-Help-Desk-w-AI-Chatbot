import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

function Tickets({
  user,
  tickets,
  onCreateTicket,
  onDeleteTicket,
  onToggleArchived,
  onArchiveTicket,
  onUnarchiveTicket,
  canManage = false,
  canDelete = false,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("low");

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // tech/admin toggle: active vs archived
  const [showArchived, setShowArchived] = useState(false);
  const [loadingArchivedToggle, setLoadingArchivedToggle] = useState(false);

  const visibleTickets = useMemo(() => {
    if (!user) return [];
    if (canManage) return tickets;
    return tickets.filter((t) => t.createdBy === user.username);
  }, [tickets, user, canManage]);

  // When NOT in archived view:
  // - Active = open + in_progress
  // - Resolved = resolved
  const activeTickets = useMemo(() => {
    if (showArchived) return [];
    return visibleTickets.filter((t) => (t.status || "open") !== "resolved");
  }, [visibleTickets, showArchived]);

  const resolvedTickets = useMemo(() => {
    if (showArchived) return [];
    return visibleTickets.filter((t) => (t.status || "open") === "resolved");
  }, [visibleTickets, showArchived]);

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

  const handleToggleArchived = async () => {
    const next = !showArchived;

    if (typeof onToggleArchived === "function") {
      try {
        setLoadingArchivedToggle(true);
        await onToggleArchived(next);
        setShowArchived(next);
      } finally {
        setLoadingArchivedToggle(false);
      }
      return;
    }

    setShowArchived(next);
  };

  if (!user) return <p>Please log in to view tickets.</p>;

  const StatusPill = ({ status }) => {
    const s = (status || "open").replace("_", " ");
    return (
      <span
        style={{
          border: "1px solid #ccc",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 12,
        }}
      >
        {s.toUpperCase()}
      </span>
    );
  };

  const PriorityPill = ({ priority }) => (
    <span
      style={{
        border: "1px solid #ccc",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
      }}
    >
      {(priority || "low").toUpperCase()}
    </span>
  );

  const TicketCard = (t) => {
    const isArchived = !!t.archivedAt;
    const status = t.status || "open";
    const canArchive = canManage && !showArchived && !isArchived && status === "resolved";
    const canUnarchive = showArchived && isArchived && user.role === "admin";

    return (
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
            {isArchived && (
              <span
                style={{
                  border: "1px solid #aaa",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                }}
              >
                ARCHIVED
              </span>
            )}

            <StatusPill status={status} />
            <PriorityPill priority={t.priority} />

            {canArchive && typeof onArchiveTicket === "function" && (
              <button onClick={() => onArchiveTicket(t.id)} style={{ padding: "6px 10px" }}>
                Archive
              </button>
            )}

            {canUnarchive && typeof onUnarchiveTicket === "function" && (
              <button onClick={() => onUnarchiveTicket(t.id)} style={{ padding: "6px 10px" }}>
                Unarchive
              </button>
            )}

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
          {isArchived && t.archivedAt ? (
            <>
              {" • "}Archived: {new Date(t.archivedAt).toLocaleString()}
            </>
          ) : null}
        </p>

        {canManage && (
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#666" }}>
            Assigned to:{" "}
            {t.assignedUsername ? `${t.assignedUsername} (${t.assignedRole})` : "Unassigned"}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Tickets</h1>

        {canManage && (
          <button onClick={handleToggleArchived} disabled={loadingArchivedToggle} style={{ padding: "8px 10px" }}>
            {loadingArchivedToggle ? "Loading..." : showArchived ? "Show Active Tickets" : "Show Archived Tickets"}
          </button>
        )}
      </div>

      {/* Submit form: students only, only in active view */}
      {!canManage && !showArchived && (
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
              <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ padding: 10 }} disabled={submitting}>
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

      {/* Views */}
      {showArchived ? (
        <>
          <h3 style={{ marginTop: 18 }}>{canManage ? "Archived Tickets" : "My Tickets"}</h3>
          {visibleTickets.length === 0 ? (
            <p style={{ color: "#666" }}>No tickets yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10, maxWidth: 800 }}>
              {visibleTickets.slice().reverse().map(TicketCard)}
            </div>
          )}
        </>
      ) : (
        <>
          <h3 style={{ marginTop: 18 }}>{canManage ? "Active Tickets" : "My Active Tickets"}</h3>
          {activeTickets.length === 0 ? (
            <p style={{ color: "#666" }}>No active tickets.</p>
          ) : (
            <div style={{ display: "grid", gap: 10, maxWidth: 800 }}>
              {activeTickets.slice().reverse().map(TicketCard)}
            </div>
          )}

          <h3 style={{ marginTop: 18 }}>{canManage ? "Resolved Tickets" : "My Resolved Tickets"}</h3>
          {resolvedTickets.length === 0 ? (
            <p style={{ color: "#666" }}>No resolved tickets.</p>
          ) : (
            <div style={{ display: "grid", gap: 10, maxWidth: 800 }}>
              {resolvedTickets.slice().reverse().map(TicketCard)}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default Tickets;