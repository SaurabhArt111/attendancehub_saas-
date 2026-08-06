const mongoose = require('mongoose');

// Employee-submitted requests: missed Clock-In/Clock-Out corrections and
// Leave applications (single-day, multi-day, or Half-Day). Admin reviews and
// approves/rejects — approval writes the resulting attendance record through
// the exact same attendance-marking logic the admin's manual calendar uses,
// so nothing about how attendance is stored changes because of this feature.
const attendanceRequestSchema = new mongoose.Schema({
  companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company',  required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

  // 'correction' — missed Clock-In/Clock-Out or a wrong day's status
  // 'leave'      — leave application (single-day, multi-day, or half-day)
  type: { type: String, enum: ['correction', 'leave'], required: true },

  // ── Correction fields ──────────────────────────────────────────────
  date:               { type: String },  // YYYY-MM-DD — the day being corrected
  requestedClockIn:   { type: String, default: '' }, // HH:MM (24h), optional
  requestedClockOut:  { type: String, default: '' }, // HH:MM (24h), optional
  requestedStatus:    { type: String, enum: ['P', 'A', 'PP', ''], default: '' },

  // ── Leave fields ─────────────────────────────────────────────────────
  leaveKind:      { type: String, enum: ['full', 'half', ''], default: '' },
  startDate:      { type: String }, // YYYY-MM-DD
  endDate:        { type: String }, // YYYY-MM-DD (same as startDate for single-day/half-day)
  halfDaySession: { type: String, enum: ['first', 'second', ''], default: '' },

  reason: { type: String, required: true, trim: true },

  status:       { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminRemark:  { type: String, default: '' },
  reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt:   { type: Date },

  createdAt: { type: Date, default: Date.now }
});

attendanceRequestSchema.index({ companyId: 1, employeeId: 1, createdAt: -1 });
attendanceRequestSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('AttendanceRequest', attendanceRequestSchema);
