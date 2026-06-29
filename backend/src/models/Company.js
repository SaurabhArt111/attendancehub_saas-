const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    companyCode: { type: String, required: true, unique: true, uppercase: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contact: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index for faster lookups
// companySchema.index({ companyCode: 1 });
// companySchema.index({ email: 1 });

module.exports = mongoose.model('Company', companySchema);
