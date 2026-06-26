const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true, trim: true },
  otp:       { type: String, required: true },
  purpose:   { type: String, required: true, enum: ['register', 'forgot_code', 'forgot_password'] },
  attempts:  { type: Number, default: 0 },
  verified:  { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 600 } // TTL: 10 minutes
});

otpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model('OTP', otpSchema);
