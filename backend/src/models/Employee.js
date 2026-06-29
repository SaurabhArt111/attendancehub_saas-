const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  username:     { type: String, required: true, trim: true },
  employeeId:   { type: String, required: true },   // system-generated unique ID
  contact:      { type: String, default: '' },
  password:     { type: String, required: true },
  designation:  { type: String, default: '' },
  salaryType:   { type: String, enum: ['monthly', 'daily'], default: 'monthly' },
  salary:       { type: Number, default: 0 },       // fixed monthly OR daily rate
  isActive:     { type: Boolean, default: true },
  archived:     { type: Boolean, default: false },
  archivedAt:   { type: Date },
  createdAt:    { type: Date, default: Date.now }
});

employeeSchema.index({ companyId: 1, username:   1 }, { unique: true });
employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model('Employee', employeeSchema);
