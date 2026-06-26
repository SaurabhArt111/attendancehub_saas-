'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Company = require('../models/Company');
const Admin   = require('../models/Admin');
const OTP     = require('../models/OTP');
const { verifyAdmin } = require('../middleware/auth');
const email   = require('../utils/emailService');

const JWT_SECRET   = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChunk(len) {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}
function genCode(name) {
  const prefix = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  return `${prefix}${randomChunk(5)}`;
}
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Rate limiters
const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { error: 'Too many OTP requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const verifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification attempts. Please try again later.' },
});

// ─── STEP 1: Send registration OTP ──────────────────────────────────────────
router.post('/send-otp', otpRateLimit, async (req, res) => {
  try {
    const { email: emailAddr, companyName } = req.body;
    if (!emailAddr || !companyName)
      return res.status(400).json({ error: 'Email and company name are required' });

    const emailLower = emailAddr.toLowerCase().trim();
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(emailLower))
      return res.status(400).json({ error: 'Invalid email address' });

    // Check if email already registered
    const existing = await Company.findOne({ email: emailLower });
    if (existing) return res.status(409).json({ error: 'This email is already registered' });

    const otp = generateOtp();

    // Upsert OTP record (delete previous if any)
    await OTP.deleteMany({ email: emailLower, purpose: 'register' });
    await OTP.create({ email: emailLower, otp, purpose: 'register' });

    await email.sendOtpVerification(emailLower, otp, companyName);

    res.json({ message: `Verification code sent to ${emailLower}` });
  } catch (e) {
    console.error('send-otp error:', e.message);
    res.status(500).json({ error: 'Failed to send OTP. Please check your email address and try again.' });
  }
});

// ─── STEP 2: Register company (verify OTP + create) ─────────────────────────
router.post('/register', verifyRateLimit, async (req, res) => {
  try {
    const { name, email: emailAddr, contact, password, otp } = req.body;
    if (!name || !emailAddr || !contact || !password || !otp)
      return res.status(400).json({ error: 'All fields including OTP are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const emailLower = emailAddr.toLowerCase().trim();

    // Verify OTP
    const otpRecord = await OTP.findOne({ email: emailLower, purpose: 'register', verified: false });
    if (!otpRecord) return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    if (otpRecord.otp !== otp.trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const left = 5 - otpRecord.attempts;
      return res.status(400).json({ error: `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} remaining.` });
    }

    // OTP valid — mark verified and delete
    await OTP.deleteOne({ _id: otpRecord._id });

    // Double-check email not taken (race condition)
    const existing = await Company.findOne({ email: emailLower });
    if (existing) return res.status(409).json({ error: 'This email is already registered' });

    // Generate unique company code
    let companyCode, exists = true;
    while (exists) {
      companyCode = genCode(name);
      exists = await Company.findOne({ companyCode });
    }

    const hashed = await bcrypt.hash(password, 10);
    const company = await Company.create({
      name: name.trim(), companyCode, email: emailLower, contact, password: hashed
    });

    // Fire welcome email (non-blocking)
    email.sendWelcomeEmail(emailLower, company.name, company.companyCode, contact)
      .catch(err => console.error('Welcome email failed:', err.message));

    res.status(201).json({
      message:     'Company registered successfully',
      companyCode: company.companyCode,
      companyId:   company._id,
      name:        company.name,
    });
  } catch (e) {
    console.error('register error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Company Login ────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { companyCode, password } = req.body;
    if (!companyCode || !password)
      return res.status(400).json({ error: 'Company code and password are required' });

    const company = await Company.findOne({ companyCode: companyCode.toUpperCase() });
    if (!company || !await bcrypt.compare(password, company.password))
      return res.status(401).json({ error: 'Invalid company code or password' });

    const token = jwt.sign({ companyId: company._id, role: 'company_setup' }, JWT_SECRET, { expiresIn: '1h' });
    const adminExists = await Admin.findOne({ companyId: company._id, isOwner: true });

    res.json({ token, companyId: company._id, companyCode: company.companyCode, name: company.name, adminSetupDone: !!adminExists });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Company Info ─────────────────────────────────────────────────────────────
router.get('/info', verifyAdmin, async (req, res) => {
  try {
    const company = await Company.findById(req.admin.companyId).select('-password');
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FORGOT COMPANY CODE — Step 1: Send OTP ──────────────────────────────────
router.post('/forgot-code/send-otp', otpRateLimit, async (req, res) => {
  try {
    const { email: emailAddr } = req.body;
    if (!emailAddr) return res.status(400).json({ error: 'Email is required' });

    const emailLower = emailAddr.toLowerCase().trim();
    const company = await Company.findOne({ email: emailLower });

    // Always respond the same to prevent email enumeration
    if (!company) {
      return res.json({ message: `If this email is registered, a code will be sent to ${emailLower}` });
    }

    const otp = generateOtp();
    await OTP.deleteMany({ email: emailLower, purpose: 'forgot_code' });
    await OTP.create({ email: emailLower, otp, purpose: 'forgot_code' });

    await email.sendForgotCodeOtp(emailLower, otp);
    res.json({ message: `Verification code sent to ${emailLower}` });
  } catch (e) {
    console.error('forgot-code send-otp error:', e.message);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// ─── FORGOT COMPANY CODE — Step 2: Verify OTP and reveal code ────────────────
router.post('/forgot-code/verify', verifyRateLimit, async (req, res) => {
  try {
    const { email: emailAddr, otp } = req.body;
    if (!emailAddr || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const emailLower = emailAddr.toLowerCase().trim();
    const otpRecord  = await OTP.findOne({ email: emailLower, purpose: 'forgot_code', verified: false });

    if (!otpRecord) return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    if (otpRecord.otp !== otp.trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const left = 5 - otpRecord.attempts;
      return res.status(400).json({ error: `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} remaining.` });
    }

    await OTP.deleteOne({ _id: otpRecord._id });

    const company = await Company.findOne({ email: emailLower });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    // Send company code email
    email.sendCompanyCodeEmail(emailLower, company.name, company.companyCode)
      .catch(err => console.error('Company code email failed:', err.message));

    res.json({ companyCode: company.companyCode, companyName: company.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FORGOT PASSWORD — Step 1: Send OTP ──────────────────────────────────────
router.post('/forgot-password/send-otp', otpRateLimit, async (req, res) => {
  try {
    const { email: emailAddr } = req.body;
    if (!emailAddr) return res.status(400).json({ error: 'Email is required' });

    const emailLower = emailAddr.toLowerCase().trim();
    const company = await Company.findOne({ email: emailLower });

    if (!company) {
      return res.json({ message: `If this email is registered, a code will be sent to ${emailLower}` });
    }

    const otp = generateOtp();
    await OTP.deleteMany({ email: emailLower, purpose: 'forgot_password' });
    await OTP.create({ email: emailLower, otp, purpose: 'forgot_password' });

    await email.sendForgotPasswordOtp(emailLower, otp);
    res.json({ message: `Verification code sent to ${emailLower}` });
  } catch (e) {
    console.error('forgot-password send-otp error:', e.message);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// ─── FORGOT PASSWORD — Step 2: Verify OTP ────────────────────────────────────
router.post('/forgot-password/verify-otp', verifyRateLimit, async (req, res) => {
  try {
    const { email: emailAddr, otp } = req.body;
    if (!emailAddr || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const emailLower = emailAddr.toLowerCase().trim();
    const otpRecord  = await OTP.findOne({ email: emailLower, purpose: 'forgot_password', verified: false });

    if (!otpRecord) return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });

    if (otpRecord.attempts >= 5) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    if (otpRecord.otp !== otp.trim()) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const left = 5 - otpRecord.attempts;
      return res.status(400).json({ error: `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} remaining.` });
    }

    // Mark verified (allow reset in next step for 10 min)
    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ message: 'OTP verified. You may now reset your password.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FORGOT PASSWORD — Step 3: Reset Password ────────────────────────────────
router.post('/forgot-password/reset', verifyRateLimit, async (req, res) => {
  try {
    const { email: emailAddr, otp, newPassword } = req.body;
    if (!emailAddr || !otp || !newPassword)
      return res.status(400).json({ error: 'Email, OTP and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const emailLower = emailAddr.toLowerCase().trim();
    // Check for verified OTP
    const otpRecord = await OTP.findOne({ email: emailLower, purpose: 'forgot_password', verified: true, otp: otp.trim() });
    if (!otpRecord) return res.status(400).json({ error: 'Session expired or invalid. Please start again.' });

    const company = await Company.findOne({ email: emailLower });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    company.password = await bcrypt.hash(newPassword, 10);
    await company.save();
    await OTP.deleteOne({ _id: otpRecord._id });

    // Confirmation email
    email.sendPasswordChangedEmail(emailLower, company.name)
      .catch(err => console.error('Password changed email failed:', err.message));

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
