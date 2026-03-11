import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function TechQueue({ user, tickets = [], onUpdateTicket }) {
    const [updatingId, setUpdatingId] = useState(null);

    const { assignedToMe, unassigned, highPriorityOpen } = useMemo(() => {
        const assignedToMe = [];
        const unassigned = [];
        const highPriorityOpen = [];

        const isActive = (status) => status === "open" || status === "in_progress";

        for (const t of tickets) {
            const status = (t.status || "open").toLowerCase();
            const priority = (t.priority || "low").toLowerCase();

            if (!isActive(status)) continue;

            const isMine =
                t.assignedTo != null &&
                user?.id != null &&
                Number(t.assignedTo) === Number(user.id);

            const isUnassigned = t.assignedTo == null;
            const isHighOpen = status === "open" && priority === "high";

            if (isHighOpen) {
                highPriorityOpen.push(t);
            } else if (isMine) {
                assignedToMe.push(t);
            } else if (isUnassigned) {
                unassigned.push(t);
            }
        }

        const byNewest = (a, b) => (b.id ?? 0) - (a.id ?? 0);

        return {
            assignedToMe: assignedToMe.sort(byNewest),
            unassigned: unassigned.sort(byNewest),
            highPriorityOpen: highPriorityOpen.sort(byNewest),
        };
    }, [tickets, user?.id]);

    const handleClaim = async (ticketId) => {
        if (!onUpdateTicket || !user?.id) return;

        try {
            setUpdatingId(ticketId);
            await onUpdateTicket(ticketId, { assignedTo: user.id });
        } catch (err) {
            console.error("Failed to claim ticket:", err);
            alert(err.message || "Failed to claim ticket");
        } finally {
            setUpdatingId(null);
        }
    };

    const handleUnclaim = async (ticketId) => {
        if (!onUpdateTicket) return;

        try {
            setUpdatingId(ticketId);
            await onUpdateTicket(ticketId, { assignedTo: null });
        } catch (err) {
            console.error("Failed to unclaim ticket:", err);
            alert(err.message || "Failed to unclaim ticket");
        } finally {
            setUpdatingId(null);
        }
    };

    const Section = ({ title, items }) => (
        <div className="card">
            <h3 className="page-title" style={{ marginTop: 0, fontSize: 22 }}>
                {title}{" "}
                <span style={{ color: "var(--uw-muted)", fontWeight: "normal" }}>
                    ({items.length})
                </span>
            </h3>

            {items.length === 0 ? (
                <p style={{ color: "var(--uw-muted)" }}>Nothing here.</p>
            ) : (
                <div className="ticket-grid">
                    {items.map((t) => {
                        const isMine = Number(t.assignedTo) === Number(user?.id);
                        const isUnassigned = t.assignedTo == null;
                        const isBusy = updatingId === t.id;

                        return (
                            <div key={t.id} className="card" style={{ padding: 14 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 10,
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                    }}
                                >
                                    <strong style={{ fontSize: 17 }}>
                                        <Link
                                            to={`/tickets/${t.id}`}
                                            style={{ textDecoration: "none", color: "var(--uw-purple)" }}
                                        >
                                            #{t.id} - {t.title}
                                        </Link>
                                    </strong>

                                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                        <span className={`badge ${(t.priority || "low").toLowerCase()}`}>
                                            {String(t.priority || "low").toUpperCase()}
                                        </span>

                                        <span className="badge">
                                            {(t.status || "open").replace(/_/g, " ").toUpperCase()}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ color: "var(--uw-text)", marginTop: 8 }}>
                                    {t.description}
                                </div>

                                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    {isUnassigned && onUpdateTicket && user?.id && (
                                        <button
                                            onClick={() => handleClaim(t.id)}
                                            className="primary-btn"
                                            disabled={isBusy}
                                        >
                                            {isBusy ? "Updating..." : "Claim"}
                                        </button>
                                    )}

                                    {isMine && onUpdateTicket && (
                                        <button
                                            onClick={() => handleUnclaim(t.id)}
                                            className="secondary-btn"
                                            disabled={isBusy}
                                        >
                                            {isBusy ? "Updating..." : "Unclaim"}
                                        </button>
                                    )}
                                </div>

                                <div className="ticket-meta" style={{ marginTop: 10 }}>
                                    Created by: <b>{t.createdBy}</b>{" | "}
                                    {t.assignedUsername ? (
                                        <>
                                            Assigned: <b>{t.assignedUsername}</b>
                                        </>
                                    ) : (
                                        <>
                                            Assigned: <b>Unassigned</b>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
            <h1 className="page-title">My Queue</h1>
            <p style={{ color: "var(--uw-muted)" }}>
                Signed in as {user?.username} ({user?.role})
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                <Section title="High Priority Open" items={highPriorityOpen} />
                <Section title="Assigned to Me" items={assignedToMe} />
                <Section title="Unassigned" items={unassigned} />
            </div>
        </div>
    );
}