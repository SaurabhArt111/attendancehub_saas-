const mongoose = require('mongoose');

// status: 'P' = Present, 'A' = Absent, 'PP' = Double
const attendanceSchema = new mongoose.Schema({
  companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company',  required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date:       { type: String, required: true },   // YYYY-MM-DD
  status:     { type: String, enum: ['P', 'A', 'PP'], required: true },
  remark:     { type: String, default: '' }
});

attendanceSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
