import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send approval notification to owner
 */
export async function notifyOwner({ user, approvalLink }) {
  const mailOptions = {
    from: `"WebGPU AI Studio" <${process.env.SMTP_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject: '🆕 New User Registration — Approval Required',
    html: `
      <h2>New User Registration</h2>
      <p><strong>Name:</strong> ${user.name}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Registered:</strong> ${new Date().toLocaleString()}</p>
      <hr/>
      <p>Click below to approve this user:</p>
      <a href="${approvalLink}" style="
        display: inline-block;
        padding: 12px 24px;
        background: #6366f1;
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: bold;
      ">✅ Approve User</a>
      <p>Or reject them by visiting the admin panel.</p>
    `,
  };
  return transporter.sendMail(mailOptions);
}

/**
 * Send confirmation email to user
 */
export async function notifyUser({ user, status }) {
  const isApproved = status === 'approved';
  const mailOptions = {
    from: `"WebGPU AI Studio" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: isApproved
      ? '🎉 Welcome to WebGPU AI Studio — You\'re In!'
      : 'WebGPU AI Studio — Registration Update',
    html: isApproved
      ? `
        <h2>Welcome, ${user.name}! 🎉</h2>
        <p>Your registration has been <strong>approved</strong>.</p>
        <p>You can now log in and access all 18 AI inference tools powered by WebGPU — completely free, right in your browser.</p>
        <p><a href="${process.env.FRONTEND_URL}/login" style="
          display: inline-block;
          padding: 12px 24px;
          background: #6366f1;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
        ">🚀 Start Using AI Studio</a></p>
        <hr/>
        <p style="color: #666; font-size: 12px;">Powered by WebGPU AI Studio — Free, Open Source, Browser-Based AI</p>
      `
      : `
        <h2>Hi ${user.name},</h2>
        <p>Thank you for your interest in WebGPU AI Studio.</p>
        <p>At this time, we are unable to approve your registration. This may change in the future — feel free to try again.</p>
        <hr/>
        <p style="color: #666; font-size: 12px;">WebGPU AI Studio</p>
      `,
  };
  return transporter.sendMail(mailOptions);
}

export { transporter };
