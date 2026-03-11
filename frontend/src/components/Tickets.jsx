import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

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

    const [showArchived, setShowArchived] = useState(false);
    const [loadingArchivedToggle, setLoadingArchivedToggle] = useState(false);

    const [searchValue, setSearchValue] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchMessage, setSearchMessage] = useState("");
    
    const canSearchTickets = user?.role === "admin" || user?.role === "technician"

    const visibleTickets = useMemo(() => {
        if (!user) return [];
        if (canManage) return tickets;
        return tickets.filter((t) => t.createdBy === user.username);
    }, [tickets, user, canManage]);

    const archivedTickets = useMemo(() => {
        return visibleTickets.filter((t) => !!t.archivedAt);
    }, [visibleTickets]);

    const activeTickets = useMemo(() => {
        if (showArchived) return [];
        return visibleTickets.filter(
            (t) => (t.status || "open") !== "resolved" && !t.archivedAt
        );
    }, [visibleTickets, showArchived]);

    const resolvedTickets = useMemo(() => {
        if (showArchived) return [];
        return visibleTickets.filter(
            (t) => (t.status || "open") === "resolved" && !t.archivedAt
        );
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
            <span className="badge">
                {s.toUpperCase()}
            </span>
        );
    };

    const PriorityPill = ({ priority }) => (
        <span className={`badge ${(priority || "low").toLowerCase()}`}>
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
                className="card"
                style={{ padding: 16 }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                    }}
                >
                    <strong style={{ fontSize: 18 }}>
                        <Link to={`/tickets/${t.id}`} style={{ textDecoration: "none", color: "var(--uw-purple)" }}>
                            {t.title}
                        </Link>
                    </strong>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        {isArchived && <span className="badge">ARCHIVED</span>}
                        <StatusPill status={status} />
                        <PriorityPill priority={t.priority} />

                        {canArchive && typeof onArchiveTicket === "function" && (
                            <button onClick={() => onArchiveTicket(t.id)} className="secondary-btn">
                                Archive
                            </button>
                        )}

                        {canUnarchive && typeof onUnarchiveTicket === "function" && (
                            <button onClick={() => onUnarchiveTicket(t.id)} className="secondary-btn">
                                Unarchive
                            </button>
                        )}

                        {canDelete && (
                            <button onClick={() => onDeleteTicket(t.id)} className="secondary-btn">
                                Delete
                            </button>
                        )}
                    </div>
                </div>

                <p style={{ marginTop: 10, marginBottom: 10 }}>{t.description}</p>

                <p className="ticket-meta" style={{ margin: 0 }}>
                    Submitted by: {t.createdBy} {" • "}
                    {t.createdAt ? new Date(t.createdAt).toLocaleString() : "Unknown time"}
                    {isArchived && t.archivedAt ? (
                        <>
                            {" • "}Archived: {new Date(t.archivedAt).toLocaleString()}
                        </>
                    ) : null}
                </p>

                {canManage && (
                    <p className="ticket-meta" style={{ marginTop: 8, marginBottom: 0 }}>
                        Assigned to:{" "}
                        {t.assignedUsername ? `${t.assignedUsername} (${t.assignedRole})` : "Unassigned"}
                    </p>
                )}
            </div>
        );
    };

    const handleSearch = async () => {
        if (!searchValue.trim()) {
            setSearchMessage("Enter email or student number");
            return;
        }

        try {
            const data = await apiFetch(
                `/tickets/search-tickets?query=${encodeURIComponent(searchValue)}`
            );

            if (!Array.isArray(data)) {
                setSearchResults([]);
                setSearchMessage("Unexpected server response");
                return;
            }

            if (data.length === 0) {
                setSearchMessage("No tickets found");
                setSearchResults([]);
            } else {
                setSearchResults(data);
                setSearchMessage("");
            }

        } catch (err) {
            console.error(err);
            setSearchMessage("Search failed");
            setSearchResults([]);
        }
    };


    return (
        <>
            {canSearchTickets && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault(); // prevents page refresh
                            handleSearch();
                        }}
                        style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                    >
                        <input
                            type="text"
                            placeholder="Enter student username or email"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="select"
                            style={{ minWidth: 260 }}
                        />

                        <button
                            type="submit"
                            className="primary-btn"
                        >
                            Search
                        </button>
                    </form>
                </div>
            )}
            {searchResults.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                    <h3 className="page-title" style={{ fontSize: 22, marginBottom: 14 }}>
                        Search Results
                    </h3>

                    <div style={{ display: "grid", gap: 12 }}>
                        {searchResults.map((ticket) => (
                            <Link
                                key={ticket.id}
                                to={`/tickets/${ticket.id}`}
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                <div
                                    className="card"
                                    style={{
                                        cursor: "pointer",
                                        transition: "0.2s ease",
                                        background: "#faf9f7",
                                    }}
                                >
                                    {/* Title */}
                                    <div
                                        style={{
                                            fontSize: 20,
                                            fontWeight: "bold",
                                            color: "var(--uw-purple)",
                                            marginBottom: 6,
                                        }}
                                    >
                                        {ticket.title}
                                    </div>

                                    {/* Status + Priority */}
                                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                        <span className="badge">
                                            Status: {ticket.statusDisplay || ticket.status}
                                        </span>

                                        {ticket.priority && (
                                            <span className="badge">
                                                Priority: {ticket.priorityDisplay || ticket.priority}
                                            </span>
                                        )}
                                    </div>

                                    {/* Description */}
                                    {ticket.description && (
                                        <p style={{ marginTop: 0, marginBottom: 12 }}>
                                            {ticket.description}
                                        </p>
                                    )}

                                    {/* Meta info */}
                                    <p className="ticket-meta" style={{ margin: 0 }}>
                                        Email: {ticket.email} {" • "}
                                        Student #: {ticket.user_id ?? "Unknown"} {" • "}
                                        Created:{" "}
                                        {ticket.created_at
                                            ? new Date(ticket.created_at).toLocaleString()
                                            : "Unknown"}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
            <div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                        marginBottom: 18,
                    }}
                >
                    <h1 className="page-title" style={{ margin: 0 }}>Tickets</h1>

                    {canManage && (
                        <button
                            onClick={handleToggleArchived}
                            disabled={loadingArchivedToggle}
                            className="secondary-btn"
                        >
                            {loadingArchivedToggle
                                ? "Loading..."
                                : showArchived
                                    ? "Show Active Tickets"
                                    : "Show Archived Tickets"}
                        </button>
                    )}
                </div>

                {!canManage && !showArchived && (
                    <div className="card" style={{ maxWidth: 650, marginBottom: 24 }}>
                        <h3 className="page-title" style={{ marginTop: 0, fontSize: 22 }}>
                            Submit a Ticket
                        </h3>

                        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
                            <div className="label">
                                <label>Title</label>
                                <input
                                    className="input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Wi-Fi not working"
                                    disabled={submitting}
                                />
                            </div>

                            <div className="label">
                                <label>Description</label>
                                <textarea
                                    className="textarea"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe the issue and any steps you already tried..."
                                    rows={4}
                                    disabled={submitting}
                                />
                            </div>

                            <div className="label">
                                <label>Priority</label>
                                <select
                                    className="select"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    disabled={submitting}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>

                            <button type="submit" className="primary-btn" disabled={submitting}>
                                {submitting ? "Submitting..." : "Submit Ticket"}
                            </button>

                            {message && (
                                <p style={{ marginBottom: 0, color: message.includes("Failed") ? "crimson" : "var(--uw-muted)" }}>
                                    {message}
                                </p>
                            )}
                        </form>
                    </div>
                )}

                {showArchived ? (
                    <>
                        <h3 className="page-title" style={{ fontSize: 22 }}>
                            {canManage ? "Archived Tickets" : "My Archived Tickets"}
                        </h3>

                        {archivedTickets.length === 0 ? (
                            <p style={{ color: "var(--uw-muted)" }}>No archived tickets.</p>
                        ) : (
                            <div className="ticket-grid" style={{ maxWidth: 900 }}>
                                {archivedTickets.slice().reverse().map(TicketCard)}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <h3 className="page-title" style={{ fontSize: 22 }}>
                            {canManage ? "Active Tickets" : "My Active Tickets"}
                        </h3>

                        {activeTickets.length === 0 ? (
                            <p style={{ color: "var(--uw-muted)" }}>No active tickets.</p>
                        ) : (
                            <div className="ticket-grid" style={{ maxWidth: 900 }}>
                                {activeTickets.slice().reverse().map(TicketCard)}
                            </div>
                        )}

                        <h3 className="page-title" style={{ fontSize: 22, marginTop: 24 }}>
                            {canManage ? "Resolved Tickets" : "My Resolved Tickets"}
                        </h3>

                        {resolvedTickets.length === 0 ? (
                            <p style={{ color: "var(--uw-muted)" }}>No resolved tickets.</p>
                        ) : (
                            <div className="ticket-grid" style={{ maxWidth: 900 }}>
                                {resolvedTickets.slice().reverse().map(TicketCard)}
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

export default Tickets;