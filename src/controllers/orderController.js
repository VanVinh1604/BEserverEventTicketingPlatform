const { v4: uuidv4 } = require("uuid");
const TicketType = require("../models/TicketType");
const Order = require("../models/Order");
const Ticket = require("../models/Ticket");
const AppError = require("../utils/AppError");
// XÓA dòng này: const sendEmail = require("../utils/sendEmail");

exports.buyTickets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tickets, ticketTypeId, quantity, eventId, customerInfo } = req.body;

    let items = Array.isArray(tickets) ? tickets : [{ ticketTypeId, quantity }];

    // Validate items
    if (!items || items.length === 0) {
      return next(new AppError("Không có vé nào được chọn!", 400));
    }

    for (const item of items) {
      if (!item.ticketTypeId) {
        return next(new AppError("Thiếu ticketTypeId trong danh sách vé!", 400));
      }
      if (!item.quantity || item.quantity < 1) {
        return next(new AppError("Số lượng vé không hợp lệ!", 400));
      }
    }

    // Tính toán và validate
    let totalAmount = 0;
    let finalEventId = eventId;
    const ticketDataList = [];

    for (const item of items) {
      const ticketType = await TicketType.findById(item.ticketTypeId);
      if (!ticketType) {
        return next(new AppError(`Không tìm thấy loại vé: ${item.ticketTypeId}`, 404));
      }

      const remaining = typeof ticketType.remaining === "number"
        ? ticketType.remaining
        : ticketType.quantity;

      if (remaining < item.quantity) {
        return next(new AppError(`Vé "${ticketType.name}" không đủ số lượng! Còn lại: ${remaining}`, 400));
      }

      finalEventId = ticketType.event;
      totalAmount += ticketType.price * item.quantity;

      ticketDataList.push({ ticketType, quantity: item.quantity, remaining });
    }

    // Tạo Order với status = pending
    const order = await Order.create({
      user: userId,
      event: finalEventId,
      customerInfo,
      totalAmount,
      status: "pending",  // ✅ Pending - chờ thanh toán
    });

    // Tạo Ticket và trừ số lượng
    const createdTicketIds = [];

    for (const { ticketType, quantity, remaining } of ticketDataList) {
      ticketType.remaining = remaining - quantity;
      await ticketType.save();

      for (let i = 0; i < quantity; i++) {
        const ticket = await Ticket.create({
          order: order._id,
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

    order.tickets = createdTicketIds;
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate("event")
      .populate({ path: "tickets", populate: { path: "ticketType" } });

    // ❌ XÓA TOÀN BỘ PHẦN GỬI EMAIL Ở ĐÂY
    // Email sẽ được gửi sau khi thanh toán thành công (trong webhook)

    res.json({ success: true, message: "Đặt vé thành công!", data: populatedOrder });
  } catch (err) {
    next(err);
  }
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
            status: 'pending' 
        });

        await newOrder.save();
        res.status(201).json(newOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};