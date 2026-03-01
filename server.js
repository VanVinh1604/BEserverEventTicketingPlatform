require("dotenv").config();
const express = require("express"); 
const app = require("./src/app");
const connectDB = require("./src/config/db");

// 1. PHẢI CÓ DÒNG NÀY ĐẦU TIÊN ĐỂ ĐỌC DỮ LIỆU THANH TOÁN
app.use(express.json()); 

// 2. Sau đó mới đăng ký Route thanh toán
const paymentRoutes = require("./src/routes/paymentRoutes");
app.use("/api/payments", paymentRoutes); 

const PORT = process.env.PORT || 8000;

if (process.env.NODE_ENV !== "test") {
  connectDB();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;