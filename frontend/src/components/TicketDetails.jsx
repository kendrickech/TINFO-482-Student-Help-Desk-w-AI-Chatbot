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
    const [selectedAssignee, setSelectedAssignee] = useState("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [statusDraft, setStatusDraft] = useState("open");
    const [savingStatus, setSavingStatus] = useState(false);
    const [statusMsg, setStatusMsg] = useState("");

    const [priorityDraft, setPriorityDraft] = useState("low");
    const [savingPriority, setSavingPriority] = useState(false);
    const [priorityMsg, setPriorityMsg] = useState("");

    const canChangeStatus = user && (user.role === "admin" || user.role === "technician");
    const canArchiveResolved = user && (user.role === "admin" || user.role === "technician");
    const canUnarchive = user && user.role === "admin";
    const canChangePriority = user && (user.role === "admin" || user.role === "technician");

    const loadTicket = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await apiFetch(`/tickets/${ticketId}`);
            setTicket(data.ticket);

            setPriorityDraft((data.ticket?.priority || "low").toLowerCase());
            setStatusDraft((data.ticket?.status || "open").toLowerCase());
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

    useEffect(() => {
        if (!user) return;
        loadTicket();
        if (user.role === "admin") loadAssignees();
    }, [ticketId, user, loadTicket, loadAssignees]);

    useEffect(() => {
        if (!ticket) return;
        setSelectedAssignee(ticket.assignedTo ?? "");
        setStatusDraft((ticket.status || "open").toLowerCase());
        setPriorityDraft((ticket.priority || "low").toLowerCase());
    }, [ticket]);

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

            await loadTicket();
            if (onTicketsChanged) await onTicketsChanged();
        } catch (e) {
            setError(e?.message || "Failed to update assignment");
        }
    };

    if (!user) return <p>Please log in to view this ticket.</p>;

    const currentStatus = (ticket?.status || "open").toLowerCase();
    const statusChanged = statusDraft !== currentStatus;

    const currentPriority = (ticket?.priority || "low").toLowerCase();
    const priorityChanged = priorityDraft !== currentPriority;

    return (
        <div style={{ maxWidth: 950, margin: "0 auto" }}>
            <div style={{ marginBottom: 14 }}>
                <Link to="/tickets" style={{ textDecoration: "none", color: "var(--uw-purple)", fontWeight: 600 }}>
                    ← Back to Tickets
                </Link>
            </div>

            {error && <p style={{ color: "crimson" }}>{error}</p>}

            {ticket && !loading && (
                <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    {canArchiveResolved && !ticket.archivedAt && ticket.status === "resolved" && (
                        <button onClick={archiveTicket} className="secondary-btn">
                            Archive
                        </button>
                    )}

                    {canUnarchive && ticket.archivedAt && (
                        <button onClick={unarchiveTicket} className="secondary-btn">
                            Unarchive
                        </button>
                    )}
                </div>
            )}

            {ticket?.archivedAt && (
                <p className="ticket-meta" style={{ marginTop: 0, marginBottom: 12 }}>
                    Archived on: {new Date(ticket.archivedAt).toLocaleString()}
                </p>
            )}

            {loading ? (
                <p style={{ color: "var(--uw-muted)" }}>Loading ticket...</p>
            ) : !ticket ? (
                <p style={{ color: "var(--uw-muted)" }}>Ticket not found.</p>
            ) : (
                <div className="card">
                    <h2 className="page-title" style={{ marginTop: 0, marginBottom: 10 }}>
                        {ticket.title}
                    </h2>

                    <p style={{ marginTop: 0, marginBottom: 18 }}>{ticket.description}</p>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                        {canChangeStatus ? (
                            <div className="card" style={{ padding: 12, boxShadow: "none" }}>
                                <div style={{ fontSize: 12, color: "var(--uw-purple)", fontWeight: 600, marginBottom: 8 }}>
                                    Status
                                </div>

                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <select
                                        className="select"
                                        value={statusDraft}
                                        onChange={(e) => setStatusDraft(e.target.value)}
                                        disabled={!!ticket.archivedAt || savingStatus}
                                        style={{ minWidth: 170 }}
                                    >
                                        <option value="open">Open</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                    </select>

                                    <button
                                        onClick={updateStatus}
                                        disabled={!!ticket.archivedAt || savingStatus || !statusChanged}
                                        className="primary-btn"
                                    >
                                        {savingStatus ? "Saving..." : "Save"}
                                    </button>

                                    {statusMsg && <span style={{ color: "green", fontSize: 13 }}>{statusMsg}</span>}
                                </div>
                            </div>
                        ) : (
                            <span className="badge">
                                Status: {(ticket.status || "unknown").toUpperCase()}
                            </span>
                        )}

                        {canChangePriority ? (
                            <div className="card" style={{ padding: 12, boxShadow: "none" }}>
                                <div style={{ fontSize: 12, color: "var(--uw-purple)", fontWeight: 600, marginBottom: 8 }}>
                                    Priority
                                </div>

                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <select
                                        className="select"
                                        value={priorityDraft}
                                        onChange={(e) => setPriorityDraft(e.target.value)}
                                        disabled={!!ticket.archivedAt || savingPriority}
                                        style={{ minWidth: 170 }}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>

                                    <button
                                        onClick={updatePriority}
                                        disabled={!!ticket.archivedAt || savingPriority || !priorityChanged}
                                        className="primary-btn"
                                    >
                                        {savingPriority ? "Saving..." : "Save"}
                                    </button>

                                    {priorityMsg && <span style={{ color: "green", fontSize: 13 }}>{priorityMsg}</span>}
                                </div>
                            </div>
                        ) : (
                            <span className="badge">
                                Priority: {(ticket.priority || "low").toUpperCase()}
                            </span>
                        )}
                    </div>

                    <p className="ticket-meta" style={{ marginTop: 0, marginBottom: 12 }}>
                        Submitted by: {ticket.createdBy} {" • "}
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "Unknown time"}
                    </p>

                    <div className="card" style={{ padding: 14, boxShadow: "none", marginBottom: 16 }}>
                        <p className="ticket-meta" style={{ marginTop: 0, marginBottom: 8 }}>
                            Assigned to:{" "}
                            {ticket.assignedUsername ? `${ticket.assignedUsername} (${ticket.assignedRole})` : "Unassigned"}
                        </p>

                        {user.role === "admin" && (
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <select
                                    className="select"
                                    value={selectedAssignee}
                                    onChange={(e) => setSelectedAssignee(e.target.value)}
                                    style={{ maxWidth: 260 }}
                                >
                                    <option value="">Unassigned</option>
                                    {assignees.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.username} ({a.role})
                                        </option>
                                    ))}
                                </select>

                                <button onClick={saveAssignment} className="secondary-btn">
                                    Save Assignment
                                </button>
                            </div>
                        )}
                    </div>

                    <TicketComments
                        ticketId={ticket.id}
                        onCommentPosted={() => {
                            loadTicket();
                            if (onTicketsChanged) onTicketsChanged();
                        }}
                    />
                </div>
            )}
        </div>
    );
}

export default TicketDetails;