const User = require('../models/User');
const AppError = require('../utils/AppError');

// @desc    Lấy danh sách tất cả users
// @route   GET /api/admin/users
// @access  Admin
exports.getAllUsers = async (req, res, next) => {
  try {
    const { search, role, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    if (role && role !== 'all') {
      query.role = role;
    }

    const skip = (page - 1) * limit;
    
    const users = await User.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Thống kê users
// @route   GET /api/admin/users/stats
// @access  Admin
exports.getUserStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });
    const userCount = await User.countDocuments({ role: 'user' });
    
    // Users đăng ký trong 7 ngày gần nhất
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsers = await User.countDocuments({ 
      createdAt: { $gte: sevenDaysAgo } 
    });

    // Users đăng ký trong 30 ngày gần nhất
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyUsers = await User.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo } 
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalUsers,
        admins: adminCount,
        users: userCount,
        newUsers,
        monthlyUsers
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy thông tin chi tiết user
// @route   GET /api/admin/users/:id
// @access  Admin
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshToken');
    
    if (!user) {
      return next(new AppError('Không tìm thấy user', 404));
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật thông tin user
// @route   PUT /api/admin/users/:id
// @access  Admin
exports.updateUser = async (req, res, next) => {
  try {
    const { username, name, email, role } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('Không tìm thấy user', 404));
    }

    // Kiểm tra email trùng (nếu đổi email)
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return next(new AppError('Email đã tồn tại', 400));
      }
    }

    // Cập nhật thông tin
    if (username) user.username = username;
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật thành công',
      data: {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa user
// @route   DELETE /api/admin/users/:id
// @access  Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return next(new AppError('Không tìm thấy user', 404));
    }

    // Không cho phép xóa chính mình
    if (user._id.toString() === req.user.id) {
      return next(new AppError('Không thể xóa tài khoản của chính mình', 400));
    }

    await user.deleteOne();

    res.status(200).json({ 
      success: true, 
      message: 'Đã xóa user thành công' 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Tạo user mới (bởi admin)
// @route   POST /api/admin/users
// @access  Admin
exports.createUser = async (req, res, next) => {
  try {
    const { username, name, email, password, role } = req.body;

    // Validate
    if (!email || !password) {
      return next(new AppError('Email và password là bắt buộc', 400));
    }

    // Kiểm tra email tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email đã tồn tại', 400));
    }

    // Tạo user
    const user = await User.create({
      username: username || email.split('@')[0],
      name: name || username || 'User',
      email,
      password, // Model sẽ tự hash
      role: role || 'user'
    });

    res.status(201).json({
      success: true,
      message: 'Tạo user thành công',
      data: {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};