require("dotenv").config();
const express = require("express");
const cors = require("cors");
const errorHandler = require("./middleware/errorMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== "test") {
  app.use((req, res, next) => {
    console.log("REQ:", req.method, req.url);
    next();
  });
}

// --- CÁC ROUTE HỆ THỐNG ---
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/tickets", require("./routes/publicTicketRoutes"));

// --- CÁC ROUTE QUẢN TRỊ (ADMIN) ---
app.use("/api/admin/analytics", require("./routes/adminAnalyticsRoutes"));
app.use("/api/admin/events", require("./routes/adminEventRoutes"));
app.use("/api/admin/ticket-types", require("./routes/adminTicketTypeRoutes"));

// app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Event Ticketing API is running...");
});

app.use(errorHandler);

module.exports = app;