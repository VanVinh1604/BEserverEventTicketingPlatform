// test-payos-direct.js - Test bằng HTTP method trực tiếp
require('dotenv').config();

const { PayOS } = require("@payos/node");

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

async function testDirectAPI() {
    console.log("🧪 Testing PayOS với HTTP method trực tiếp...\n");

    try {
        const testData = {
            orderCode: Number(String(Date.now()).slice(-6)),
            amount: 10000,
            description: "Test payment",
            cancelUrl: "http://localhost:3000/payment-fail",
            returnUrl: "http://localhost:3000/payment-success",
        };

        console.log("📤 Sending test data:", testData);

        // Thử gọi POST trực tiếp đến endpoint
        const response = await payos.post('/v2/payment-requests', testData);

        console.log("\n✅ SUCCESS!");
        console.log("📋 Response:", response);

    } catch (error) {
        console.error("\n❌ ERROR:");
        console.error("Message:", error.message);
        
        // Thử cách khác: dùng method request
        console.log("\n🔄 Thử cách 2: dùng payos.request()...");
        
        try {
            const response2 = await payos.request({
                method: 'POST',
                path: '/v2/payment-requests',
                body: testData
            });
            
            console.log("\n✅ SUCCESS với request()!");
            console.log("📋 Response:", response2);
            
        } catch (error2) {
            console.error("\n❌ ERROR lần 2:");
            console.error("Message:", error2.message);
            console.error("Stack:", error2.stack);
        }
    }
}

testDirectAPI();
