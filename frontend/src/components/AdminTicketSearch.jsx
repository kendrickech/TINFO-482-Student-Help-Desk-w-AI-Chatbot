import { useState } from "react";
import { Link, useParams } from "react-router-dom";

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

function AdminTicketSearch({ user }) {
  const [searchValue, setSearchValue] = useState("");
  const [tickets, setTickets] = useState([]);
  const [message, setMessage] = useState("");

const handleSearch = async () => {
  if (!searchValue.trim()) {
    setMessage("Please enter a student # or email");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:5000/tickets/search-tickets?query=${encodeURIComponent(searchValue)}`,
      {
        credentials: "include", // REQUIRED for session auth
      }
    );

    const data = await response.json();

    console.log("Backend response:", data);

    if (!response.ok) {
      setMessage(data.message || "Server error");
      setTickets([]);
      return;
    }

    if (!Array.isArray(data)) {
      console.error("Unexpected response:", data);
      setTickets([]);
      return;
    }

    if (data.length === 0) {
      setMessage("No tickets found");
      setTickets([]);
    } else {
      setTickets(data);
      setMessage("");
    }

  } catch (error) {
    console.error("Search failed:", error);
    setMessage("Error searching tickets");
    setTickets([]);
  }
};

return (
  <div style={{ maxWidth: 950, margin: "0 auto" }}>
    
    <h2 className="page-title" style={{ marginBottom: 16 }}>
      Search User Tickets
    </h2>

    {/* ADMIN ONLY SEARCH */}
    {user.role === "admin" && (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          
          <input
            type="text"
            placeholder="Enter student # or email"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="select"
            style={{ minWidth: 260 }}
          />

          <button
            onClick={handleSearch}
            className="primary-btn"
          >
            Search
          </button>

        </div>
      </div>
    )}

    {/* Message */}
    {message && (
      <p style={{ color: "var(--uw-muted)", marginBottom: 12 }}>
        {message}
      </p>
    )}

    {/* Results */}
    {tickets.map((ticket) => (
      <Link
        key={ticket.id}
        to={`/tickets/${ticket.id}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div
          className="card"
          style={{
            marginBottom: 12,
            cursor: "pointer",
          }}
        >
          <p><strong>Title:</strong> {ticket.title}</p>

          <p><strong>Description:</strong> {ticket.description}</p>

          <p>
            <strong>Status:</strong>{" "}
            <span className="badge">
              {(ticket.status || "unknown").toUpperCase()}
            </span>
          </p>

          <p><strong>Email:</strong> {ticket.email}</p>

          <p><strong>Student #:</strong> {ticket.ticket_id}</p>
        </div>
      </Link>
    ))}

  </div>
  );
} 
console.log("AdminTicketSearch user:", user);
export default AdminTicketSearch;