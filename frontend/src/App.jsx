import { useEffect, useState, useCallback } from "react";
import { NavLink, Routes, Route, Navigate, useNavigate } from "react-router-dom";

import Login from "./components/Login";
import Register from "./components/Register";
import Admin from "./components/Admin";
import Tickets from "./components/Tickets";
import TicketDetails from "./components/TicketDetails";

const API_BASE = "http://localhost:5000";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        textDecoration: "none",
        color: "black",
        padding: "8px 10px",
        borderRadius: 10,
        background: isActive ? "lightgray" : "transparent",
      })}
    >
      {children}
    </NavLink>
  );
}

function Layout({ user, onLogout, children }) {
  return (
    <div style={{ fontFamily: "Arial" }}>
      <nav
        style={{
          padding: 16,
          borderBottom: "1px solid #ddd",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <strong style={{ marginRight: 8 }}>Help Desk</strong>

        {!user && (
          <>
            <NavItem to="/login">Login</NavItem>
            <NavItem to="/register">Register</NavItem>
          </>
        )}

        {user && (
          <>
            <NavItem to="/dashboard">Dashboard</NavItem>
            <NavItem to="/tickets">Tickets</NavItem>

            {user.role === "admin" && <NavItem to="/admin">Admin</NavItem>}

            <span style={{ marginLeft: "auto" }}>
              {user.username} ({user.role})
            </span>
            <button onClick={onLogout} style={{ padding: "6px 10px" }}>
              Log out
            </button>
          </>
        )}
      </nav>

      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}

function Home() {
  return (
    <div style={{ textAlign: "center", marginTop: 80 }}>
      <h1>Campus IT Help Desk</h1>
      <p style={{ color: "#555", marginTop: 10 }}>Submit and manage IT support requests</p>

      <div style={{ marginTop: 30, display: "flex", gap: 12, justifyContent: "center" }}>
        <NavLink to="/login">Login</NavLink>

        <NavLink
          to="/register"
          style={{
            background: "white",
            color: "black",
            border: "1px solid #ccc",
            padding: "6px 10px",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Register
        </NavLink>
      </div>
    </div>
  );
}

function Dashboard({ user }) {
  return (
    <>
      <h1>Dashboard</h1>
      <p>Welcome {user.username}!</p>
      <p>Role: {user.role}</p>
    </>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const navigate = useNavigate();

  // --- Session hydrate: /me ---
  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return null;
      }

      const data = await res.json();

      if (data?.authenticated) {
        const nextUser = {
          username: data.username ?? "user",
          role: data.user_role ?? "student",
        };
        setUser(nextUser);
        return nextUser;
      }

      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // --- Load tickets: GET /tickets ---
  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tickets`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // if unauthenticated, clear tickets
        setTickets([]);
        return;
      }

      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  // On first load, check session
  useEffect(() => {
    (async () => {
      setChecking(true);
      const u = await fetchMe();
      setChecking(false);

      // If already logged in, load tickets immediately
      if (u) await loadTickets();
    })();
  }, [fetchMe, loadTickets]);

  // Also reload tickets when user changes (login/logout)
  useEffect(() => {
    if (!user) {
      setTickets([]);
      return;
    }
    loadTickets();
  }, [user, loadTickets]);

  // --- Create ticket: POST /tickets ---
  const createTicket = async ({ title, description, priority }) => {
    const res = await fetch(`${API_BASE}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title, description, priority }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to create ticket");
    }

    // Append the server-created ticket (has id + createdAt + createdBy)
    setTickets((prev) => [...prev, data.ticket]);
  };

  // --- Delete ticket: DELETE /tickets/:id (admin only) ---
  const deleteTicket = async (ticketId) => {
    const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to delete ticket");
    }

    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
  };

  const handleLoginSuccess = useCallback(async () => {
    const u = await fetchMe();
    if (u) {
      navigate("/dashboard", { replace: true });
      await loadTickets();
    }
    return u;
  }, [fetchMe, loadTickets, navigate]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    } finally {
      setUser(null);
      setTickets([]);
      navigate("/login", { replace: true });
    }
  };

  if (checking) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        <Route path="/home" element={<Home />} />

        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLoginSuccess} />}
        />

        <Route
          path="/register"
          element={user ? <Navigate to="/dashboard" replace /> : <Register />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user}>
              <Dashboard user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tickets"
          element={
            <ProtectedRoute user={user}>
              <div>
                {ticketsLoading && <p style={{ color: "#666" }}>Loading tickets...</p>}
                <Tickets
                  user={user}
                  tickets={tickets}
                  onCreateTicket={createTicket}
                  onDeleteTicket={deleteTicket}
                />
              </div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tickets/:ticketId"
          element={
            <ProtectedRoute user={user}>
              <TicketDetails user={user} onTicketsChanged={loadTickets} />
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={<Navigate to="/tickets" replace />} />

        <Route
          path="/admin"
          element={
            <AdminRoute user={user}>
              <Admin currentUser={user} />
            </AdminRoute>
          }
        />

        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Layout>
  );
}
