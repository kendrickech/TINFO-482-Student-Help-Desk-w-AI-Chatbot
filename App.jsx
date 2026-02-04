import { NavLink, Routes, Route, Navigate } from "react-router-dom";

function NavItem({ to, children }) {
    return (
        <NavLink
            to={to}
            style={({ isActive }) => ({
                textDecoration: "none",
                color: "black",
                padding: "8px 10px",
                borderRadius: 10,
                background: isActive ? "#eee" : "transparent",
            })}
        >
            {children}
        </NavLink>
    );
}

function Layout({ children }) {
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
                <NavItem to="/login">Login</NavItem>
                <NavItem to="/dashboard">Dashboard</NavItem>
                <NavItem to="/tickets">Tickets</NavItem>
                <NavItem to="/chat">Chat</NavItem>
            </nav>

            <main style={{ padding: 24 }}>{children}</main>
        </div>
    );
}

function Login() {
    return (
        <div>
            <div>
                <h1 style={{ marginBottom: 8 }}>Campus Help Desk</h1>
                <p style={{ color: "gray", marginBottom: 24 }}>
                    Sign in to access the help desk portal
                </p>

                <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", gap: 6 }}>
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="you@school.edu"
                        />
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="Enter your password"
                        />
                    </div>

                    <button>
                        Log In
                    </button>

                </div>
            </div>
        </div>
    );
}

function Dashboard() {
    return (
        <>
            <h1>Dashboard</h1>
            <p>Placeholder dashboard page.</p>
        </>
    );
}

function Tickets() {
    return (
        <>
            <h1>Tickets</h1>
            <p>Placeholder tickets page.</p>
        </>
    );
}

function Chat() {
    return (
        <>
            <h1>Chat</h1>
            <p>Placeholder chat page.</p>
        </>
    );
}

export default function App() {
    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Layout>
    );
}


