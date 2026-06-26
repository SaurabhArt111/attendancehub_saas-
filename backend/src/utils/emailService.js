'use strict';
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'AttendanceHub <onboarding@resend.dev>';
const ADMIN_URL = process.env.ADMIN_URL || 'https://attendancehub-saas.vercel.app';

// ─── Shared layout ────────────────────────────────────────────────────────────
function layout(accentColor, badgeIcon, badgeLabel, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AttendanceHub</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#090d16;font-family:'Segoe UI',Arial,sans-serif;color:#f3f4f6;-webkit-font-smoothing:antialiased}
  .wrapper{background:#090d16;padding:32px 16px}
  .card{background:#111827;border:1px solid #1f2937;border-radius:16px;max-width:520px;margin:0 auto;overflow:hidden}
  .header{background:linear-gradient(135deg,#0f1929 0%,#111827 100%);padding:32px 40px 24px;text-align:center;border-bottom:1px solid #1f2937}
  .logo{font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#4f8ef7}
  .logo span{color:#a78bfa}
  .badge{display:inline-flex;align-items:center;gap:8px;background:${accentColor}20;border:1px solid ${accentColor}50;color:${accentColor};border-radius:100px;padding:6px 16px;font-size:13px;font-weight:600;margin-top:14px}
  .body{padding:32px 40px}
  .footer{padding:24px 40px;border-top:1px solid #1f2937;text-align:center}
  .footer p{font-size:12px;color:#6b7280;line-height:1.6}
  .footer a{color:#4f8ef7;text-decoration:none}
  h2{font-size:22px;font-weight:700;color:#f3f4f6;margin-bottom:8px}
  p{font-size:14px;color:#9ca3af;line-height:1.7;margin-bottom:12px}
  .hi{color:#f3f4f6;font-weight:600}
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
      <p>Sent by <strong>AttendanceHub</strong> &mdash; Workforce Management Platform</p>
      <p>Did not request this? You can safely ignore this email.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── OTP digit block ──────────────────────────────────────────────────────────
function otpBlock(otp, accent) {
  const digits = otp.split('').map(d =>
    `<span style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:56px;background:#1f2937;border:2px solid ${accent}50;border-radius:10px;font-size:26px;font-weight:800;color:${accent};margin:0 4px;font-family:'Courier New',monospace">${d}</span>`
  ).join('');
  return `<div style="text-align:center;margin:28px 0">
    <div style="background:#0f1929;border:1px solid #1f2937;border-radius:14px;padding:24px;display:inline-block">
      <div style="font-size:11px;color:#6b7280;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:14px">Verification Code</div>
      <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:2px">${digits}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:14px">Expires in <strong style="color:#f59e0b">10 minutes</strong></div>
    </div>
  </div>`;
}

function infoRow(label, value) {
  return `<tr>
    <td style="padding:10px 0;font-size:13px;color:#6b7280;width:42%;vertical-align:top">${label}</td>
    <td style="padding:10px 0;font-size:13px;color:#f3f4f6;font-weight:600">${value}</td>
  </tr>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────
function tplOtpVerification(otp, companyName) {
  return layout('#4f8ef7', '&#x2709;', 'Email Verification', `
    <h2>Verify your email address</h2>
    <p>You are registering <span class="hi">${companyName}</span> on AttendanceHub. Use the code below to verify your email.</p>
    ${otpBlock(otp, '#4f8ef7')}
    <div style="background:#1f2937;border-radius:10px;padding:16px">
      <p style="margin:0;font-size:13px;color:#9ca3af">&#x26A0; Never share this code. AttendanceHub will never ask for your OTP via phone or chat.</p>
    </div>`);
}

function tplWelcome(companyName, companyCode, contact) {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
  return layout('#10b981', '&#x1F389;', 'Registration Successful', `
    <h2>Welcome to AttendanceHub!</h2>
    <p>Your company workspace is live. Keep these details safe.</p>
    <div style="background:#0f1929;border:1px solid #1f2937;border-radius:14px;padding:20px 24px;margin:20px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow('Company Name', companyName)}
        ${infoRow('Company Code', `<span style="font-family:'Courier New',monospace;font-size:20px;letter-spacing:0.12em;color:#4f8ef7">${companyCode}</span>`)}
        ${infoRow('Contact', contact)}
        ${infoRow('Registered On', now)}
      </table>
    </div>
    <div style="background:#0a2010;border:1px solid #10b98140;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#10b981">Next Steps</p>
      <p style="margin:0;font-size:13px;color:#9ca3af">1. Save your Company Code &mdash; needed every login.<br>2. Set up your admin account on the portal.<br>3. Add employees and start tracking attendance.</p>
    </div>
    <div style="background:#1a0f00;border:1px solid #f59e0b40;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#f59e0b">&#x26A0; Security Tips</p>
      <p style="margin:0;font-size:13px;color:#9ca3af">Never share your Company Code or password. Contact support if you suspect unauthorized access.</p>
    </div>
    <a href="${ADMIN_URL}" style="display:inline-block;background:linear-gradient(135deg,#4f8ef7,#7c3aed);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px">Go to Admin Portal &rarr;</a>`);
}

function tplForgotCodeOtp(otp) {
  return layout('#a78bfa', '&#x1F511;', 'Code Recovery', `
    <h2>Company Code Recovery</h2>
    <p>We received a request to recover your Company Code. Enter the OTP below to verify your identity.</p>
    ${otpBlock(otp, '#a78bfa')}
    <div style="background:#1f2937;border-radius:10px;padding:16px">
      <p style="margin:0;font-size:13px;color:#9ca3af">&#x26A0; If you did not request this, your account may be at risk. Please change your password immediately.</p>
    </div>`);
}

function tplCompanyCode(companyName, companyCode) {
  return layout('#a78bfa', '&#x1F3E2;', 'Company Code', `
    <h2>Your Company Code</h2>
    <p>Here is the Company Code for <span class="hi">${companyName}</span>.</p>
    <div style="text-align:center;margin:28px 0">
      <div style="background:#0f1929;border:2px solid #a78bfa40;border-radius:14px;padding:28px 24px;display:inline-block;min-width:240px">
        <div style="font-size:11px;color:#6b7280;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">Company Code</div>
        <div style="font-size:32px;font-weight:800;letter-spacing:0.18em;color:#a78bfa;font-family:'Courier New',monospace">${companyCode}</div>
      </div>
    </div>
    <div style="background:#1f2937;border-radius:10px;padding:16px">
      <p style="margin:0;font-size:13px;color:#9ca3af">&#x1F512; Treat your Company Code like a password. Do not share it with unauthorized people.</p>
    </div>`);
}

function tplForgotPasswordOtp(otp) {
  return layout('#f59e0b', '&#x1F510;', 'Password Reset', `
    <h2>Password Reset Request</h2>
    <p>We received a request to reset your company account password. Enter the OTP below to verify.</p>
    ${otpBlock(otp, '#f59e0b')}
    <div style="background:#1f2937;border-radius:10px;padding:16px">
      <p style="margin:0;font-size:13px;color:#9ca3af">&#x26A0; If you did not request a password reset, ignore this email. Your password will remain unchanged.</p>
    </div>`);
}

function tplPasswordChanged(companyName, emailAddr) {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
  return layout('#ef4444', '&#x1F512;', 'Password Changed', `
    <h2>Password Changed Successfully</h2>
    <p>The password for <span class="hi">${companyName}</span> was just changed.</p>
    <div style="background:#0f1929;border:1px solid #1f2937;border-radius:14px;padding:20px 24px;margin:20px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow('Company', companyName)}
        ${infoRow('Email', emailAddr)}
        ${infoRow('Changed On', now)}
      </table>
    </div>
    <div style="background:#1a0808;border:1px solid #ef444440;border-radius:10px;padding:16px 20px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#ef4444">&#x26A0; Not you?</p>
      <p style="margin:0;font-size:13px;color:#9ca3af">Contact support immediately and reset your password.</p>
    </div>`);
}

// ─── Send helper ──────────────────────────────────────────────────────────────
async function send({ to, subject, html }) {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(error.message);
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  sendOtpVerification: (to, otp, companyName) => send({ to, subject: `${otp} is your AttendanceHub verification code`, html: tplOtpVerification(otp, companyName) }),
  sendWelcomeEmail: (to, companyName, companyCode, contact) => send({ to, subject: `Welcome to AttendanceHub — Your Company Code: ${companyCode}`, html: tplWelcome(companyName, companyCode, contact) }),
  sendForgotCodeOtp: (to, otp) => send({ to, subject: `${otp} — AttendanceHub Company Code Recovery`, html: tplForgotCodeOtp(otp) }),
  sendCompanyCodeEmail: (to, companyName, companyCode) => send({ to, subject: `Your AttendanceHub Company Code`, html: tplCompanyCode(companyName, companyCode) }),
  sendForgotPasswordOtp: (to, otp) => send({ to, subject: `${otp} — AttendanceHub Password Reset`, html: tplForgotPasswordOtp(otp) }),
  sendPasswordChangedEmail: (to, companyName) => send({ to, subject: `AttendanceHub — Password Changed`, html: tplPasswordChanged(companyName, to) }),
};
