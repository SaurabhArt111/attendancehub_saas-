const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    contact: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    isOwner: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Unique index: one admin per company-email combination
adminSchema.index({ companyId: 1, email: 1 }, { unique: true });
// For owner lookup
adminSchema.index({ companyId: 1, isOwner: 1 });

module.exports = mongoose.model('Admin', adminSchema);
