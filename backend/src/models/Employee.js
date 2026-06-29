const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    username: { type: String, required: true, trim: true },
    employeeId: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    contact: { type: String, default: '', trim: true },
    // Reference to Designation instead of free text
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    salaryType: { type: String, enum: ['monthly', 'daily'], default: 'monthly' },
    salary: { type: Number, default: 0 },
    password: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique per company
employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, isActive: 1 });
employeeSchema.index({ designationId: 1 }); // For cascade updates/deletes

module.exports = mongoose.model('Employee', employeeSchema);
