import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:5000";

function StatCard({ title, value, subtitle }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: 14, color: "#666", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: "bold" }}>{value}</div>
      {subtitle ? (
        <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function TicketList({ title, tickets, emptyMessage }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>

      {tickets.length === 0 ? (
        <p style={{ color: "#666" }}>{emptyMessage}</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {tickets.map((t) => (
            <Link
              key={t.id}
              to={`/tickets/${t.id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
                background: "#fafafa",
              }}
            >
              <div style={{ fontWeight: "bold" }}>{t.title}</div>
              <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>
                Status: {t.status} | Priority: {t.priority}
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

  // -----------------------------
  // Tickets (stats + recent list)
  // -----------------------------
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

    const isClosedStatus = (status) =>
      status === "resolved" || status === "closed";

    // Student views
    const myTickets = normalized.filter((t) => t.createdBy === user?.id);
    const myActiveTickets = myTickets.filter((t) => !isClosedStatus(t.status));
    const myClosedTickets = myTickets.filter((t) => isClosedStatus(t.status));

    // Tech/Admin views (active only)
    const activeTickets = normalized.filter((t) => !isClosedStatus(t.status));
    const assignedToMe = activeTickets.filter((t) => t.assignedTo === user?.id);
    const unassignedActive = activeTickets.filter((t) => t.assignedTo == null);
    const highPriorityOpen = activeTickets.filter(
      (t) => t.status === "open" && t.priority === "high"
    );

    let relevant = [];
    if (isStudent) relevant = [...myTickets];
    if (isAdmin || isTech) relevant = [...assignedToMe, ...unassignedActive];

    // Unique + newest first (by id)
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
  }, [tickets, user?.id, isAdmin, isTech, isStudent]);

  // -----------------------------
  // Notifications (recent list)
  // -----------------------------
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 6 }}>Dashboard</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Welcome back, <strong>{user?.username}</strong>.
      </p>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Link
          to="/tickets"
          style={{
            textDecoration: "none",
            padding: "10px 14px",
            borderRadius: 10,
            background: "#111",
            color: "white",
          }}
        >
          View Tickets
        </Link>

        {(isAdmin || isTech) && (
          <Link
            to="/queue"
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 10,
              background: "#e9e9e9",
              color: "black",
            }}
          >
            Open Queue
          </Link>
        )}

        <button
          onClick={loadNotifications}
          style={{
            border: "1px solid #ddd",
            background: "#f5f5f5",
            borderRadius: 10,
            padding: "10px 14px",
            cursor: "pointer",
          }}
          title="Refresh notifications"
        >
          Refresh Notifications
        </button>
      </div>

      {/* Role-based stat cards */}
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

      {/* Recent Notifications */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Recent Notifications</h3>
          <span style={{ fontSize: 13, color: "#666" }}>
            Unread: <strong>{unreadCount}</strong>
          </span>
        </div>

        {notifLoading && <p style={{ color: "#666" }}>Loading notifications...</p>}
        {notifError && <p style={{ color: "crimson" }}>{notifError}</p>}

        {!notifLoading && !notifError && recentNotifications.length === 0 && (
          <p style={{ color: "#666" }}>No notifications yet.</p>
        )}

        {!notifLoading && !notifError && recentNotifications.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {recentNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => (n.link ? onClickNotif(n) : null)}
                role={n.link ? "button" : undefined}
                tabIndex={n.link ? 0 : undefined}
                onKeyDown={(e) =>
                  n.link && e.key === "Enter" ? onClickNotif(n) : null
                }
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 12,
                  background: n.isRead ? "#fafafa" : "#fff",
                  cursor: n.link ? "pointer" : "default",
                  opacity: n.isRead ? 0.85 : 1,
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
                  <div style={{ fontWeight: n.isRead ? "normal" : "bold" }}>
                    {n.message}
                  </div>
                  {!n.isRead && (
                    <span
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#111",
                        color: "#fff",
                      }}
                    >
                      New
                    </span>
                  )}
                </div>

                {n.link ? (
                  <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                    Click to view
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Tickets */}
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