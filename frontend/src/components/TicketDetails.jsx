import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import TicketComments from "./TicketComments";

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

function TicketDetails({ user, onTicketsChanged }) {
  const { ticketId } = useParams();

  const [ticket, setTicket] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState(""); // "" = unassigned

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canChangeStatus = user && (user.role === "admin" || user.role === "technician");
  const canArchiveResolved = user && (user.role === "admin" || user.role === "technician");
  const canUnarchive = user && user.role === "admin";

  const loadTicket = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/tickets/${ticketId}`);
      setTicket(data.ticket);
    } catch (e) {
      setError(e?.message || "Failed to load ticket");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const loadAssignees = useCallback(async () => {
    try {
      const data = await apiFetch("/assignees");
      setAssignees(data.assignees || []);
    } catch (e) {
      // Don't break the page if assignee list fails
      console.error(e);
    }
  }, []);

  const archiveTicket = async () => {
    try {
      setError("");
      await apiFetch(`/tickets/${ticketId}/archive`, { method: "PATCH" });
      await loadTicket();
      if (onTicketsChanged) await onTicketsChanged();
    } catch (e) {
      setError(e?.message || "Failed to archive ticket");
    }
  };

  const unarchiveTicket = async () => {
    try {
      setError("");
      await apiFetch(`/tickets/${ticketId}/unarchive`, { method: "PATCH" });
      await loadTicket();
      if (onTicketsChanged) await onTicketsChanged();
    } catch (e) {
      setError(e?.message || "Failed to unarchive ticket");
    }
  };

  // Load ticket (always) + assignees (admin only)
  useEffect(() => {
    if (!user) return;
    loadTicket();
    if (user.role === "admin") loadAssignees();
  }, [ticketId, user, loadTicket, loadAssignees]);

  // Keep dropdown in sync with backend assignment
  useEffect(() => {
    if (!ticket) return;
    setSelectedAssignee(ticket.assignedTo ?? "");
  }, [ticket]);

  const updateStatus = async (nextStatus) => {
    try {
      setError("");
      await apiFetch(`/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadTicket();
      if (onTicketsChanged) await onTicketsChanged();
    } catch (e) {
      setError(e?.message || "Failed to update status");
    }
  };

  const saveAssignment = async () => {
    try {
      setError("");

      const body =
        selectedAssignee === ""
          ? { assignedTo: null }
          : { assignedTo: Number(selectedAssignee) };

      await apiFetch(`/tickets/${ticketId}/assign`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      await loadTicket(); // refresh assignedUsername/Role
      if (onTicketsChanged) await onTicketsChanged();
    } catch (e) {
      setError(e?.message || "Failed to update assignment");
    }
  };

  if (!user) return <p>Please log in to view this ticket.</p>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/tickets">← Back to Tickets</Link>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {ticket && !loading && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {/* Archive: tech/admin only, only if resolved, only if not archived */}
          {canArchiveResolved && !ticket.archivedAt && (ticket.status === "resolved") && (
            <button onClick={archiveTicket}>Archive</button>
          )}

          {/* Unarchive: admin only */}
          {canUnarchive && ticket.archivedAt && (
            <button onClick={unarchiveTicket}>Unarchive</button>
          )}
        </div>
      )}

      {ticket?.archivedAt && (
        <p style={{ marginTop: 8 }}>
          Archived on: {new Date(ticket.archivedAt).toLocaleString()}
        </p>
      )}

      {loading ? (
        <p>Loading ticket...</p>
      ) : !ticket ? (
        <p>Ticket not found.</p>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>{ticket.title}</h2>
          <p style={{ marginTop: 8 }}>{ticket.description}</p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {canChangeStatus ? (
              <label style={{ fontSize: 12, border: "1px solid #ccc", padding: "6px 10px", borderRadius: 999 }}>
                Status{" "}
                <select
                  value={ticket.status || "open"}
                  onChange={(e) => updateStatus(e.target.value)}
                  style={{ marginLeft: 6, padding: 6 }}
                  disabled={!!ticket.archivedAt} // optional: prevent changing status while archived
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
            ) : (
              <span style={{ border: "1px solid #ccc", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>
                Status: {(ticket.status || "unknown").toUpperCase()}
              </span>
            )}
            <span style={{ border: "1px solid #ccc", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>
              Priority: {(ticket.priority || "low").toUpperCase()}
            </span>
          </div>

          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: "#666" }}>
            Submitted by: {ticket.createdBy} {" • "}
            {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "Unknown time"}
          </p>

          {/* Assignment display + admin controls */}
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              Assigned to:{" "}
              {ticket.assignedUsername ? `${ticket.assignedUsername} (${ticket.assignedRole})` : "Unassigned"}
            </p>

            {user.role === "admin" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  style={{ padding: 8 }}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.username} ({a.role})
                    </option>
                  ))}
                </select>

                <button onClick={saveAssignment} style={{ padding: "8px 10px" }}>
                  Save Assignment
                </button>
              </div>
            )}
          </div>

          {/* comments */}
          <div style={{ marginTop: 16 }}>
            <TicketComments
              ticketId={ticket.id}
              onCommentPosted={() => {
                // refresh ticket (and optionally refresh list view in App)
                loadTicket();
                if (onTicketsChanged) onTicketsChanged();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketDetails;