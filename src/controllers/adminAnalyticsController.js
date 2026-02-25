const Order = require("../models/Order");
const TicketType = require("../models/TicketType");
const Checkin = require("../models/Checkin");
const Ticket = require("../models/Ticket");

// GET /api/admin/analytics/revenue
// Trả về doanh thu + tên sự kiện + vé bán + check-in theo từng sự kiện
exports.getRevenueByEvent = async (req, res, next) => {
  try {
    const revenue = await Order.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: "$event",
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
          // Đếm tổng vé trong tất cả đơn (mỗi phần tử mảng tickets = 1 vé)
          ticketsSold: { $sum: { $size: { $ifNull: ["$tickets", []] } } },
        },
      },
      // Populate tên sự kiện từ collection events
      {
        $lookup: {
          from: "events",        // Tên collection trong MongoDB (thường là lowercase + 's')
          localField: "_id",
          foreignField: "_id",
          as: "eventInfo",
        },
      },
      { $unwind: { path: "$eventInfo", preserveNullAndEmptyArrays: true } },
      // Populate số check-in từ collection checkins
      {
        $lookup: {
          from: "checkins",
          localField: "_id",
          foreignField: "event",
          as: "checkinList",
        },
      },
      {
        $project: {
          _id: 1,
          eventName: { $ifNull: ["$eventInfo.title", "$eventInfo.name", "Sự kiện"] },
          totalRevenue: 1,
          totalOrders: 1,
          ticketsSold: 1,
          checkins: { $size: "$checkinList" },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.json({ success: true, data: revenue });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/analytics/tickets
// Trả về toàn bộ danh sách vé cho trang AdminCheckIn
exports.getTicketStats = async (req, res, next) => {
  try {
    const allTickets = await Ticket.find()
      .populate("event", "title name")
      .populate("user", "name email")
      .populate("ticketType", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        allTickets,
        // Thêm thống kê tổng hợp để frontend không phải tự đếm
        totalTickets: allTickets.length,
        checkedIn: allTickets.filter(
          (t) =>
            t.status === "used" ||
            t.status === "checked" ||
            t.isCheckedIn === true ||
            !!t.checkedInAt
        ).length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/analytics/checkins
// Trả về thống kê check-in tổng hợp
exports.getCheckinStats = async (req, res, next) => {
  try {
    const totalTickets = await Ticket.countDocuments();
    const checkedIn = await Checkin.countDocuments();

    const statsByEvent = await Checkin.aggregate([
      {
        $group: {
          _id: "$event",
          totalCheckins: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "events",
          localField: "_id",
          foreignField: "_id",
          as: "eventInfo",
        },
      },
      { $unwind: { path: "$eventInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          eventName: { $ifNull: ["$eventInfo.title", "$eventInfo.name", "Sự kiện"] },
          totalCheckins: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totalTickets,
        checkedIn,
        pending: totalTickets - checkedIn,
        statsByEvent,
      },
    });
  } catch (err) {
    next(err);
  }
};