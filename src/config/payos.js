const { PayOS } = require("@payos/node");

// ✅ V2 Constructor - Dùng object thay vì 3 params riêng
const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

module.exports = payos;