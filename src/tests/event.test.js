const request = require("supertest");
const app = require("../app"); // import app, KHÔNG import server

describe("Create Event Validation", () => {
  let token;

  beforeAll(async () => {
    // Đăng ký user admin test
    await request(app).post("/api/auth/register").send({
      name: "Admin Test",
      email: "admin@test.com",
      password: "123456",
      role: "admin", 
    });

    // Login lấy token
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "123456",
    });

    token = res.body.token;
  });

  it("should return 400 if missing title", async () => {
    const res = await request(app)
      .post("/api/admin/events")
      .set("Authorization", `Bearer ${token}`) // 🔥 QUAN TRỌNG
      .send({ location: "Ha Noi" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Title and location are required");
  });
});

describe("Create Event - Authorization & Validation", () => {
  let adminToken;
  let userToken;

  beforeAll(async () => {
    // Tạo ADMIN
    await request(app).post("/api/auth/register").send({
      name: "Admin Test",
      email: "admin@test.com",
      password: "123456",
      role: "admin",
    });

    const adminRes = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "123456",
    });

    adminToken = adminRes.body.token;

    // Tạo USER thường
    await request(app).post("/api/auth/register").send({
      name: "User Test",
      email: "user@test.com",
      password: "123456",
      role: "user",
    });

    const userRes = await request(app).post("/api/auth/login").send({
      email: "user@test.com",
      password: "123456",
    });

    userToken = userRes.body.token;
  });

  // ❌ Không có token → 401
  it("should return 401 if no token", async () => {
    const res = await request(app)
      .post("/api/admin/events")
      .send({ title: "Music Show", location: "Ha Noi" });

    expect(res.statusCode).toBe(401);
  });

  // ❌ User thường → 403
  it("should return 403 if normal user tries to create event", async () => {
    const res = await request(app)
      .post("/api/admin/events")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ title: "Music Show", location: "Ha Noi" });

    expect(res.statusCode).toBe(403);
  });

  // ✅ Admin tạo event thành công → 201
  // ✅ Admin tạo event thành công → 201
it("should create event successfully if admin", async () => {
  const res = await request(app)
    .post("/api/admin/events")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: "Music Show",
      location: "Ha Noi",
    });

  expect(res.statusCode).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.data.title).toBe("Music Show");
});
});
