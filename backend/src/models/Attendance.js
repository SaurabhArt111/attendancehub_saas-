const mongoose = require('mongoose');

// Monthly attendance structure: one document per employee per month
// days: { "1": { status: "P", remark: "" }, "2": { status: "A" }, ... }
const dayRecordSchema = new mongoose.Schema({
  status: { type: String, enum: ['P', 'A', 'PP'], required: true },
  remark: { type: String, default: '' }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company',  required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month:      { type: String, required: true }, // MM-YYYY e.g. "06-2026"
  days:       { type: Map, of: dayRecordSchema, default: {} }
});

attendanceSchema.index({ companyId: 1, employeeId: 1, month: 1 }, { unique: true });
attendanceSchema.index({ companyId: 1, month: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
