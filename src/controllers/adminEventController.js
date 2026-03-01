const Event = require("../models/Event");
const TicketType = require("../models/TicketType");
const APIFeatures = require("../middleware/apiFeatures");
const AppError = require("../utils/AppError");


// ✅ CREATE EVENT
exports.createEvent = async (req, res, next) => {
  try {
    const { title, description, location } = req.body;

    if (!title || !location) {
      return next(new AppError("Title and location are required", 400));
    }

    const imagePath = req.file
      ? `/uploads/events/${req.file.filename}`
      : null;

    const event = await Event.create({
      title,
      description,
      location,
      image: imagePath,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: event,
    });
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
            { status: 'paid' }, 
            { new: true }
        );
        
        // Gửi email vé sau khi admin xác nhận (giống thực tế)
        // sendEmail(order.customerInfo.email, "Vé của bạn đã sẵn sàng", ...);

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
      remaining: quantity, // 🔥 bắt buộc cho anti oversell
    });

    await Event.findByIdAndUpdate(event, {
      $push: { ticketTypes: ticketType._id },
    });

    res.status(201).json({
      success: true,
      data: ticketType,
    });
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

    res.json({
      success: true,
      results: events.length,
      data: events,
    });
  } catch (err) {
    next(err);
  }
};


// ✅ UPDATE EVENT
exports.updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    res.json({
      success: true,
      data: event,
    });
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

    res.json({
      success: true,
      message: "Event deleted",
    });
  } catch (err) {
    next(err);
  }
};
