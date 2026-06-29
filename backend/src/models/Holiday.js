const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  date:      { type: String, required: true },   // YYYY-MM-DD
  name:      { type: String, required: true, trim: true }
});

holidaySchema.index({ companyId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaySchema);
