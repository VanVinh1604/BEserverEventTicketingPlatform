// src/controllers/adminAnalyticsController.js

const Order = require("../models/Order");
const TicketType = require("../models/TicketType");
const Checkin = require("../models/Checkin");
const AppError = require("../utils/AppError");


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

    res.json(stats);
   } catch (err) {
    next(err);
  }
};

exports.getCheckinStats = async (req, res) => {
try{
  const stats = await Checkin.aggregate([
    {
      $group: {
        _id: "$event",
        totalCheckins: { $sum: 1 },
      },
    },
  ]);

  res.json(stats);
 } catch (err) {
    next(err);
  }
};