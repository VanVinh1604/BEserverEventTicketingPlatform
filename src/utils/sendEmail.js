const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // 1. Cấu hình trạm trung chuyển (Dùng Gmail)
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 2. Nội dung bức thư
  const mailOptions = {
    from: '"TicketHub - Nền tảng đặt vé" <no-reply@tickethub.com>',
    to: options.email,
    subject: options.subject,
    html: options.html, // Chấp nhận gửi cả giao diện HTML cho đẹp
  };

  // 3. Tiến hành gửi
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;