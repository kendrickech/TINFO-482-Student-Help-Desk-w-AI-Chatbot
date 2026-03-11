import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:5000";

function StatCard({ title, value, subtitle }) {
    return (
        <div className="card">
            <div style={{ fontSize: 14, color: "var(--uw-muted)", marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 30, fontWeight: "bold", color: "var(--uw-purple)" }}>{value}</div>
            {subtitle ? (
                <div style={{ fontSize: 13, color: "var(--uw-muted)", marginTop: 6 }}>{subtitle}</div>
            ) : null}
        </div>
    );
}

function TicketList({ title, tickets, emptyMessage }) {
    return (
        <div className="card">
            <h3 className="page-title" style={{ fontSize: 22, marginBottom: 14 }}>
                {title}
            </h3>

            {tickets.length === 0 ? (
                <p style={{ color: "var(--uw-muted)" }}>{emptyMessage}</p>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    {tickets.map((t) => (
                        <Link
                            key={t.id}
                            to={`/tickets/${t.id}`}
                            style={{
                                textDecoration: "none",
                                color: "inherit",
                                border: "1px solid var(--uw-border)",
                                borderRadius: 12,
                                padding: 14,
                                background: "#faf9f7",
                                transition: "0.2s ease",
                            }}
                        >
                            <div style={{ fontWeight: "bold", color: "var(--uw-purple)" }}>{t.title}</div>
                            <div style={{ fontSize: 14, color: "var(--uw-muted)", marginTop: 4 }}>
                                Status: {t.statusDisplay || t.status?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Unknown"}{" "}
                                | Priority: {t.priorityDisplay || t.priority?.charAt(0).toUpperCase() + t.priority?.slice(1) || "Low"}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Dashboard({ user, tickets = [] }) {
    const navigate = useNavigate();

    const isAdmin = user?.role === "admin";
    const isTech = user?.role === "technician";
    const isStudent = user?.role === "student";

    const {
        myTickets,
        myActiveTickets,
        myClosedTickets,
        assignedToMe,
        unassignedActive,
        highPriorityOpen,
        activeTickets,
        recentRelevantTickets,
    } = useMemo(() => {
        const normalized = tickets.map((t) => ({
            ...t,
            status: (t.status || "open").toLowerCase(),
            priority: (t.priority || "low").toLowerCase(),
        }));

        const isClosedStatus = (status) => status === "resolved" || status === "closed";

        const myTickets = normalized.filter((t) => t.createdBy === user?.username);
        const myActiveTickets = myTickets.filter((t) => !isClosedStatus(t.status));
        const myClosedTickets = myTickets.filter((t) => isClosedStatus(t.status));

        const activeTickets = normalized.filter((t) => !isClosedStatus(t.status));
        const assignedToMe = activeTickets.filter((t) => t.assignedTo === user?.id);
        const unassignedActive = activeTickets.filter((t) => t.assignedTo == null);
        const highPriorityOpen = activeTickets.filter(
            (t) => t.status === "open" && t.priority === "high"
        );

        let relevant = [];
        if (isStudent) relevant = [...myTickets];
        if (isAdmin || isTech) relevant = [...assignedToMe, ...unassignedActive];

        const seen = new Set();
        const recentRelevantTickets = relevant
            .filter((t) => {
                if (seen.has(t.id)) return false;
                seen.add(t.id);
                return true;
            })
            .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
            .slice(0, 5);

        return {
            myTickets,
            myActiveTickets,
            myClosedTickets,
            assignedToMe,
            unassignedActive,
            highPriorityOpen,
            activeTickets,
            recentRelevantTickets,
        };
    }, [tickets, user?.id, user?.username, isAdmin, isTech, isStudent]);

    const [notifications, setNotifications] = useState([]);
    const [notifLoading, setNotifLoading] = useState(false);
    const [notifError, setNotifError] = useState("");

    const normalizeNotif = (n) => ({
        id: n?.id ?? n?.notification_id,
        message: n?.message ?? n?.text ?? "Notification",
        isRead: n?.isRead ?? n?.is_read ?? false,
        link: n?.link ?? null,
        createdAt: n?.createdAt ?? n?.created_at ?? null,
    });

    const loadNotifications = async () => {
        if (!user) return;
        setNotifLoading(true);
        setNotifError("");
        try {
            const res = await fetch(`${API_BASE}/notifications`, {
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to load notifications");

            const list = Array.isArray(data?.notifications)
                ? data.notifications
                : Array.isArray(data)
                    ? data
                    : [];

            setNotifications(list.map(normalizeNotif));
        } catch (e) {
            setNotifError(e?.message || "Failed to load notifications");
        } finally {
            setNotifLoading(false);
        }
    };

    const markRead = async (id) => {
        if (id == null) return;
        await fetch(`${API_BASE}/notifications/${id}/read`, {
            method: "POST",
            credentials: "include",
        });
    };

    const onClickNotif = async (n) => {
        if (!n) return;
        if (!n.isRead && n.id != null) {
            await markRead(n.id);
        }
        await loadNotifications();
        if (n.link) navigate(n.link);
    };

    useEffect(() => {
        loadNotifications();
    }, [user?.id]);

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.isRead).length,
        [notifications]
    );

    const recentNotifications = useMemo(() => {
        return [...notifications]
            .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
            .slice(0, 5);
    }, [notifications]);

    return (
        <div>
            <div className="card" style={{ marginBottom: 20 }}>
                <h1 className="page-title" style={{ marginBottom: 6 }}>
                    Dashboard
                </h1>
                <p style={{ color: "var(--uw-muted)", marginTop: 0 }}>
                    Welcome back, <strong>{user?.username}</strong>.
                </p>

                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 16,
                        flexWrap: "wrap",
                        alignItems: "center",
                    }}
                >
                    <Link
                        to="/tickets"
                        className="primary-btn"
                        style={{ textDecoration: "none" }}
                    >
                        View Tickets
                    </Link>

                    {(isAdmin || isTech) && (
                        <Link
                            to="/queue"
                            className="secondary-btn"
                            style={{ textDecoration: "none" }}
                        >
                            Open Queue
                        </Link>
                    )}

                    <button onClick={loadNotifications} className="secondary-btn" title="Refresh notifications">
                        Refresh Notifications
                    </button>
                </div>
            </div>

            {isStudent && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 16,
                        marginBottom: 20,
                    }}
                >
                    <StatCard
                        title="My Active Tickets"
                        value={myActiveTickets.length}
                        subtitle="Tickets still being worked on"
                    />
                    <StatCard
                        title="Resolved / Closed"
                        value={myClosedTickets.length}
                        subtitle="Completed tickets"
                    />
                    <StatCard
                        title="Total Tickets"
                        value={myTickets.length}
                        subtitle="All tickets you created"
                    />
                </div>
            )}

            {(isAdmin || isTech) && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 16,
                        marginBottom: 20,
                    }}
                >
                    <StatCard
                        title="Assigned to Me"
                        value={assignedToMe.length}
                        subtitle="Active tickets currently assigned to you"
                    />
                    <StatCard
                        title="Unassigned Active"
                        value={unassignedActive.length}
                        subtitle="Tickets waiting for assignment"
                    />
                    <StatCard
                        title="High Priority Open"
                        value={highPriorityOpen.length}
                        subtitle="Open tickets marked high priority"
                    />
                    <StatCard
                        title="Total Active Tickets"
                        value={activeTickets.length}
                        subtitle="All active tickets in the system"
                    />
                </div>
            )}

            <div className="card" style={{ marginBottom: 20 }}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    <h3 className="page-title" style={{ fontSize: 22, marginBottom: 6 }}>
                        Recent Notifications
                    </h3>
                    <span style={{ fontSize: 13, color: "var(--uw-muted)" }}>
                        Unread: <strong>{unreadCount}</strong>
                    </span>
                </div>

                {notifLoading && <p style={{ color: "var(--uw-muted)" }}>Loading notifications...</p>}
                {notifError && <p style={{ color: "crimson" }}>{notifError}</p>}

                {!notifLoading && !notifError && recentNotifications.length === 0 && (
                    <p style={{ color: "var(--uw-muted)" }}>No notifications yet.</p>
                )}

                {!notifLoading && !notifError && recentNotifications.length > 0 && (
                    <div style={{ display: "grid", gap: 10 }}>
                        {recentNotifications.map((n) => (
                            <div
                                key={n.id}
                                onClick={() => (n.link ? onClickNotif(n) : null)}
                                role={n.link ? "button" : undefined}
                                tabIndex={n.link ? 0 : undefined}
                                onKeyDown={(e) => (n.link && e.key === "Enter" ? onClickNotif(n) : null)}
                                style={{
                                    border: "1px solid var(--uw-border)",
                                    borderRadius: 12,
                                    padding: 12,
                                    background: n.isRead ? "#faf9f7" : "#fff",
                                    cursor: n.link ? "pointer" : "default",
                                    opacity: n.isRead ? 0.88 : 1,
                                }}
                                title={n.link ? "Click to open" : ""}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 12,
                                        alignItems: "center",
                                    }}
                                >
                                    <div style={{ fontWeight: n.isRead ? "normal" : "bold", color: "var(--uw-text)" }}>
                                        {n.message}
                                    </div>
                                    {!n.isRead && (
                                        <span
                                            style={{
                                                fontSize: 12,
                                                padding: "2px 8px",
                                                borderRadius: 999,
                                                background: "var(--uw-purple)",
                                                color: "#fff",
                                            }}
                                        >
                                            New
                                        </span>
                                    )}
                                </div>

                                {n.link ? (
                                    <div style={{ fontSize: 13, color: "var(--uw-muted)", marginTop: 6 }}>
                                        Click to view
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isStudent && (
                <TicketList
                    title="Recent Tickets"
                    tickets={recentRelevantTickets}
                    emptyMessage="You have not created any tickets yet."
                />
            )}

            {(isAdmin || isTech) && (
                <TicketList
                    title="Recent Tickets Requiring Attention"
                    tickets={recentRelevantTickets}
                    emptyMessage="There are no recent tickets to show."
                />
            )}
        </div>
    );
}