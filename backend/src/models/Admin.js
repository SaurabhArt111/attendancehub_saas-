const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  username:  { type: String, required: true, trim: true },
  adminId:   { type: String, required: true },
  email:     { type: String, default: '', trim: true, lowercase: true },
  contact:   { type: String, default: '' },
  password:  { type: String, required: true },
  isOwner:   { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

adminSchema.index({ companyId: 1, username: 1 }, { unique: true });
adminSchema.index({ companyId: 1, adminId:  1 }, { unique: true });

module.exports = mongoose.model('Admin', adminSchema);
