import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TicketComments from "./TicketComments";

function TicketDetails({ user, onTicketsChanged }) {
  const { ticketId } = useParams();

  const [ticket, setTicket] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState(""); // "" = unassigned

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTicket = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:5000/tickets/${ticketId}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load ticket");
      setTicket(data.ticket);
    } catch (e) {
      setError(e?.message || "Failed to load ticket");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignees = async () => {
    try {
      const res = await fetch("http://localhost:5000/assignees", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load assignees");
      setAssignees(data.assignees || []);
    } catch (e) {
      // Don't break the page if assignee list fails
      console.error(e);
    }
  };
   
  // Load ticket (always) + assignees (admin only)
  useEffect(() => {
    if (!user) return;
    loadTicket();
    if (user.role === "admin") loadAssignees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, user]);

  // Keep dropdown in sync with backend assignment
  useEffect(() => {
    if (!ticket) return;
    setSelectedAssignee(ticket.assignedTo ?? "");
  }, [ticket]);

  const saveAssignment = async () => {
    try {
      setError("");

      const body =
        selectedAssignee === ""
          ? { assignedTo: null }
          : { assignedTo: Number(selectedAssignee) };

      const res = await fetch(`http://localhost:5000/tickets/${ticketId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update assignment");

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

      {loading ? (
        <p>Loading ticket...</p>
      ) : !ticket ? (
        <p>Ticket not found.</p>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>{ticket.title}</h2>
          <p style={{ marginTop: 8 }}>{ticket.description}</p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <span
              style={{
                border: "1px solid #ccc",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              Status: {(ticket.status || "unknown").toUpperCase()}
            </span>
            <span
              style={{
                border: "1px solid #ccc",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              Priority: {(ticket.priority || "low").toUpperCase()}
            </span>
          </div>

          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: "#666" }}>
            Submitted by: {ticket.createdBy}
            {" • "}
            {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "Unknown time"}
          </p>

          {/* ✅ Assignment display + admin controls */}
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              Assigned to:{" "}
              {ticket.assignedUsername
                ? `${ticket.assignedUsername} (${ticket.assignedRole})`
                : "Unassigned"}
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
            <TicketComments ticketId={ticket.id} />
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketDetails;