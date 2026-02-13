require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

// ❗ Chỉ connect DB + listen khi KHÔNG phải test
if (process.env.NODE_ENV !== "test") {
  connectDB();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app; // 👈 cho Jest
