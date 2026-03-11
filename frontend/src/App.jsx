import { useEffect, useState, useCallback } from "react";
import { NavLink, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

import Login from "./components/Login";
import Register from "./components/Register";
import Admin from "./components/Admin";
import Tickets from "./components/Tickets";
import TechQueue from "./components/TechQueue";
import TicketDetails from "./components/TicketDetails";
import NotificationBell from "./components/NotificationBell";
import Dashboard from "./components/Dashboard";
import Chatbot from "./components/Chatbot";

const API_BASE = "http://localhost:5000";
const canManageTickets = (u) => u?.role === "admin" || u?.role === "technician";
const canDeleteTickets = (u) => u?.role === "admin";

function NavItem({ to, children }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
        >
            {children}
        </NavLink>
    );
}

function Layout({ user, onLogout, children }) {
    return (
        <div className="app-shell">
            <nav className="topbar">
                <strong className="brand">Help Desk</strong>

                {!user ? (
                    <>
                        <NavItem to="/login">Login</NavItem>
                        <NavItem to="/register">Register</NavItem>
                    </>
                ) : (
                    <>
                        <NavItem to="/dashboard">Dashboard</NavItem>
                        <NavItem to="/tickets">Tickets</NavItem>
                        {(user.role === "admin" || user.role === "technician") && (
                            <NavItem to="/queue">My Queue</NavItem>
                        )}
                        {user.role === "admin" && <NavItem to="/admin">Admin</NavItem>}

                        <div className="nav-right">
                            <span className="user-chip">
                                {user.username} ({user.role})
                            </span>

                            <NotificationBell user={user} />

                            <button onClick={onLogout} className="logout-btn">
                                Log out
                            </button>
                        </div>
                    </>
                )}
            </nav>

            <main className="page">{children}</main>

            {user && <Chatbot />}
        </div>
    );
}

function Home() {
    return (
        <div className="hero">
            <h1>Campus IT Help Desk</h1>
            <p>Submit and manage IT support requests</p>

            <div className="hero-actions">
                <NavLink to="/login" className="primary-btn" style={{ textDecoration: "none" }}>
                    Login
                </NavLink>

                <NavLink to="/register" className="secondary-btn" style={{ textDecoration: "none" }}>
                    Register
                </NavLink>
            </div>
        </div>
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

    const [archivedTickets, setArchivedTickets] = useState([]);
    const [ticketsView, setTicketsView] = useState("active"); // "active" | "archived"

    const navigate = useNavigate();

    const fetchMe = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/me`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));

            if (!res.ok || !data?.authenticated) {
                setUser(null);
                return null;
            }

            const nextUser = {
                id: data.user_id,
                username: data.username ?? "user",
                role: data.user_role ?? "student",
            };

            setUser(nextUser);
            return nextUser;
        } catch {
            setUser(null);
            return null;
        }
    }, []);

    const loadTickets = useCallback(async () => {
        setTicketsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/tickets`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setTickets([]);
                return;
            }

            setTickets(Array.isArray(data.tickets) ? data.tickets : []);
        } finally {
            setTicketsLoading(false);
        }
    }, []);

    const loadArchivedTickets = useCallback(async () => {
        setTicketsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/tickets/archived`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
            setArchivedTickets([]);
            return;
            }

            setArchivedTickets(Array.isArray(data.tickets) ? data.tickets : []);
        } finally {
            setTicketsLoading(false);
        }
    }, []);

    const updateTicket = async (ticketId, updates) => {
        let endpoint = `${API_BASE}/tickets/${ticketId}`;
        let body = {};

        if ("assignedTo" in updates) {
            endpoint = `${API_BASE}/tickets/${ticketId}/assign`;
            body = { assignedTo: updates.assignedTo };
        } else if ("priority" in updates) {
            endpoint = `${API_BASE}/tickets/${ticketId}/priority`;
            body = { priority: updates.priority };
        } else if ("status" in updates) {
            endpoint = `${API_BASE}/tickets/${ticketId}/status`;
            body = { status: updates.status };
        } else {
            throw new Error("No valid ticket update field provided");
        }

        const res = await fetch(endpoint, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to update ticket");

        // assignment route only returns { message: "Assignment updated" }
        // so reload tickets after assignment changes
        if ("assignedTo" in updates) {
            const ticketsRes = await fetch(`${API_BASE}/tickets`, {
                credentials: "include",
            });

            const ticketsData = await ticketsRes.json().catch(() => ({}));
            if (!ticketsRes.ok) throw new Error(ticketsData.error || "Failed to refresh tickets");

            setTickets(ticketsData.tickets || []);
            return data;
        }

        // priority/status routes return a partial ticket, so merge it
        if (data.ticket) {
            setTickets((prev) =>
                prev.map((t) =>
                    t.id === ticketId
                        ? { ...t, ...data.ticket }
                        : t
                )
            );
            return data.ticket;
        }

        return data;
    };

    const createTicket = async ({ title, description, priority }) => {
        const res = await fetch(`${API_BASE}/tickets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ title, description, priority }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to create ticket");

        setTickets((prev) => [...prev, data.ticket]);
    };

    const deleteTicket = async (ticketId) => {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
            method: "DELETE",
            credentials: "include",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to delete ticket");

        setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    };

    const archiveTicket = async (ticketId) => {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}/archive`, {
            method: "PATCH",
            credentials: "include",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to archive ticket");

        // Refresh lists so UI stays correct
        if (ticketsView === "active") {
            await loadTickets();              // ticket disappears from active list
        } else {
            // if somehow archiving while viewing archived list
            await loadArchivedTickets();
        }

        return data;
    };

    const unarchiveTicket = async (ticketId) => {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}/unarchive`, {
            method: "PATCH",
            credentials: "include",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to unarchive ticket");

        // Refresh both lists so it moves correctly
        await loadArchivedTickets();        // ticket disappears from archived list
        await loadTickets();                // ticket appears in active list

        return data;
    };

    const location = useLocation();

    useEffect(() => {
        // whenever you leave the tickets page, snap back to active view
        if (location.pathname !== "/tickets") {
            setTicketsView("active");
        }
    }, [location.pathname]);

    useEffect(() => {
        if (location.pathname === "/tickets" && user) {
            setTicketsView("active");
            loadTickets();
        }
    }, [location.pathname, user, loadTickets]);

    useEffect(() => {
        (async () => {
            setChecking(true);
            const u = await fetchMe();
            setChecking(false);
            if (u) await loadTickets();
        })();
    }, [fetchMe, loadTickets]);

    useEffect(() => {
        if (!user) {
            setTickets([]);
            setArchivedTickets([]);
            setTicketsView("active");
            return;
        }

        setTicketsView("active");
        loadTickets();
    }, [user, loadTickets]);

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
            await fetch(`${API_BASE}/logout`, { method: "POST", credentials: "include" });
        } catch {
            // ignore
        } finally {
            setUser(null);
            setTickets([]);
            navigate("/login", { replace: true });
        }
    };

    const handleToggleArchived = useCallback(
        async (showArchived) => {
            if (showArchived) {
            setTicketsView("archived");
            await loadArchivedTickets();
            } else {
            setTicketsView("active");
            await loadTickets();
            }
        },
        [loadArchivedTickets, loadTickets]
    );

    const assignTicket = async (ticketId, assignedTo) => {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}/assign`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ assignedTo }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to update assignment");

        // refresh list depending on view
        if (ticketsView === "archived") await loadArchivedTickets();
        else await loadTickets();

        return data;
    };

    const claimTicket = async (ticketId) => {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}/claim`, {
            method: "PATCH",
            credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to claim/unclaim");

        if (ticketsView === "archived") await loadArchivedTickets();
        else await loadTickets();

        return data;
    };

    const refreshTickets = useCallback(async () => {
        if (ticketsView === "archived") await loadArchivedTickets();
        else await loadTickets();
    }, [ticketsView, loadArchivedTickets, loadTickets]);

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
                <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute user={user}>
                            <Dashboard user={user} tickets={tickets}/>
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
                                    tickets={ticketsView == "archived" ? archivedTickets : tickets}
                                    onCreateTicket={createTicket}
                                    onDeleteTicket={deleteTicket}
                                    // onUpdateTicket removed
                                    canManage={canManageTickets(user)}
                                    canDelete={canDeleteTickets(user)}
                                    onToggleArchived={handleToggleArchived}
                                    onArchiveTicket={archiveTicket}
                                    onUnarchiveTicket={unarchiveTicket}
                                    onAssignTicket={assignTicket}
                                    onClaimTicket={claimTicket}
                                />
                            </div>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/tickets/:ticketId"
                    element={
                        <ProtectedRoute user={user}>
                            <TicketDetails
                                user={user}
                                onTicketsChanged={refreshTickets}
                                onUpdateTicket={updateTicket}
                                canManage={canManageTickets(user)}
                                canDelete={canDeleteTickets(user)}
                                onDeleteTicket={deleteTicket}
                            />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/queue"
                    element={
                        <ProtectedRoute user={user}>
                            {user && (user.role === "admin" || user.role === "technician") ? (
                                <TechQueue user={user} tickets={tickets} onUpdateTicket={updateTicket} />
                            ) : (
                                <Navigate to="/tickets" replace />
                            )}
                        </ProtectedRoute>
                    }
                />

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