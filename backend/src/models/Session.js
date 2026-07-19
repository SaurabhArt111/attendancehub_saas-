const mongoose = require('mongoose');

// Tracks individual logged-in devices/sessions for an account (currently used for Admins).
// The JWT carries this document's _id as `sid`. On every authenticated request the
// session is looked up, its activity timestamps are refreshed, and a new sliding
// JWT (fresh 30-day expiry) is issued back to the client.
const sessionSchema = new mongoose.Schema({
  role:         { type: String, enum: ['admin', 'employee'], required: true },
  userId:       { type: mongoose.Schema.Types.ObjectId, required: true }, // Admin or Employee _id
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

  // Device / origin info captured at login time
  userAgent:    { type: String, default: '' },
  ip:           { type: String, default: '' },
  deviceLabel:  { type: String, default: 'Unknown device' }, // e.g. "Chrome on Windows"
  deviceType:   { type: String, default: 'desktop' },        // desktop | mobile | tablet

  createdAt:    { type: Date, default: Date.now },  // login time
  lastActiveAt: { type: Date, default: Date.now },
  expiresAt:    { type: Date, required: true },      // sliding: now + 30d, refreshed each request

  revoked:      { type: Boolean, default: false },
  revokedAt:    { type: Date },
  revokedReason:{ type: String, default: '' } // 'user', 'device-limit', 'logout-others'
});

sessionSchema.index({ userId: 1, revoked: 1, expiresAt: 1 });
sessionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Session', sessionSchema);
