// debug-payos.js - Chạy để tìm nguyên nhân chính xác
require('dotenv').config();

console.log("=== DEBUG PAYOS ===\n");

// Bước 1: Kiểm tra package
console.log("1. Kiểm tra package @payos/node:");
try {
  const payosPackage = require("@payos/node");
  console.log("✅ Package tồn tại");
  console.log("📦 Exports:", Object.keys(payosPackage));
  
  // Kiểm tra cấu trúc
  if (payosPackage.PayOS) {
    console.log("✅ PayOS class tồn tại");
  } else {
    console.log("❌ Không tìm thấy PayOS class");
  }
} catch (err) {
  console.log("❌ Lỗi:", err.message);
  console.log("💡 Chạy: npm install @payos/node");
  process.exit(1);
}

// Bước 2: Kiểm tra biến môi trường
console.log("\n2. Kiểm tra .env:");
const vars = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'];
vars.forEach(v => {
  if (process.env[v]) {
    console.log(`✅ ${v}: ${process.env[v].substring(0, 15)}...`);
  } else {
    console.log(`❌ ${v}: THIẾU`);
  }
});

// Bước 3: Test khởi tạo
console.log("\n3. Test khởi tạo PayOS:");
try {
  const { PayOS } = require("@payos/node");
  
  const payos = new PayOS(
    process.env.PAYOS_CLIENT_ID || "test",
    process.env.PAYOS_API_KEY || "test",
    process.env.PAYOS_CHECKSUM_KEY || "test"
  );
  
  console.log("✅ Instance đã tạo");
  console.log("📋 Type của payos:", typeof payos);
  console.log("📋 Constructor:", payos.constructor.name);
  
  // Kiểm tra methods
  const proto = Object.getPrototypeOf(payos);
  const methods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor');
  
  console.log("\n📋 Các methods có sẵn:");
  methods.forEach(m => {
    console.log(`   - ${m} (${typeof payos[m]})`);
  });
  
  // Kiểm tra method cụ thể
  console.log("\n4. Kiểm tra createPaymentLink:");
  if (typeof payos.createPaymentLink === 'function') {
    console.log("✅ createPaymentLink TỒN TẠI");
  } else {
    console.log("❌ createPaymentLink KHÔNG TỒN TẠI");
    console.log("💡 Có thể phiên bản package không đúng");
  }
  
} catch (err) {
  console.log("❌ Lỗi:", err.message);
  console.log("Stack:", err.stack);
}

console.log("\n=== KẾT THÚC ===");
