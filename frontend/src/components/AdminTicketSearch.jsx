import { useState } from "react";

function AdminTicketSearch() {
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
      `http://localhost:5000/tickets/search-tickets?query=${searchValue}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
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
    <div style={{ padding: "20px" }}>
      <h2>Search User Tickets</h2>

      {/* Input + Button */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter student # or email"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          style={{
            padding: "8px",
            width: "250px",
            marginRight: "10px",
            border: "1px solid gray",
          }}
        />

        <button
          onClick={handleSearch}
          style={{
            padding: "8px 15px",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>

      {/* Message */}
      {message && <p>{message}</p>}

      {/* Results */}
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <p><strong>Title:</strong> {ticket.title}</p>
          <p><strong>Description:</strong> {ticket.description}</p>
          <p><strong>Status:</strong> {ticket.status}</p>
          <p><strong>Email:</strong> {ticket.email}</p>
          <p><strong>Student #:</strong> {ticket.student_number}</p>
        </div>
      ))}
    </div>
  );
}

export default AdminTicketSearch;