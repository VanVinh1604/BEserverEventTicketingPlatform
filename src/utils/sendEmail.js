const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
  const emailData = {
    from: 'TicketHub <onboarding@resend.dev>',
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  // Đính kèm QR codes nếu có
  if (options.attachments) {
    emailData.attachments = options.attachments;
  }

  await resend.emails.send(emailData);
};

module.exports = sendEmail;