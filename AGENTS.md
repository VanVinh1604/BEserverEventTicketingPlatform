# AGENTS.md - Developer Guidelines

## Project Overview

Node.js/Express backend API for Event Ticketing Platform.
- **Database**: MongoDB with Mongoose
- **Auth**: JWT (access + refresh tokens)
- **Validation**: Joi
- **Testing**: Jest with mongodb-memory-server
- **Module System**: CommonJS (require/module.exports)

---

## Commands

```bash
# Development server
npm run dev

# Production
node server.js

# Run all tests
npm test

# Run single test file
npm test -- src/tests/event.test.js

# Run test by name
npm test -- --testNamePattern="should return 401"
```

---

## Code Style

### File Organization
```
src/
├── app.js              # Express setup
├── server.js           # Entry point
├── config/             # DB, JWT, Stripe config
├── controllers/        # Request handlers
├── models/             # Mongoose schemas
├── routes/             # Express routers
├── middleware/         # Auth, validation, errors
├── validators/         # Joi schemas
├── utils/              # Helpers
└── tests/              # Jest tests
```

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `authController.js` |
| Models | PascalCase | `User.js`, `Event.js` |
| Variables | camelCase | `accessToken` |
| Constants | UPPER_SNAKE | `JWT_EXPIRE` |
| Schema fields | camelCase | `username` |

### Import Order
```javascript
// 1. Node built-ins
const path = require("path");

// 2. Third-party
const express = require("express");
const mongoose = require("mongoose");

// 3. Local modules
const User = require("../models/User");
const { generateAccessToken } = require("../config/jwt");
```

### Async/Await
Always use try-catch in controllers:
```javascript
exports.createEvent = async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
```

### Error Handling
- Use standard HTTP codes: 200, 201, 400, 401, 403, 404, 500
- Vietnamese error messages: `"Email đã tồn tại"`
- Response format:
```javascript
res.status(400).json({ success: false, message: "Mô tả lỗi" });
```

### Mongoose Schemas
```javascript
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Vui lòng nhập tên"],
    unique: true,
    trim: true
  }
}, { timestamps: true });

userSchema.pre("save", async function() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model("User", userSchema);
```

### Joi Validation
```javascript
const Joi = require("joi");

exports.createEventSchema = Joi.object({
  title: Joi.string().min(5).required(),
  location: Joi.string().required(),
});
```

### Routes Pattern
```javascript
const router = express.Router();
const { createEvent } = require("../controllers/adminEventController");
const { validateRequest } = require("../middleware/validate");
const { createEventSchema } = require("../validators/eventValidator");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, validateRequest(createEventSchema), createEvent);
module.exports = router;
```

### Testing
```javascript
const request = require("supertest");
const app = require("../app");  // NOT server

// With auth token
const res = await request(app)
  .post("/api/admin/events")
  .set("Authorization", `Bearer ${token}`)
  .send({ title: "Event" });

expect(res.statusCode).toBe(201);
expect(res.body.success).toBe(true);
```

### Environment Variables (.env)
```env
PORT=8000
NODE_ENV=development
MONGODB_URI=your_uri
JWT_SECRET=secret
JWT_REFRESH_SECRET=refresh_secret
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
```

---

## API Response Format

### Success
```javascript
res.status(200).json({ success: true, data: { ... } });
```

### Error
```javascript
res.status(400).json({ success: false, message: "Lỗi tiếng Việt" });
```

---

## Security

- Never commit `.env` files
- Use `select: false` for sensitive fields
- Always validate input with Joi
- Use parameterized queries (Mongoose handles this)
