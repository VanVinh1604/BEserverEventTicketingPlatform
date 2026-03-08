require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../src/models/Event');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const now = new Date();

  const expired = await Event.updateMany(
    { status: { $exists: false }, endDate: { $lt: now } },
    { $set: { status: 'ended' } }
  );

  const active = await Event.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'active' } }
  );

  console.log(`Đã patch: ${expired.modifiedCount} ended, ${active.modifiedCount} active`);
  mongoose.disconnect();
}

run();