const { v4: uuidv4 } = require("uuid");
const TicketType = require("../models/TicketType");
const Order = require("../models/Order");
const Ticket = require("../models/Ticket");
const AppError = require("../utils/AppError");
const sendEmail = require("../utils/sendEmail");
const APIFeatures = require("../middleware/apiFeatures");


// =============================================
// 🔥 BUY TICKETS
// =============================================
exports.buyTickets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tickets, ticketTypeId, quantity, customerInfo } = req.body;

    // Hỗ trợ mua 1 hoặc nhiều loại vé
    const items = Array.isArray(tickets)
      ? tickets
      : [{ ticketTypeId, quantity }];

    if (!items || items.length === 0) {
      return next(new AppError("Không có vé nào được chọn", 400));
    }

    let totalAmount = 0;
    let finalEventId = null;
    const createdTicketIds = [];

    // 🔥 Anti oversell (atomic update)
    for (const item of items) {
      const ticketType = await TicketType.findOneAndUpdate(
        {
          _id: item.ticketTypeId,
          remaining: { $gte: item.quantity },
        },
        {
          $inc: { remaining: -item.quantity },
        },
        { new: true }
      ).populate("event");

      if (!ticketType) {
        throw new AppError("Vé không đủ số lượng hoặc đã bán hết", 400);
      }

      finalEventId = ticketType.event._id;
      totalAmount += ticketType.price * item.quantity;

      for (let i = 0; i < item.quantity; i++) {
        const ticket = await Ticket.create({
          order: null, // gán sau
          user: userId,
          event: finalEventId,
          ticketType: ticketType._id,
          price: ticketType.price,
          qrCode: uuidv4(),
          status: "active",
        });

        createdTicketIds.push(ticket._id);
      }
    }

    // 🔥 Tạo Order
    const order = await Order.create({
      user: userId,
      event: finalEventId,
      customerInfo,
      totalAmount,
      status: "paid",
      tickets: createdTicketIds,
    });

    // 🔥 Gắn order vào ticket
    await Ticket.updateMany(
      { _id: { $in: createdTicketIds } },
      { order: order._id }
    );

    // 🔥 Populate để trả về frontend
    const populatedOrder = await Order.findById(order._id)
      .populate("event")
      .populate({
        path: "tickets",
        populate: { path: "ticketType" },
      });

    // 🔥 Gửi email xác nhận
    if (customerInfo?.email) {
      try {
        const eventTitle =
          populatedOrder.event?.title ||
          populatedOrder.event?.name ||
          "Sự kiện";

        const emailContent = `
          <div style="font-family: Arial; padding:20px;">
            <h2 style="color:#ea580c;">🎉 Đặt vé thành công!</h2>
            <p>Chào <b>${customerInfo.fullName || "Khách hàng"}</b>,</p>
            <p>Mã đơn hàng: ${order._id}</p>
            <p>Sự kiện: ${eventTitle}</p>
            <p>Số lượng vé: ${createdTicketIds.length}</p>
            <p>Vui lòng vào mục <b>Vé của tôi</b> để lấy mã QR.</p>
          </div>
        `;

        await sendEmail({
          email: customerInfo.email,
          subject: "TicketHub - Xác nhận đặt vé thành công!",
          html: emailContent,
        });
      } catch (e) {
        console.error("Email error:", e);
      }
    }

    res.json({
      success: true,
      message: "Đặt vé thành công!",
      data: populatedOrder,
    });

  } catch (err) {
    next(err);
  }
};



// =============================================
// 🔥 GET MY ORDERS (có filter / sort / paginate)
// =============================================
exports.getMyOrders = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      Order.find({ user: req.user.id })
        .populate("event")
        .populate({
          path: "tickets",
          populate: { path: "ticketType" },
        }),
      req.query
    )
      .filter()
      .sort()
      .paginate();

    const orders = await features.query;

    res.json({
      success: true,
      results: orders.length,
      data: orders,
    });

  } catch (err) {
    next(err);
  }
};



// =============================================
// 🔥 ADMIN - GET ALL ORDERS
// =============================================
exports.getAllOrdersAdmin = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("event")
      .populate("user")
      .populate({
        path: "tickets",
        populate: { path: "ticketType" },
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      results: orders.length,
      data: orders,
    });

  } catch (err) {
    next(err);
  }
};
