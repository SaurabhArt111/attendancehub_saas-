const mongoose = require('mongoose');

// Web Push subscription for a browser/device — used to deliver "New session"
// alerts (and other push notifications) to an admin's already-trusted devices.
const pushSubscriptionSchema = new mongoose.Schema({
  endpoint:  { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth:   { type: String, required: true }
  },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' }, // which device/session owns this subscription
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const adminSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  username:  { type: String, required: true, trim: true },
  adminId:   { type: String, required: true },
  email:     { type: String, default: '', trim: true, lowercase: true },
  contact:   { type: String, default: '' },
  password:  { type: String, required: true },
  isOwner:   { type: Boolean, default: false },
  pushSubscriptions: { type: [pushSubscriptionSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

adminSchema.index({ companyId: 1, username: 1 }, { unique: true });
adminSchema.index({ companyId: 1, adminId:  1 }, { unique: true });

module.exports = mongoose.model('Admin', adminSchema);
