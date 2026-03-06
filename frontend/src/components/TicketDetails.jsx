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

  // ✅ NEW: status editing state (draft + saving + small message)
  const [statusDraft, setStatusDraft] = useState("open");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [priorityDraft, setPriorityDraft] = useState("low");
  const [savingPriority, setSavingPriority] = useState(false);
  const [priorityMsg, setPriorityMsg] = useState("");

  const canChangeStatus = user && (user.role === "admin" || user.role === "technician");
  const canArchiveResolved = user && (user.role === "admin" || user.role === "technician");
  const canUnarchive = user && user.role === "admin";

  const loadTicket = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/tickets/${ticketId}`);
      setTicket(data.ticket);

      const p = (data.ticket?.priority || "low").toLowerCase();
      setPriorityDraft(p);

      // ✅ NEW: keep statusDraft synced when ticket loads
      const s = (data.ticket?.status || "open").toLowerCase();
      setStatusDraft(s);
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

  // Keep assignment dropdown in sync with backend assignment
  useEffect(() => {
    if (!ticket) return;
    setSelectedAssignee(ticket.assignedTo ?? "");
    // ✅ NEW: also keep statusDraft synced if ticket changes for any reason
    setStatusDraft((ticket.status || "open").toLowerCase());
    setPriorityDraft((ticket.priority || "low").toLowerCase());
  }, [ticket]);

  // ✅ CHANGED: updateStatus now saves whatever is in statusDraft (not on every change)
  const updateStatus = async () => {
    try {
      setError("");
      setStatusMsg("");
      setSavingStatus(true);

      await apiFetch(`/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusDraft }),
      });

      await loadTicket();
      if (onTicketsChanged) await onTicketsChanged();

      setStatusMsg("Saved!");
      setTimeout(() => setStatusMsg(""), 1500);
    } catch (e) {
      setError(e?.message || "Failed to update status");
    } finally {
      setSavingStatus(false);
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

  const updatePriority = async () => {
    try {
      setError("");
      setPriorityMsg("");
      setSavingPriority(true);

      await apiFetch(`/tickets/${ticketId}/priority`, {
        method: "PATCH",
        body: JSON.stringify({ priority: priorityDraft }),
      });

      await loadTicket();
      if (onTicketsChanged) await onTicketsChanged();

      setPriorityMsg("Saved!");
      setTimeout(() => setPriorityMsg(""), 1500);
    } catch (e) {
      setError(e?.message || "Failed to update priority");
    } finally {
      setSavingPriority(false);
    }
  };

  if (!user) return <p>Please log in to view this ticket.</p>;

  const currentStatus = (ticket?.status || "open").toLowerCase();
  const statusChanged = statusDraft !== currentStatus;
  const currentPriority = (ticket?.priority || "low").toLowerCase();
  const priorityChanged = priorityDraft !== currentPriority;
  const canChangePriority = user && (user.role === "admin" || user.role === "technician");

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
              <label
                style={{
                  fontSize: 12,
                  border: "1px solid #ccc",
                  padding: "6px 10px",
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Status
                <select
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value)}
                  style={{ padding: 6 }}
                  disabled={!!ticket.archivedAt || savingStatus}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>

                <button
                  onClick={updateStatus}
                  disabled={!!ticket.archivedAt || savingStatus || !statusChanged}
                  style={{ padding: "6px 10px", borderRadius: 8 }}
                >
                  {savingStatus ? "Saving..." : "Save"}
                </button>

                {statusMsg && <span style={{ color: "green" }}>{statusMsg}</span>}
              </label>
            ) : (
              <span style={{ border: "1px solid #ccc", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>
                Status: {(ticket.status || "unknown").toUpperCase()}
              </span>
            )}

            {canChangePriority ? (
              <label
                style={{
                  fontSize: 12,
                  border: "1px solid #ccc",
                  padding: "6px 10px",
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Priority
                <select
                  value={priorityDraft}
                  onChange={(e) => setPriorityDraft(e.target.value)}
                  style={{ padding: 6 }}
                  disabled={!!ticket.archivedAt || savingPriority}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>

                <button
                  onClick={updatePriority}
                  disabled={!!ticket.archivedAt || savingPriority || !priorityChanged}
                  style={{ padding: "6px 10px", borderRadius: 8 }}
                >
                  {savingPriority ? "Saving..." : "Save"}
                </button>

                {priorityMsg && <span style={{ color: "green" }}>{priorityMsg}</span>}
              </label>
            ) : (
              <span style={{ border: "1px solid #ccc", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>
                Priority: {(ticket.priority || "low").toUpperCase()}
              </span>
            )}
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