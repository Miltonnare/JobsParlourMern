const nodemailer = require('nodemailer');

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    const error = new Error('SMTP environment variables are not configured');
    error.statusCode = 500;
    throw error;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
};

const sendMail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();

  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  });
};

const sendEmailVerification = async ({ to, name, verificationUrl }) => {
  return sendMail({
    to,
    subject: 'Confirm your Jobs Parlour email',
    text: `Hi ${name}, confirm your email by opening this link: ${verificationUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Confirm your email</h2>
        <p>Hi ${name},</p>
        <p>Thanks for joining Jobs Parlour. Confirm your email to finish setting up your account.</p>
        <p><a href="${verificationUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Confirm email</a></p>
        <p>If the button does not work, copy this link:</p>
        <p>${verificationUrl}</p>
      </div>
    `
  });
};

module.exports = { sendEmailVerification };
