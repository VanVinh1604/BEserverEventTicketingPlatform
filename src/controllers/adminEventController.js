const Event = require("../models/Event");
const TicketType = require("../models/TicketType");
const Order = require("../models/Order");
const APIFeatures = require("../middleware/apiFeatures");
const AppError = require("../utils/AppError");

const getTicketTypeLabel = (ticketTypeDoc, fallbackId) =>
  ticketTypeDoc?.name || String(fallbackId || "unknown_ticket_type");

const resolveImagePath = (file) => {
  if (!file) return null;

  if (typeof file.path === "string" && /^https?:\/\//i.test(file.path)) {
    return file.path;
  }

  if (file.filename) {
    return `/uploads/events/${file.filename}`;
  }

  if (typeof file.path === "string") {
    const normalized = file.path.replace(/\\/g, "/");
    const uploadIndex = normalized.lastIndexOf("/uploads/");
    if (uploadIndex >= 0) return normalized.slice(uploadIndex);
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }

  return null;
};

exports.createEvent = async (req, res, next) => {
  try {
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    const { title, description, location, category, startDate, endDate, status } = req.body;
    if (!title || !location) {
      return next(new AppError("Title and location are required", 400));
    }
    const imagePath = resolveImagePath(req.file);
    const event = await Event.create({
      title,
      description,
      location,
      category,
      startDate,
      endDate,
      status: status || 'active',
      image: imagePath,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// Cập nhật đơn hàng sang đã thanh toán thủ công
exports.confirmOrderPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status: "paid" },
      { new: true }
    );
    res.json({ message: "Xác nhận thanh toán thành công!", order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ CREATE TICKET TYPE
exports.createTicketType = async (req, res, next) => {
  try {
    const { event, name, price, quantity } = req.body;
    if (!event || !name || !price || !quantity) {
      return next(new AppError("Missing required fields", 400));
    }
    const ticketType = await TicketType.create({
      event,
      name,
      price,
      quantity,
      remaining: quantity,
    });
    await Event.findByIdAndUpdate(event, {
      $push: { ticketTypes: ticketType._id },
    });
    res.status(201).json({ success: true, data: ticketType });
  } catch (err) {
    next(err);
  }
};

// ✅ GET ALL EVENTS (admin) + pagination/filter/sort
exports.getEvents = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      Event.find().populate("ticketTypes"),
      req.query
    )
      .filter()
      .sort()
      .paginate();
    const events = await features.query;
    res.json({ success: true, results: events.length, data: events });
  } catch (err) {
    next(err);
  }
};

// ✅ UPDATE EVENT
exports.updateEvent = async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    if (req.file) {
      updateData.image = resolveImagePath(req.file);
    }
    const event = await Event.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    if (!event) {
      return next(new AppError("Event not found", 404));
    }
    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// ✅ DELETE EVENT
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return next(new AppError("Event not found", 404));
    }
    res.json({ success: true, message: "Event deleted" });
  } catch (err) {
    next(err);
  }
};

// ✅ CANCEL EVENT + REFUND (hoàn tiền / trả vé cho tất cả đơn liên quan)
exports.cancelAndRefundEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || "event_cancelled_by_admin";

    // 1. Đánh dấu event là cancelled
    const event = await Event.findByIdAndUpdate(
      id,
      { status: "cancelled" },
      { new: true }
    );
    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // 2. Tìm tất cả đơn hàng liên quan chưa bị cancelled/refunded
    const activeOrders = await Order.find({
      event: id,
      status: { $nin: ["cancelled", "refunded"] },
    });

    console.log(
      `[REFUND][EVENT] start event=${id} | title=${event.title || ""} | impactedOrders=${activeOrders.length} | reason=${reason}`
    );

    let refundedCount = 0;

    for (const order of activeOrders) {
      let refundedTickets = 0;

      // Hoàn vé cho đơn pending (trả lại remaining)
      if (order.status === "pending") {
        for (const item of order.pendingItems || []) {
          const beforeTicketType = await TicketType.findById(item.ticketTypeId).select("name remaining");
          const beforeRemaining = Number(beforeTicketType?.remaining) || 0;

          await TicketType.findByIdAndUpdate(item.ticketTypeId, {
            $inc: { remaining: item.quantity },
          });

          const afterTicketType = await TicketType.findById(item.ticketTypeId).select("remaining");
          const afterRemaining = Number(afterTicketType?.remaining) || 0;

          console.log(
            `[REFUND][STOCK] event=${id} | order=${order._id} | ticketType=${getTicketTypeLabel(beforeTicketType, item.ticketTypeId)} | +${Number(item?.quantity) || 0} | remaining ${beforeRemaining} -> ${afterRemaining}`
          );

          refundedTickets += Number(item?.quantity) || 0;
        }
      }

      // Chuyển trạng thái đơn sang refunded
      await Order.findByIdAndUpdate(order._id, {
        $set: { status: "refunded", cancelReason: reason },
      });

      console.log(`[REFUND][EVENT] event=${id} | order=${order._id} | ${order.status} -> refunded | reason=${reason} | refundedTickets=${refundedTickets}`);
      refundedCount += 1;
    }

    console.log(`[REFUND][EVENT] completed event=${id} | refundedOrders=${refundedCount}`);

    return res.json({
      success: true,
      message: `Đã hủy sự kiện và xử lý ${refundedCount} đơn hàng`,
      data: {
        event,
        refundedOrders: refundedCount,
        impactedOrders: refundedCount,
      },
    });
  } catch (err) {
    next(err);
  }
};
