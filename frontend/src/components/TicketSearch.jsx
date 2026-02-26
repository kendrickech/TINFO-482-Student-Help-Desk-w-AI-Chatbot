const searchTickets = async () => {
  const response = await fetch(
    `http://localhost:5173/admin/search-tickets?query=${searchValue}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  const data = await response.json();
  setTickets(data);
};