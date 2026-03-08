const { v4: uuidv4 } = require("uuid");
const TicketType = require("../models/TicketType");
const Order = require("../models/Order");
const Ticket = require("../models/Ticket");
const AppError = require("../utils/AppError");

exports.buyTickets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tickets, ticketTypeId, quantity, eventId, customerInfo } = req.body;

    let items = Array.isArray(tickets) ? tickets : [{ ticketTypeId, quantity }];

    if (!items || items.length === 0) {
      return next(new AppError("Không có vé nào được chọn!", 400));
    }

    for (const item of items) {
      if (!item.ticketTypeId) {
        return next(new AppError("Thiếu ticketTypeId!", 400));
      }
      if (!item.quantity || item.quantity < 1) {
        return next(new AppError("Số lượng vé không hợp lệ!", 400));
      }
    }

    let totalAmount = 0;
    let finalEventId = eventId;
    const lockedItems = []; // track những gì đã lock để rollback nếu cần

    // ── ATOMIC LOCK từng loại vé ──────────────────────────────
    for (const item of items) {
      const updated = await TicketType.findOneAndUpdate(
        {
          _id: item.ticketTypeId,
          // Chỉ update nếu còn đủ vé (atomic check + update)
          $expr: {
            $gte: [
              { $ifNull: ["$remaining", { $subtract: ["$quantity", { $ifNull: ["$sold", 0] }] }] },
              item.quantity
            ]
          }
        },
        { $inc: { remaining: -item.quantity, sold: item.quantity } },
        { new: true }
      );

      if (!updated) {
        // Rollback các vé đã lock trước đó
        for (const locked of lockedItems) {
          await TicketType.findByIdAndUpdate(
            locked.ticketTypeId,
            { $inc: { remaining: locked.quantity, sold: -locked.quantity } }
          );
        }
        // Lấy tên vé để báo lỗi rõ hơn
        const tt = await TicketType.findById(item.ticketTypeId);
        return next(new AppError(
          `Vé "${tt?.name || item.ticketTypeId}" đã hết hoặc không đủ số lượng!`,
          400
        ));
      }

      lockedItems.push({ ticketTypeId: item.ticketTypeId, quantity: item.quantity });
      finalEventId = updated.event || finalEventId;
      totalAmount += updated.price * item.quantity;
    }

    // ── TẠO ORDER (pending) ───────────────────────────────────
    // Chưa tạo Ticket ở đây — đợi thanh toán xong
    const order = await Order.create({
      user: userId,
      event: finalEventId,
      customerInfo,
      totalAmount,
      status: "pending",
      // Lưu items để sau thanh toán biết tạo Ticket gì
      pendingItems: items.map(i => ({
        ticketTypeId: i.ticketTypeId,
        quantity: i.quantity,
      })),
    });

    const populatedOrder = await Order.findById(order._id).populate("event");

    res.json({ success: true, message: "Đặt vé thành công!", data: populatedOrder });
  } catch (err) {
    next(err);
  }
};

// ── GỌI HÀM NÀY SAU KHI THANH TOÁN THÀNH CÔNG ───────────────
exports.fulfillOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order || order.status === "paid") return;

  const createdTicketIds = [];

  for (const item of order.pendingItems || []) {
    for (let i = 0; i < item.quantity; i++) {
      const ticket = await Ticket.create({
        order: order._id,
        user: order.user,
        event: order.event,
        ticketType: item.ticketTypeId,
        price: (await TicketType.findById(item.ticketTypeId))?.price || 0,
        qrCode: uuidv4(),
        status: "active",
      });
      createdTicketIds.push(ticket._id);
    }
  }

  order.tickets = createdTicketIds;
  order.status = "paid";
  await order.save();

  return order;
};

// ── RELEASE VÉ KHI THANH TOÁN THẤT BẠI / HẾT HẠN ────────────
exports.cancelOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order || order.status !== "pending") return;

  for (const item of order.pendingItems || []) {
    await TicketType.findByIdAndUpdate(
      item.ticketTypeId,
      { $inc: { remaining: item.quantity, sold: -item.quantity } }
    );
  }

  order.status = "cancelled";
  await order.save();
  return order;
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .populate("event")
      .populate({ path: "tickets", populate: { path: "ticketType" } })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllOrdersAdmin = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("event")
      .populate("user")
      .populate("tickets")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { paymentMethod, ...otherData } = req.body;
    const newOrder = new Order({
      ...otherData,
      paymentMethod,
      status: "pending",
    });
    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};