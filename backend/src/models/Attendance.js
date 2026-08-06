const mongoose = require('mongoose');

// A single Clock In or Clock Out punch — captured automatically when the
// Employee Clock-In/Clock-Out method is enabled. `withinGeofence` is null
// when geofencing was off at the time of the punch (so it's never confused
// with an explicit "outside the fence" false).
const punchSchema = new mongoose.Schema({
  time:           { type: Date, required: true },
  lat:            { type: Number },
  lng:            { type: Number },
  accuracy:       { type: Number },       // meters, from the browser Geolocation API
  withinGeofence: { type: Boolean, default: null },
  distanceMeters: { type: Number }        // distance to the nearest configured workplace location
}, { _id: false });

// Monthly attendance structure: one document per employee per month
// days: { "1": { status: "P", remark: "" }, "2": { status: "A" }, ... }
//
// Status codes:
//   P  = Present            A  = Absent            PP = Double Shift (existing)
//   WO = Weekly Off          PL = Paid Leave         HD = Half-Day Leave (new — additive)
// Existing P/A/PP records and every place that reads/writes them are
// completely unaffected; the new codes are only ever written by the new
// Weekend Management / Clock-In / Leave-request features.
const dayRecordSchema = new mongoose.Schema({
  status: { type: String, enum: ['P', 'A', 'PP', 'WO', 'PL', 'HD'], required: true },
  remark: { type: String, default: '' },

  // Populated only when this day's Present status came from the employee's
  // own Clock In / Clock Out (Employee Clock-In/Clock-Out method). Left
  // undefined for admin-marked days, exactly as before.
  clockIn:  { type: punchSchema },
  clockOut: { type: punchSchema },
  // 'admin' (default, original behavior) | 'employee' (self clock-in/out)
  source:   { type: String, enum: ['admin', 'employee'], default: 'admin' }
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
