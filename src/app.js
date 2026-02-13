require("dotenv").config();

const express = require("express");
const cors = require("cors");



const app = express();

const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");
const ticketRoutes = require("./routes/ticketRoutes");

const errorHandler = require("./middleware/errorMiddleware");

app.use(cors());
app.use(express.json());

// Không log khi test
if (process.env.NODE_ENV !== "test") {
  app.use((req, res, next) => {
    console.log("REQ:", req.method, req.url);
    next();
  });
}

app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);

app.use("/api/admin/events", require("./routes/adminEventRoutes"));
app.use("/api/admin/ticket-types", require("./routes/adminTicketTypeRoutes"));

app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/tickets", ticketRoutes);

app.use("/uploads", express.static("uploads"));
app.use("/api/admin/analytics", require("./routes/adminAnalyticsRoutes"));

app.use(errorHandler);

app.get("/", (req, res) => {
  res.send("Event Ticketing API is running...");
});

module.exports = app;
