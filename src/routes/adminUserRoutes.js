const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserStats,
  getUserById,
  updateUser,
  deleteUser,
  createUser
} = require('../controllers/adminUserController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Áp dụng middleware cho tất cả routes
router.use(protect, authorize('admin'));

// Routes
router.route('/')
  .get(getAllUsers)
  .post(createUser);

router.get('/stats', getUserStats);

router.route('/:id')
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;