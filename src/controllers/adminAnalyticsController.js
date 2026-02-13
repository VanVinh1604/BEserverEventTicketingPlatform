// src/controllers/adminAnalyticsController.js

const Order = require("../models/Order");
const TicketType = require("../models/TicketType");
const Checkin = require("../models/Checkin");
const AppError = require("../utils/AppError");



exports.getRevenueByEvent = async (req, res) => {
try{
  const revenue = await Order.aggregate([
    { $match: { status: "paid" } },
    {
      $group: {
        _id: "$event",
        totalRevenue: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  res.json(revenue);
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