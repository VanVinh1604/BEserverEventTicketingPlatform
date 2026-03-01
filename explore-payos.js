// explore-payos.js - Khám phá toàn bộ cấu trúc PayOS
require('dotenv').config();

const { PayOS } = require("@payos/node");

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

console.log("🔍 KHÁM PHÁ CẤU TRÚC PAYOS\n");

console.log("1️⃣ Type của payos:", typeof payos);
console.log("2️⃣ Constructor:", payos.constructor.name);

console.log("\n3️⃣ Tất cả properties trực tiếp trên instance:");
const ownProps = Object.getOwnPropertyNames(payos);
ownProps.forEach(prop => {
  const value = payos[prop];
  const type = typeof value;
  console.log(`   - ${prop}: ${type}`);
  
  // Nếu là object, xem thêm chi tiết
  if (type === 'object' && value !== null) {
    const subProps = Object.getOwnPropertyNames(value);
    if (subProps.length > 0) {
      console.log(`     └─ Sub-properties:`, subProps.slice(0, 5).join(', '));
    }
  }
});

console.log("\n4️⃣ Tất cả methods trên prototype:");
const proto = Object.getPrototypeOf(payos);
const methods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor');
methods.forEach(method => {
  console.log(`   - ${method}()`);
});

console.log("\n5️⃣ Kiểm tra các thuộc tính có thể là resources:");
const possibleResources = [
  'PaymentRequests', 'paymentRequests', 'payment', 'payments',
  'Invoices', 'invoices', 'Payouts', 'payouts',
  'createPaymentLink', 'createPayment', 'create'
];

console.log("Kiểm tra từng resource:");
possibleResources.forEach(name => {
  if (payos[name] !== undefined) {
    const type = typeof payos[name];
    console.log(`   ✅ payos.${name}: ${type}`);
    
    if (type === 'object' || type === 'function') {
      const keys = Object.keys(payos[name]);
      if (keys.length > 0) {
        console.log(`      └─ Keys:`, keys.slice(0, 5).join(', '));
      }
    }
  }
});

console.log("\n6️⃣ Thử gọi các methods POST trực tiếp:");
console.log("   - payos.post:", typeof payos.post);

console.log("\n7️⃣ Đọc documentation từ class:");
const payosClass = require("@payos/node").PayOS;
console.log("   - Static methods:", Object.getOwnPropertyNames(payosClass).filter(m => m !== 'length' && m !== 'name' && m !== 'prototype'));

console.log("\n=== KẾT THÚC KHÁM PHÁ ===");
