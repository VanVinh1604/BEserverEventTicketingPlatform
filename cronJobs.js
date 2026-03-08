const cron = require('node-cron');
const Event = require('./src/models/Event');

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