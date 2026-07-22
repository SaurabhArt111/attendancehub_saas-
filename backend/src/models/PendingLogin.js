const mongoose = require('mongoose');

// Created whenever an admin's credentials check out on a device/browser while
// the account already has other active sessions. The new device is held here
// pending approval: it is shown a short "security key" (code); a device that
// is already signed in must enter that same code (via Settings → Login Code
// for Another Session) to let the new device finish signing in.
const pendingLoginSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  adminId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },

  code: { type: String, required: true }, // 6-digit security key shown on the new device

  // Device / origin info captured from the *new* device's login attempt
  userAgent:   { type: String, default: '' },
  ip:          { type: String, default: '' },
  deviceLabel: { type: String, default: 'Unknown device' },
  deviceType:  { type: String, default: 'desktop' },

  status: { type: String, enum: ['pending', 'approved', 'denied', 'expired'], default: 'pending' },

  approvedSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' }, // set once approved
  approvedBySessionId: { type: mongoose.Schema.Types.ObjectId }, // which existing device approved it

  createdAt: { type: Date, default: Date.now },
  // TTL — Mongo automatically removes this document once expiresAt passes.
  expiresAt: { type: Date, required: true, expires: 0 }
});

pendingLoginSchema.index({ adminId: 1, status: 1 });

module.exports = mongoose.model('PendingLogin', pendingLoginSchema);
