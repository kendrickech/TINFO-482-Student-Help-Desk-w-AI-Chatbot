import { useEffect, useState, useCallback } from "react";

export default function Admin({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // backend expects lowercase values
  const ROLE_OPTIONS = ["student", "technician", "admin"];

  const loadUsers = useCallback(async () => {
    setStatus("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/users", {
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        setStatus(`Could not load users (${res.status}): ${text}`);
        setUsers([]);
        return;
      }

      const data = await res.json();
      console.log("Fetched users:", data);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setStatus(`Could not load users: ${err?.message || "Network error"}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateRole = async (user_id, role) => {
    setStatus("");

    try {
      const res = await fetch(`http://localhost:5000/users/${user_id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const text = await res.text();
        setStatus(`Failed to update role (${res.status}): ${text}`);
        return;
      }

      await loadUsers();
      setStatus("Role updated.");
    } catch (err) {
      setStatus(`Failed to update role: ${err?.message || "Network/CORS error"}`);
    }
  };

  const removeUser = async (user_id) => {
    setStatus("");

    try {
      const res = await fetch(`http://localhost:5000/users/${user_id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        setStatus(`Failed to delete user (${res.status}): ${text}`);
        return;
      }

      await loadUsers();
      setStatus("User deleted.");
    } catch (err) {
      setStatus(`Failed to delete user: ${err?.message || "Network/CORS error"}`);
    }
  };

  if (!currentUser) {
    return (
      <>
        <h1>Admin Panel</h1>
        <p>Loading current user...</p>
      </>
    );
  }

  return (
    <>
      <h1>Admin Panel</h1>
      <p>Manage users (change role: student / technician / admin, delete).</p>

      {status && <p>{status}</p>}

      <button
        onClick={loadUsers}
        disabled={loading}
        style={{ padding: "6px 10px", marginBottom: 12 }}
      >
        {loading ? "Refreshing..." : "Refresh Users"}
      </button>

      {users.length === 0 ? (
        <p style={{ color: "#666" }}>{loading ? "Loading users..." : "No users found."}</p>
      ) : (
        <div style={{ display: "grid", gap: 10, maxWidth: 900 }}>
          {users.map((u) => {
            const isMe = u.username === currentUser.username;

            return (
              <div
                key={u.id}  // ✅ use schema name
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <strong>{u.username}</strong>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Role: <b>{u.role}</b> {/* ✅ use schema name */}
                  </div>
                  {u.email && (
                    <div style={{ fontSize: 12, color: "#666" }}>Email: {u.email}</div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {isMe ? (
                    <span style={{ fontSize: 12, color: "#666" }}>(This is you)</span>
                  ) : (
                    <>
                      <select
                        value={u.role} // ✅ use schema name
                        onChange={(e) => updateRole(u.id, e.target.value)} // ✅ user_id
                        style={{ padding: "6px 10px" }}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => removeUser(u.id)} // ✅ user_id
                        style={{ padding: "6px 10px" }}
                      >
                        Delete User
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
