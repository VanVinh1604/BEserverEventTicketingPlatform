// utils/emailTemplates.js

const formatPrice = (price) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

const generateTicketEmail = (order) => {
  const eventTitle = order.event?.title || order.event?.name || 'Sự kiện';
  const eventLocation = order.event?.location || 'Địa điểm sẽ được thông báo';
  const customerName = order.customerInfo?.fullName || 'Khách hàng';
  const ticketCount = order.tickets?.length || 0;

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận đặt vé thành công</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f3f4f6;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #ea580c 0%, #9333ea 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; }
    .header p { margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 18px; color: #111827; margin-bottom: 20px; }
    .success-badge {
      display: inline-block;
      background-color: #dcfce7;
      color: #166534;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .order-info {
      background-color: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    .order-info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .order-info-row:last-child { border-bottom: none; padding-bottom: 0; }
    .order-info-label { color: #6b7280; font-size: 14px; }
    .order-info-value { color: #111827; font-weight: 600; font-size: 14px; text-align: right; }
    .event-card {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    .event-card h2 { margin: 0 0 8px; color: #92400e; font-size: 20px; font-weight: 700; }
    .event-card p { margin: 4px 0; color: #78350f; font-size: 14px; }
    .ticket-list { margin: 24px 0; }
    .ticket-item {
      background-color: #f9fafb;
      border-left: 4px solid #ea580c;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .ticket-item h3 { margin: 0 0 8px; color: #111827; font-size: 16px; font-weight: 600; }
    .ticket-item p { margin: 4px 0; color: #6b7280; font-size: 14px; }
    .qr-wrapper {
      text-align: center;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px dashed #e5e7eb;
    }
    .qr-wrapper img {
      width: 160px;
      height: 160px;
      border-radius: 10px;
      border: 4px solid #ea580c;
      padding: 4px;
      background: white;
    }
    .qr-wrapper p {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 8px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #ea580c 0%, #9333ea 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      text-align: center;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p { margin: 8px 0; color: #6b7280; font-size: 13px; }
    .footer a { color: #ea580c; text-decoration: none; }
    .divider { height: 1px; background-color: #e5e7eb; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Header -->
    <div class="header">
      <h1>🎉 Đặt vé thành công!</h1>
      <p>Cảm ơn bạn đã tin tưởng TicketHub</p>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="greeting">
        Xin chào <strong>${customerName}</strong>,
      </div>

      <div class="success-badge">✓ Thanh toán hoàn tất</div>

      <p style="color: #4b5563; line-height: 1.6;">
        Đơn hàng của bạn đã được xác nhận thành công. Dưới đây là thông tin chi tiết về vé của bạn.
      </p>

      <!-- Order Info -->
      <div class="order-info">
        <div class="order-info-row">
          <span class="order-info-label">Mã đơn hàng</span>
          <span class="order-info-value">#${order._id.toString().slice(-8).toUpperCase()}</span>
        </div>
        <div class="order-info-row">
          <span class="order-info-label">Số lượng vé</span>
          <span class="order-info-value">${ticketCount} vé</span>
        </div>
        <div class="order-info-row">
          <span class="order-info-label">Tổng tiền</span>
          <span class="order-info-value" style="color: #ea580c;">${formatPrice(order.totalAmount)}</span>
        </div>
        <div class="order-info-row">
          <span class="order-info-label">Trạng thái</span>
          <span class="order-info-value" style="color: #16a34a;">Đã thanh toán</span>
        </div>
      </div>

      <!-- Event Card -->
      <div class="event-card">
        <h2>📍 ${eventTitle}</h2>
        <p><strong>Địa điểm:</strong> ${eventLocation}</p>
        <p><strong>Ngày đặt:</strong> ${new Date(order.createdAt).toLocaleString('vi-VN')}</p>
      </div>

      <!-- Tickets -->
      <h3 style="color: #111827; font-size: 18px; margin: 24px 0 12px;">Danh sách vé của bạn</h3>
      <div class="ticket-list">
        ${order.tickets.map((ticket, idx) => `
          <div class="ticket-item">
            <h3>🎫 Vé #${idx + 1} - ${ticket.ticketType?.name || 'Standard'}</h3>
            <p><strong>Mã vé:</strong> ${ticket._id.toString().slice(-12).toUpperCase()}</p>
            <p><strong>Giá:</strong> ${formatPrice(ticket.price || ticket.ticketType?.price)}</p>
            <p><strong>Trạng thái:</strong> <span style="color: #16a34a;">✓ Đã kích hoạt</span></p>
            <div class="qr-wrapper">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.qrCode || ticket._id.toString())}"
                alt="QR Code vé #${idx + 1}"
              />
              <p>Quét mã QR này để check-in tại sự kiện</p>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="divider"></div>

      <p style="color: #4b5563; line-height: 1.6; text-align: center;">
        Vui lòng truy cập trang <strong>Vé của tôi</strong> để xem chi tiết.
      </p>

      <center>
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/ticket-history" class="cta-button">
          Xem vé của tôi
        </a>
      </center>

      <div class="divider"></div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        <strong>Lưu ý quan trọng:</strong><br>
        • Vui lòng mang mã QR khi đến sự kiện để check-in<br>
        • Không chia sẻ mã QR với người khác để tránh gian lận<br>
        • Liên hệ hỗ trợ nếu có bất kỳ thắc mắc nào
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>TicketHub - Nền tảng đặt vé sự kiện</strong></p>
      <p>Email: support@tickethub.com | Hotline: 1900 1234</p>
      <p>
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}">Trang chủ</a> | 
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/help">Hỗ trợ</a>
      </p>
      <p style="margin-top: 16px; color: #9ca3af; font-size: 12px;">
        Email này được gửi tự động, vui lòng không trả lời.
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

module.exports = { generateTicketEmail };