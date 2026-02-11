const express = require("express");
const cors = require("cors");

const app = express(); // ✅ tạo app TRƯỚC

const authRoutes = require("./routes/authRoutes"); // require sau cũng được
const testRoutes = require("./routes/testRoutes");
const ticketRoutes = require("./routes/ticketRoutes");


app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log("REQ:", req.method, req.url);
  next();
});

app.use("/api/auth", authRoutes); // ✅ dùng app SAU khi đã tạo
app.use("/api/test", testRoutes);

app.use("/api/admin/events", require("./routes/adminEventRoutes"));
app.use("/api/admin/ticket-types", require("./routes/adminTicketTypeRoutes"));

app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/tickets", ticketRoutes);


app.get("/", (req, res) => {
  res.send("Event Ticketing API is running...");
});

module.exports = app;
