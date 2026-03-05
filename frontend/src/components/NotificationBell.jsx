import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:5000";

export default function NotificationBell({ user }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [error, setError] = useState("");

    const boxRef = useRef(null);

    const load = async () => {
        if (!user) return;
        try {
        setError("");
        const res = await fetch(`${API_BASE}/notifications?limit=30`, {
            credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load notifications");
        const notifs = data.notifications || [];
        setItems(notifs);
        setUnread(notifs.filter((n) => !n.isRead).length);
        } catch (e) {
        setError(e.message);
        }
    };

    const markRead = async (id) => {
        await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
        }).catch(() => {});
    };

    useEffect(() => {
        if (!user) return;
        load();
        const id = setInterval(load, 5000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        const onDown = (e) => {
        if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, []);

    const onClickNotif = async (n) => {
        setOpen(false);

        if (!n.isRead) {
            // update UI immediately
            setItems((prev) =>
                prev.map((i) =>
                    i.id === n.id ? { ...i, isRead: true } : i
                )
            );

            setUnread((prev) => Math.max(prev - 1, 0));

            // update backend in background
            markRead(n.id).catch(() => {});
        }

        if (n.link) navigate(n.link);

        // optional: refresh notifications after navigation
        load();
    };

  if (!user) return null;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button
        onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) load();
        }}
        style={{
            border: "1px solid #ddd",
            background: "white",
            borderRadius: 10,
            padding: "6px 10px",
            cursor: "pointer",
            position: "relative",
        }}
        aria-label="Notifications"
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span
            style={{
                position: "absolute",
                top: -6,
                right: -6,
                minWidth: 18,
                height: 18,
                padding: "0 6px",
                borderRadius: 999,
                background: "crimson",
                color: "white",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: "18px",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
                position: "absolute",
                right: 0,
                marginTop: 8,
                width: 340,
                maxHeight: 420,
                overflow: "auto",
                background: "white",
                border: "1px solid #ddd",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                padding: 10,
                zIndex: 999,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Notifications</strong>
            <button onClick={() => setOpen(false)} style={{ border: "none", background: "transparent" }}>
                ✕
            </button>
          </div>

          {error && <div style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{error}</div>}

          {items.length === 0 ? (
                <div style={{ padding: 12, color: "#666" }}>No notifications yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {items.map((n) => (
                <button
                    key={n.id}
                    onClick={() => onClickNotif(n)}
                    style={{
                            textAlign: "left",
                            border: "1px solid #eee",
                            background: n.isRead ? "white" : "#f3f6ff",
                            borderRadius: 10,
                            padding: 10,
                            cursor: "pointer",
                    }}
                >
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{n.type}</div>
                    <div style={{ fontSize: 14 }}>{n.message}</div>
                    {n.createdAt && (
                            <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                                {new Date(n.createdAt).toLocaleString()}
                            </div>
                    )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}