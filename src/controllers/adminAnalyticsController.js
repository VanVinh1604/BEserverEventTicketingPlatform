const Order = require("../models/Order");
const TicketType = require("../models/TicketType");
const Checkin = require("../models/Checkin");
const Ticket = require("../models/Ticket"); // Cần thêm Model Ticket vào đây

exports.getRevenueByEvent = async (req, res, next) => {
  try {
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 10;
    const skip = (page - 1) * limit;

    const revenue = await Order.aggregate([
      { $match: { status: "paid" } },

      {
        $group: {
          _id: "$event",
          totalRevenue: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
        },
      },

      { $sort: { totalRevenue: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    res.json({
      success: true,
      page,
      results: revenue.length,
      data: revenue,
    });
  } catch (err) {
    next(err);
  }
};

// ====== THỐNG KÊ SỐ VÉ (Dashboard) ======
exports.getTicketStats = async (req, res) => {
try{
  const stats = await TicketType.aggregate([
    {
      $project: {
        name: 1,
        event: 1,
        quantity: 1,
        remaining: 1,
        sold: { $subtract: ["$quantity", "$remaining"] },
      },
    },
  ]);

    res.json({ success: true, data: revenue });
  } catch (err) { next(err); }
};

// ====== DANH SÁCH VÉ (Check-in page) ======
exports.getAllTickets = async (req, res, next) => {
  try {
    // 1. Lấy toàn bộ danh sách vé để hiển thị ở bảng "Danh sách điểm danh"
    // Phải dùng .populate để lấy tên sự kiện và thông tin khách hàng
    const allTickets = await Ticket.find()
      .populate("event", "title name")
      .populate("user", "name email")
      .populate("ticketType", "name")
      .sort({ createdAt: -1 });

    // 2. Trả về đúng cấu trúc mà AdminCheckIn.jsx yêu cầu (res.data.data.allTickets)
    res.json({ 
      success: true, 
      data: { 
        allTickets: allTickets 
      } 
    });
  } catch (err) { next(err); }
};

exports.getCheckinStats = async (req, res, next) => {
  try {
    // 1. Đếm tổng số vé hiện có trên toàn hệ thống
    const totalTickets = await Ticket.countDocuments();

    // 2. Đếm tổng số lượt đã check-in (dựa trên bảng Checkin)
    const checkedIn = await Checkin.countDocuments();

    // 3. Thống kê chi tiết theo từng sự kiện (giữ lại logic cũ của bạn)
    const statsByEvent = await Checkin.aggregate([
      {
        $group: {
          _id: "$event",
          totalCheckins: { $sum: 1 },
        },
      },
    ]);

    // Trả về object chứa đầy đủ các con số để Frontend hiển thị lên Dashboard
    res.json({ 
      success: true, 
      data: {
        totalTickets,        // Hiển thị ô "TỔNG VÉ"
        checkedIn,           // Hiển thị ô "ĐÃ CHECK-IN"
        pending: totalTickets - checkedIn, // Hiển thị ô "CHƯA VÀO"
        statsByEvent         // Dữ liệu chi tiết nếu cần vẽ biểu đồ
      } 
    });
  } catch (err) { 
    next(err); 
  }
};