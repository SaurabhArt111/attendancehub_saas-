const mongoose = require('mongoose');

// Retains the computed payroll result after detailed daily attendance is
// removed by the three-month attendance retention policy.
const payrollArchiveSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: String, required: true }, // YYYY-MM
  payroll: { type: mongoose.Schema.Types.Mixed, required: true },
  archivedAt: { type: Date, default: Date.now }
});

payrollArchiveSchema.index({ companyId: 1, employeeId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('PayrollArchive', payrollArchiveSchema);
