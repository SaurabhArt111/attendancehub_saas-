const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name:      { type: String, required: true, trim: true }
});

designationSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Designation', designationSchema);
