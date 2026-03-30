const { v4: uuidv4 } = require("uuid");
const TicketType = require("../models/TicketType");
const Order = require("../models/Order");
const Ticket = require("../models/Ticket");
const AppError = require("../utils/AppError");

const QUICK_RELEASE_TIMEOUT_MS = 30 * 1000;
const STUCK_PAYMENT_TIMEOUT_MS = 15 * 60 * 1000;

const populateOrderWithDetails = async (orderId) =>
  Order.findById(orderId)
    .populate("event")
    .populate({ path: "tickets", populate: { path: "ticketType" } });

const getTicketTypeLabel = (ticketTypeDoc, fallbackId) =>
  ticketTypeDoc?.name || String(fallbackId || "unknown_ticket_type");

const formatRefundTicketSummary = async (pendingItems = []) => {
  const safeItems = Array.isArray(pendingItems) ? pendingItems : [];
  const lines = [];

  for (const item of safeItems) {
    const qty = Number(item?.quantity) || 0;
    const ticketTypeId = item?.ticketTypeId;
    if (!ticketTypeId || qty <= 0) continue;

    let ticketName = String(ticketTypeId);
    try {
      const ticketType = await TicketType.findById(ticketTypeId).select("name");
      if (ticketType?.name) ticketName = ticketType.name;
    } catch {
      // giữ fallback ticketTypeId
    }

    lines.push(`${ticketName} x${qty}`);
  }

  return lines;
};

/**
 * Huỷ / hoàn tiền một đơn hàng.
 * - pending  → cancelled  (hoàn vé remaining)
 * - paid     → refunded   (không thay đổi remaining vì vé đã xuất)
 * - các trạng thái khác   → bỏ qua (idempotent)
 */
const cancelOrRefundOrderById = async (orderId, reason = "manual_cancel") => {
  const order = await Order.findById(orderId);
  if (!order) return { cancelled: false, order: null };

  console.log(
    `[REFUND][ORDER] start order=${orderId} | status=${order.status} | reason=${reason}`
  );

  if (order.status === "pending") {
    const refundedTicketLines = await formatRefundTicketSummary(order.pendingItems || []);
    let totalRefundedTickets = 0;

    // Hoàn vé cho đơn pending
    for (const item of order.pendingItems || []) {
      const beforeTicketType = await TicketType.findById(item.ticketTypeId).select("name remaining");
      const beforeRemaining = Number(beforeTicketType?.remaining) || 0;

      await TicketType.findByIdAndUpdate(item.ticketTypeId, {
        $inc: { remaining: item.quantity },
      });

      const afterTicketType = await TicketType.findById(item.ticketTypeId).select("remaining");
      const afterRemaining = Number(afterTicketType?.remaining) || 0;

      console.log(
        `[REFUND][STOCK] order=${orderId} | ticketType=${getTicketTypeLabel(beforeTicketType, item.ticketTypeId)} | +${Number(item?.quantity) || 0} | remaining ${beforeRemaining} -> ${afterRemaining}`
      );

      totalRefundedTickets += Number(item?.quantity) || 0;
    }
    await Order.findByIdAndUpdate(orderId, {
      $set: { status: "cancelled", cancelReason: reason },
    });
    console.log(`[REFUND][ORDER] ${orderId} pending -> cancelled | reason=${reason} | refundedTickets=${totalRefundedTickets}`);
    if (refundedTicketLines.length > 0) {
      console.log(`[REFUND][DETAIL] ${orderId} | ${refundedTicketLines.join(" | ")}`);
    }
    const updated = await Order.findById(orderId);
    return { cancelled: true, order: updated };
  }

  if (order.status === "paid") {
    // Đánh dấu refunded (tiền hoàn qua cổng thanh toán xử lý ngoài hệ thống)
    await Order.findByIdAndUpdate(orderId, {
      $set: { status: "refunded", cancelReason: reason },
    });
    const ticketCount = Array.isArray(order.tickets) ? order.tickets.length : 0;
    console.log(
      `[REFUND][ORDER] ${orderId} paid -> refunded | reason=${reason} | issuedTickets=${ticketCount} | user=${order.user} | event=${order.event}`
    );
    const updated = await Order.findById(orderId);
    return { cancelled: true, order: updated };
  }

  // cancelled / refunded / ... → idempotent
  return { cancelled: false, order: order };
};

// Giữ tên cũ để cronJobs / các nơi import không bị break
const cancelPendingOrderById = cancelOrRefundOrderById;

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
    const lockedItems = [];

    // ── ATOMIC LOCK từng loại vé ──────────────────────────────
    for (const item of items) {
      const updated = await TicketType.findOneAndUpdate(
        {
          _id: item.ticketTypeId,
          remaining: { $gte: item.quantity } // chỉ update nếu còn đủ vé
        },
        { $inc: { remaining: -item.quantity } },
        { new: true }
      );

      if (!updated) {
        // Rollback tất cả vé đã lock trước đó
        for (const locked of lockedItems) {
          await TicketType.findByIdAndUpdate(
            locked.ticketTypeId,
            { $inc: { remaining: locked.quantity } }
          );
        }
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
    // Chưa tạo Ticket — đợi thanh toán xong mới tạo trong fulfillOrder
    const order = await Order.create({
      user: userId,
      event: finalEventId,
      customerInfo,
      totalAmount,
      status: "pending",
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

// ── GỌI SAU KHI THANH TOÁN THÀNH CÔNG ───────────────────────
exports.fulfillOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error(`Không tìm thấy order: ${orderId}`);

  // Idempotent — nếu đã paid rồi thì trả về luôn, không tạo lại
  if (order.status === "paid") {
    return await populateOrderWithDetails(orderId);
  }

  if (order.status !== "pending") {
    throw new Error(
      `Order ${orderId} không ở trạng thái pending (hiện tại: ${order.status})`
    );
  }

  const createdTicketIds = [];

  for (const item of order.pendingItems || []) {
    const ticketType = await TicketType.findById(item.ticketTypeId);
    if (!ticketType) {
      throw new Error(`Không tìm thấy loại vé: ${item.ticketTypeId}`);
    }

    for (let i = 0; i < item.quantity; i++) {
      const ticket = await Ticket.create({
        order: order._id,
        user: order.user,
        event: order.event,
        ticketType: item.ticketTypeId,
        price: ticketType?.price || 0,
        qrCode: uuidv4(),
        status: "active",
      });
      createdTicketIds.push(ticket._id);
    }
  }

  order.tickets = createdTicketIds;
  order.status = "paid";
  await order.save();

  return await populateOrderWithDetails(order._id);
};

// ── GỌI KHI THANH TOÁN THẤT BẠI / HẾT HẠN ──────────────────
exports.cancelOrder = async (orderId, reason = "manual_cancel") => {
  const { order } = await cancelPendingOrderById(orderId, reason);
  return order;
};

exports.cancelPendingOrder = async (req, res, next) => {
  try {
    const requestOrderId = req.params.orderId || req.body.orderId;
    const reason = req.body.reason || "manual_cancel";
    const requesterId = req.user?.id || req.user?._id;
    const requesterRole = req.user?.role;
    const isAdmin = requesterRole === "admin";

    if (!requestOrderId) {
      return next(new AppError("Thiếu orderId", 400));
    }

    const order = await Order.findById(requestOrderId);
    if (!order) {
      return next(new AppError("Không tìm thấy đơn hàng", 404));
    }

    const isOwner = String(order.user) === String(requesterId);

    if (!isOwner && !isAdmin) {
      return next(new AppError("Bạn không có quyền hủy đơn này", 403));
    }

    // Admin bypass: bỏ qua giới hạn 30s/15m
    if (!isAdmin) {
      const paymentInitiatedAgeMs = order.paymentInitiatedAt
        ? Date.now() - new Date(order.paymentInitiatedAt).getTime()
        : null;
      const paymentCancelledAgeMs = order.paymentCancelledAt
        ? Date.now() - new Date(order.paymentCancelledAt).getTime()
        : null;

      if (
        reason === "unpaid_after_30_seconds" &&
        order.paymentInitiatedAt &&
        !order.paymentCancelledAt &&
        paymentInitiatedAgeMs < STUCK_PAYMENT_TIMEOUT_MS
      ) {
        return res.status(200).json({
          success: true,
          message: "Đơn đã vào luồng thanh toán, sẽ tự huỷ sau 15 phút nếu chưa hoàn tất",
          data: order,
        });
      }

      if (
        reason === "unpaid_after_30_seconds" &&
        order.paymentCancelledAt &&
        paymentCancelledAgeMs < QUICK_RELEASE_TIMEOUT_MS
      ) {
        return res.status(200).json({
          success: true,
          message: "Đơn vừa huỷ thanh toán, hệ thống sẽ hoàn vé trong vòng 30 giây",
          data: order,
        });
      }
    }

    const result = await cancelPendingOrderById(requestOrderId, reason);

    if (!result.cancelled) {
      return res.status(200).json({
        success: true,
        message: `Đơn hiện đã ở trạng thái ${result.order?.status || "không xác định"}`,
        data: result.order,
      });
    }

    const finalStatus = result.order?.status;
    const msg = finalStatus === "refunded"
      ? "Đã đánh dấu hoàn tiền đơn hàng thành công"
      : "Đã hủy đơn và hoàn vé thành công";

    return res.status(200).json({
      success: true,
      message: msg,
      data: result.order,
    });
  } catch (err) {
    next(err);
  }
};

exports.cancelExpiredPendingOrders = async () => {
  const now = Date.now();
  const quickCutoff = new Date(now - QUICK_RELEASE_TIMEOUT_MS);
  const stuckCutoff = new Date(now - STUCK_PAYMENT_TIMEOUT_MS);

  const expiredOrders = await Order.find({
    status: "pending",
    $or: [
      { paymentInitiatedAt: { $exists: false }, createdAt: { $lte: quickCutoff } },
      { paymentInitiatedAt: null, createdAt: { $lte: quickCutoff } },
      { paymentCancelledAt: { $lte: quickCutoff } },
      {
        $and: [
          { paymentInitiatedAt: { $lte: stuckCutoff } },
          {
            $or: [
              { paymentCancelledAt: { $exists: false } },
              { paymentCancelledAt: null },
            ],
          },
        ],
      },
    ],
  }).select("_id paymentInitiatedAt paymentCancelledAt");

  let cancelledCount = 0;

  for (const pendingOrder of expiredOrders) {
    const reason = pendingOrder.paymentCancelledAt
      ? "cancelled_on_gateway_over_30_seconds"
      : pendingOrder.paymentInitiatedAt
      ? "pending_over_15_minutes"
      : "unpaid_after_30_seconds";

    const result = await cancelPendingOrderById(
      pendingOrder._id.toString(),
      reason
    );

    if (result.cancelled) cancelledCount += 1;
  }

  return {
    found: expiredOrders.length,
    cancelled: cancelledCount,
  };
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
