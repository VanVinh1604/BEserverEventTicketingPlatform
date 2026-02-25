require("dotenv").config();
const express = require("express");
const cors = require("cors");
const errorHandler = require("./middleware/errorMiddleware");

const app = express();

// ===============================
// GLOBAL MIDDLEWARE
// ===============================
app.use(cors());
app.use(express.json());

// Log request (không log khi test)
if (process.env.NODE_ENV !== "test") {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}


// ===============================
// PUBLIC ROUTES
// ===============================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/tickets", require("./routes/publicTicketRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));


// ===============================
// ADMIN ROUTES
// ===============================
app.use("/api/admin/users", require("./routes/adminUserRoutes"));
app.use("/api/admin/analytics", require("./routes/adminAnalyticsRoutes"));
app.use("/api/admin/events", require("./routes/adminEventRoutes"));
app.use("/api/admin/ticket-types", require("./routes/adminTicketTypeRoutes"));


// ===============================
// STATIC FILES
// ===============================
// app.use("/uploads", express.static("uploads"));


// ===============================
// ROOT CHECK
// ===============================
app.get("/", (req, res) => {
  res.send("🎫 Event Ticketing API is running...");
});


// ===============================
// ERROR HANDLER (LUÔN CUỐI CÙNG)
// ===============================
app.use(errorHandler);

module.exports = app;