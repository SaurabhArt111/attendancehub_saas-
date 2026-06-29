const mongoose = require('mongoose');

// Monthly attendance structure: One document per employee per month
// Example: { employeeId, companyId, month: "06-2026", days: { "1": { status: "P" }, "2": { status: "A", remark: "Sick" } } }
const attendanceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true }, // Format: MM-YYYY (e.g., "06-2026")
    days: {
      type: Map,
      of: new mongoose.Schema(
        {
          status: { type: String, enum: ['P', 'A', 'PP', 'H'], required: true }, // P=Present, A=Absent, PP=Double, H=Holiday
          remark: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: new Map(),
    },
  },
  { timestamps: true }
);

// Unique per employee per month
attendanceSchema.index({ companyId: 1, employeeId: 1, month: 1 }, { unique: true });
// For fast queries by company and month
attendanceSchema.index({ companyId: 1, month: 1 });
// For monthly reports
attendanceSchema.index({ companyId: 1, month: 1, employeeId: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
