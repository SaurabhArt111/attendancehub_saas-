'use strict';
const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    family: 4, // Force IPv4 — Render doesn't support IPv6 outbound
  });
}

// ─── Shared layout wrapper ────────────────────────────────────────────────────
function layout(accentColor, badgeIcon, badgeLabel, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>AttendanceHub</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#090d16;font-family:'Segoe UI',Arial,sans-serif;color:#f3f4f6;-webkit-font-smoothing:antialiased}
  .wrapper{background:#090d16;padding:32px 16px}
  .card{background:#111827;border:1px solid #1f2937;border-radius:16px;max-width:520px;margin:0 auto;overflow:hidden}
  .header{background:linear-gradient(135deg,#0f1929 0%,#111827 100%);padding:32px 40px 24px;text-align:center;border-bottom:1px solid #1f2937}
  .logo{font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#4f8ef7}
  .logo span{color:#a78bfa}
  .badge{display:inline-flex;align-items:center;gap:8px;background:${accentColor}18;border:1px solid ${accentColor}40;color:${accentColor};border-radius:100px;padding:6px 16px;font-size:13px;font-weight:600;margin-top:14px}
  .body{padding:32px 40px}
  .footer{padding:24px 40px;border-top:1px solid #1f2937;text-align:center}
  .footer p{font-size:12px;color:#6b7280;line-height:1.6}
  .footer a{color:#4f8ef7;text-decoration:none}
  h2{font-size:22px;font-weight:700;color:#f3f4f6;margin-bottom:8px}
  p{font-size:14px;color:#9ca3af;line-height:1.7;margin-bottom:12px}
  .highlight{color:#f3f4f6;font-weight:600}
  @media(max-width:600px){.body,.header,.footer{padding:24px 20px}}
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="logo">Attendance<span>Hub</span></div>
      <div class="badge">${badgeIcon}&nbsp;${badgeLabel}</div>
    </div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">
      <p>This email was sent by <strong>AttendanceHub</strong> &mdash; Workforce Management Platform</p>
      <p>If you did not request this, please ignore this email. <a href="mailto:${process.env.SMTP_USER}">Contact support</a></p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── OTP block UI ─────────────────────────────────────────────────────────────
function otpBlock(otp, accentColor) {
  const digits = otp.split('').map(d =>
    `<span style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:56px;background:#1f2937;border:2px solid ${accentColor}50;border-radius:10px;font-size:26px;font-weight:800;color:${accentColor};margin:0 4px;font-family:'Courier New',monospace">${d}</span>`
  ).join('');
  return `<div style="text-align:center;margin:28px 0">
    <div style="background:#0f1929;border:1px solid #1f2937;border-radius:14px;padding:24px;display:inline-block">
      <div style="font-size:11px;color:#6b7280;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:14px">Verification Code</div>
      <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:2px">${digits}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:14px">&#x23F1; Expires in <strong style="color:#f59e0b">10 minutes</strong></div>
    </div>
  </div>`;
}

// ─── Info row helper ──────────────────────────────────────────────────────────
function infoRow(label, value, accent) {
  return `<tr>
    <td style="padding:10px 0;font-size:13px;color:#6b7280;width:40%">${label}</td>
    <td style="padding:10px 0;font-size:13px;color:${accent || '#f3f4f6'};font-weight:600">${value}</td>
  </tr>`;
}

// ─── 1. OTP Verification Email ────────────────────────────────────────────────
function buildOtpEmail(email, otp, companyName) {
  const body = `
    <h2>Verify your email address</h2>
    <p>Hello! You're registering <span class="highlight">${companyName}</span> on AttendanceHub. Use the code below to verify your email address.</p>
    ${otpBlock(otp, '#4f8ef7')}
    <div style="background:#1f2937;border-radius:10px;padding:16px;margin-top:4px">
      <p style="margin:0;font-size:13px;color:#9ca3af">
        &#x26A0;&#xFE0F; <strong style="color:#f59e0b">Security notice:</strong> Never share this code with anyone. AttendanceHub will never ask for your OTP via phone or chat.
      </p>
    </div>`;
  return layout('#4f8ef7', '&#x2709;&#xFE0F;', 'Email Verification', body);
}

// ─── 2. Welcome / Registration Success Email ──────────────────────────────────
function buildWelcomeEmail(companyName, companyCode, contact, adminLoginUrl) {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
  const body = `
    <h2>Welcome to AttendanceHub! &#x1F389;</h2>
    <p>Your company workspace has been successfully created. Here are your registration details — keep them safe.</p>
    <div style="background:#0f1929;border:1px solid #1f2937;border-radius:14px;padding:20px 24px;margin:20px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow('Company Name', companyName)}
        ${infoRow('Company Code', `<span style="font-family:'Courier New',monospace;font-size:18px;letter-spacing:0.12em;color:#4f8ef7">${companyCode}</span>`)}
        ${infoRow('Contact', contact)}
        ${infoRow('Registered On', now)}
      </table>
    </div>
    <div style="background:#0a2010;border:1px solid #10b98140;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#10b981">&#x2714; Next Steps</p>
      <p style="margin:0;font-size:13px;color:#9ca3af">1. Save your Company Code — you'll need it every time you log in.<br>2. Log in at the admin portal and set up your admin account.<br>3. Add your employees and start tracking attendance.</p>
    </div>
    <div style="background:#1a0f00;border:1px solid #f59e0b40;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#f59e0b">&#x26A0; Security Tips</p>
      <p style="margin:0;font-size:13px;color:#9ca3af">&#x2022; Never share your Company Code or password publicly.<br>&#x2022; Use a strong, unique password for your admin account.<br>&#x2022; Contact support immediately if you suspect unauthorized access.</p>
    </div>
    <a href="${adminLoginUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f8ef7,#7c3aed);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;margin-bottom:8px">
      Go to Admin Portal &rarr;
    </a>`;
  return layout('#10b981', '&#x1F389;', 'Registration Successful', body);
}

// ─── 3. Forgot Company Code Email ─────────────────────────────────────────────
function buildForgotCodeOtpEmail(email, otp) {
  const body = `
    <h2>Company Code Recovery</h2>
    <p>We received a request to recover the Company Code associated with <span class="highlight">${email}</span>. Enter the OTP below to verify your identity.</p>
    ${otpBlock(otp, '#a78bfa')}
    <div style="background:#1f2937;border-radius:10px;padding:16px;margin-top:4px">
      <p style="margin:0;font-size:13px;color:#9ca3af">
        &#x26A0;&#xFE0F; If you did not request this, your account may be at risk. Please change your password immediately.
      </p>
    </div>`;
  return layout('#a78bfa', '&#x1F511;', 'Code Recovery', body);
}

// ─── 4. Company Code Reveal Email ─────────────────────────────────────────────
function buildCompanyCodeEmail(companyName, companyCode) {
  const body = `
    <h2>Your Company Code</h2>
    <p>Here is the Company Code for <span class="highlight">${companyName}</span>. Use it to sign in to the admin portal.</p>
    <div style="text-align:center;margin:28px 0">
      <div style="background:#0f1929;border:2px solid #a78bfa40;border-radius:14px;padding:28px 24px;display:inline-block;min-width:240px">
        <div style="font-size:11px;color:#6b7280;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">Company Code</div>
        <div style="font-size:32px;font-weight:800;letter-spacing:0.18em;color:#a78bfa;font-family:'Courier New',monospace">${companyCode}</div>
      </div>
    </div>
    <div style="background:#1f2937;border-radius:10px;padding:16px;margin-top:4px">
      <p style="margin:0;font-size:13px;color:#9ca3af">
        &#x1F512; Treat your Company Code like a password. Do not share it with unauthorized people.
      </p>
    </div>`;
  return layout('#a78bfa', '&#x1F3E2;', 'Company Code', body);
}

// ─── 5. Forgot Password OTP Email ─────────────────────────────────────────────
function buildForgotPasswordOtpEmail(email, otp) {
  const body = `
    <h2>Password Reset Request</h2>
    <p>We received a request to reset the password for <span class="highlight">${email}</span>. Enter the OTP below to verify your identity.</p>
    ${otpBlock(otp, '#f59e0b')}
    <div style="background:#1f2937;border-radius:10px;padding:16px;margin-top:4px">
      <p style="margin:0;font-size:13px;color:#9ca3af">
        &#x26A0;&#xFE0F; If you did not request a password reset, please ignore this email and your password will remain unchanged.
      </p>
    </div>`;
  return layout('#f59e0b', '&#x1F510;', 'Password Reset', body);
}

// ─── 6. Password Reset Confirmation Email ────────────────────────────────────
function buildPasswordChangedEmail(companyName, email) {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
  const body = `
    <h2>Password Changed Successfully</h2>
    <p>The password for <span class="highlight">${companyName}</span> has been changed.</p>
    <div style="background:#0f1929;border:1px solid #1f2937;border-radius:14px;padding:20px 24px;margin:20px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow('Company', companyName)}
        ${infoRow('Email', email)}
        ${infoRow('Changed On', now)}
      </table>
    </div>
    <div style="background:#1a0808;border:1px solid #ef444440;border-radius:10px;padding:16px 20px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#ef4444">&#x26A0; Not you?</p>
      <p style="margin:0;font-size:13px;color:#9ca3af">If you did not make this change, contact support immediately and reset your password.</p>
    </div>`;
  return layout('#ef4444', '&#x1F512;', 'Password Changed', body);
}

// ─── Sender helpers ───────────────────────────────────────────────────────────
const FROM = () => `"AttendanceHub" <${process.env.SMTP_USER}>`;

async function sendMail({ to, subject, html }) {
  const transporter = createTransport();
  await transporter.sendMail({ from: FROM(), to, subject, html });
}

module.exports = {
  sendOtpVerification: (email, otp, companyName) =>
    sendMail({ to: email, subject: `${otp} is your AttendanceHub verification code`, html: buildOtpEmail(email, otp, companyName) }),

  sendWelcomeEmail: (email, companyName, companyCode, contact) =>
    sendMail({ to: email, subject: `Welcome to AttendanceHub — Your Company Code: ${companyCode}`, html: buildWelcomeEmail(companyName, companyCode, contact, process.env.ADMIN_URL || 'https://attendancehub-saas.vercel.app') }),

  sendForgotCodeOtp: (email, otp) =>
    sendMail({ to: email, subject: `${otp} — AttendanceHub Company Code Recovery`, html: buildForgotCodeOtpEmail(email, otp) }),

  sendCompanyCodeEmail: (email, companyName, companyCode) =>
    sendMail({ to: email, subject: `Your AttendanceHub Company Code`, html: buildCompanyCodeEmail(companyName, companyCode) }),

  sendForgotPasswordOtp: (email, otp) =>
    sendMail({ to: email, subject: `${otp} — AttendanceHub Password Reset`, html: buildForgotPasswordOtpEmail(email, otp) }),

  sendPasswordChangedEmail: (email, companyName) =>
    sendMail({ to: email, subject: `AttendanceHub — Password Changed`, html: buildPasswordChangedEmail(companyName, email) }),
};
