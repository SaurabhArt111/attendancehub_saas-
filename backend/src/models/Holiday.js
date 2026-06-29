const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

// Unique per company-date
holidaySchema.index({ companyId: 1, date: 1 }, { unique: true });
// For quick lookup
holidaySchema.index({ companyId: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);
