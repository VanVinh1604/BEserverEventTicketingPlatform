// test-payos-final.js - Test với cú pháp đúng v2
require('dotenv').config();

const { PayOS } = require("@payos/node");

// ✅ Constructor v2 - Dùng object
const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

async function testPayOSFinal() {
    console.log("🧪 Test PayOS v2 - Lần cuối...\n");

    try {
        const testData = {
            orderCode: Number(String(Date.now()).slice(-6)),
            amount: 10000,
            description: "Test payment final",
            returnUrl: "http://localhost:3000/payment-success",
            cancelUrl: "http://localhost:3000/payment-fail",
        };

        console.log("📤 Sending:", testData);

        // ✅ Cú pháp đúng v2
        const paymentLink = await payos.paymentRequests.create(testData);

        console.log("\n✅ SUCCESS!");
        console.log("📋 Response:", paymentLink);
        console.log("\n🔗 Checkout URL:", paymentLink.checkoutUrl);
        console.log("\n🎉 PayOS v2 hoạt động hoàn hảo!");

    } catch (error) {
        console.error("\n❌ ERROR:");
        console.error("Message:", error.message);
        if (error.response) {
            console.error("Response:", error.response);
        }
    }
}

testPayOSFinal();
