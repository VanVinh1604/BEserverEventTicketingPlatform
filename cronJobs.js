const cron = require('node-cron');
const Event = require('./src/models/Event');
const { cancelExpiredPendingOrders } = require('./src/controllers/orderController');

const PENDING_ORDER_CLEANUP_INTERVAL_MS = 10 * 1000;
let isCleaningPendingOrders = false;

cron.schedule('5 0 * * *', async () => {
  try {
    const now = new Date();
    const result = await Event.updateMany(
      { status: 'active', endDate: { $lt: now } },
      { $set: { status: 'ended' } }
    );
    console.log(`[CRON] Cập nhật ${result.modifiedCount} sự kiện → ended`);
  } catch (err) {
    console.error('[CRON] Lỗi:', err);
  }
});

const runPendingOrderCleanup = async () => {
  if (isCleaningPendingOrders) return;

  isCleaningPendingOrders = true;
  try {
    const result = await cancelExpiredPendingOrders();
    if (result.cancelled > 0) {
      console.log(
        `[CLEANUP] Đã huỷ ${result.cancelled}/${result.found} order pending quá hạn`
      );
    }
  } catch (err) {
    console.error('[CLEANUP] Lỗi dọn order pending:', err.message);
  } finally {
    isCleaningPendingOrders = false;
  }
};

setTimeout(runPendingOrderCleanup, 5000);
setInterval(runPendingOrderCleanup, PENDING_ORDER_CLEANUP_INTERVAL_MS);
