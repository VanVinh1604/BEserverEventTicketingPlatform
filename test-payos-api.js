// test-payos-api.js - Test thử gọi PayOS API
require('dotenv').config();

const { PayOS } = require("@payos/node");

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

async function testPayOSAPI() {
    console.log("🧪 Testing PayOS API...\n");

    try {
        const testData = {
            orderCode: Number(String(Date.now()).slice(-6)),
            amount: 10000,
            description: "Test payment",
            cancelUrl: "http://localhost:3000/payment-fail",
            returnUrl: "http://localhost:3000/payment-success",
        };

        console.log("📤 Sending test data:", testData);

        // ✅ Cú pháp đúng cho SDK mới
        const response = await payos.PaymentRequests.create(testData);

        console.log("\n✅ SUCCESS!");
        console.log("📋 Response:", response);
        console.log("\n🔗 Checkout URL:", response.checkoutUrl);
        console.log("\n🎉 PayOS hoạt động bình thường!");

    } catch (error) {
        console.error("\n❌ ERROR:");
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
    }
}

testPayOSAPI();
