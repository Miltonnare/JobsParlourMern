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

const sendJobAlertDigestEmail = async ({ to, name, jobs }) => {
  const jobItemsHtml = jobs.map(job => `
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; background-color: #ffffff;">
      <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px;">${job.title}</h3>
      <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px;">
        <strong>Company:</strong> ${job.createdBy?.companyName || 'Not Specified'}<br>
        <strong>Location:</strong> ${job.location} (${job.workplace || 'onsite'})<br>
        <strong>Type:</strong> ${job.jobType || 'full-time'}<br>
        ${job.salary ? `<strong>Salary:</strong> $${job.salary.toLocaleString()}<br>` : ''}
      </p>
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/jobs/${job._id}" 
         style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 8px 12px; border-radius: 4px; text-decoration: none; font-size: 14px; font-weight: 500;">
        View Job
      </a>
    </div>
  `).join('');

  return sendMail({
    to,
    subject: `Jobs Parlour: Your Job Alert Digest (${jobs.length} matching job${jobs.length === 1 ? '' : 's'})`,
    text: `Hi ${name},\n\nWe found ${jobs.length} new job${jobs.length === 1 ? '' : 's'} matching your alert preferences. Check them out on Jobs Parlour.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 20px;">Jobs Parlour</h2>
        <p style="font-size: 16px;">Hi ${name},</p>
        <p style="font-size: 16px;">We found <strong>${jobs.length}</strong> new job${jobs.length === 1 ? '' : 's'} matching your job alert preferences:</p>
        <div style="margin-top: 20px; margin-bottom: 20px;">
          ${jobItemsHtml}
        </div>
        <p style="font-size: 14px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px;">
          You are receiving this because you subscribed to job alerts on Jobs Parlour. You can manage or delete your alerts anytime in your profile settings.
        </p>
      </div>
    `
  });
};

module.exports = {
  sendEmailVerification,
  sendMail,
  sendJobAlertDigestEmail
};
