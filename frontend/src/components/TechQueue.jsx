import { useMemo } from "react";
import { Link } from "react-router-dom";

export default function TechQueue({ user, tickets = [], onUpdateTicket }) {
  const { assignedToMe, unassigned, highPriorityOpen } = useMemo(() => {
    const assignedToMe = [];
    const unassigned = [];
    const highPriorityOpen = [];

    for (const t of tickets) {
      const status = (t.status || "open").toLowerCase();
      const priority = (t.priority || "low").toLowerCase();

      if (t.assignedTo === user?.id) assignedToMe.push(t);
      if (t.assignedTo == null) unassigned.push(t);
      if (status === "open" && priority === "high") highPriorityOpen.push(t);
    }

    const byNewest = (a, b) => (b.id ?? 0) - (a.id ?? 0);

    return {
      assignedToMe: assignedToMe.sort(byNewest),
      unassigned: unassigned.sort(byNewest),
      highPriorityOpen: highPriorityOpen.sort(byNewest),
    };
  }, [tickets, user?.id]);

  const Section = ({ title, items }) => (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
      <h3 style={{ marginTop: 0 }}>
        {title} <span style={{ color: "#666", fontWeight: "normal" }}>({items.length})</span>
      </h3>

      {items.length === 0 ? (
        <p style={{ color: "#666" }}>Nothing here.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((t) => (
            <div key={t.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <strong>
                  <Link to={`/tickets/${t.id}`} style={{ textDecoration: "none" }}>
                    #{t.id} - {t.title}
                  </Link>
                </strong>
                <span style={{ fontSize: 12, color: "#666" }}>
                  {String(t.priority || "low").toUpperCase()} | {t.status || "open"}
                </span>
              </div>

              <div style={{ color: "#555", marginTop: 6 }}>{t.description}</div>

                  {t.assignedTo == null && onUpdateTicket && user?.id && (
                      <button
                          onClick={() => onUpdateTicket(t.id, { assignedTo: user.id })}
                          style={{ padding: "6px 10px", marginTop: 10 }}
                      >
                          Claim
                      </button>
                  )}
                  {t.assignedTo === user?.id && onUpdateTicket && (
                      <button
                          onClick={() => onUpdateTicket(t.id, { assignedTo: null })}
                          style={{ padding: "6px 10px", marginTop: 10 }}
                      >
                          Unclaim
                      </button>
                  )}
              <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
                Created by: <b>{t.createdBy}</b>{" |"}
                {t.assignedUsername ? (
                  <> Assigned: <b>{t.assignedUsername}</b></>
                ) : (
                  <> Assigned: <b>Unassigned</b></>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <h1>My Queue</h1>
      <p style={{ color: "#666" }}>
        Signed in as {user?.username} ({user?.role})
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <Section title="Assigned to me" items={assignedToMe} />
        <Section title="Unassigned" items={unassigned} />
        <Section title="High priority open" items={highPriorityOpen} />
      </div>
    </div>
  );
}