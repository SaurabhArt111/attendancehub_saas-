const router            = require('express').Router();
const AttendanceRequest = require('../models/AttendanceRequest');
const Attendance        = require('../models/Attendance');
const Employee          = require('../models/Employee');
const Company           = require('../models/Company');
const { verifyAdmin, verifyEmployee } = require('../middleware/auth');
const { isWeekendDay } = require('../utils/weekend');

const VALID_STATUSES = ['P', 'A', 'PP', 'WO', 'PL', 'HD'];

function toMonthKeyDayKey(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return { monthKey: `${m}-${y}`, dayKey: String(parseInt(d, 10)) };
}

// Writes a single day's attendance record — the exact same shape the
// admin's manual calendar (POST /api/attendance) writes — so an approved
// request is indistinguishable from an admin-marked day.
async function writeDay(companyId, employeeId, dateStr, status, remark) {
  const { monthKey, dayKey } = toMonthKeyDayKey(dateStr);
  await Attendance.findOneAndUpdate(
    { companyId, employeeId, month: monthKey },
    { $set: { [`days.${dayKey}`]: { status, remark: remark || '', source: 'admin' } } },
    { upsert: true, new: true }
  );
}

function eachDateInRange(startStr, endStr) {
  const dates = [];
  let cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (cur <= end) {
    const y = cur.getFullYear(), m = cur.getMonth() + 1, d = cur.getDate();
    dates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function serialize(r) {
  return {
    id: r._id, type: r.type, status: r.status,
    date: r.date, requestedClockIn: r.requestedClockIn, requestedClockOut: r.requestedClockOut,
    requestedStatus: r.requestedStatus,
    leaveKind: r.leaveKind, startDate: r.startDate, endDate: r.endDate, halfDaySession: r.halfDaySession,
    reason: r.reason, adminRemark: r.adminRemark,
    createdAt: r.createdAt, reviewedAt: r.reviewedAt,
    employee: r.employeeId && r.employeeId.username ? {
      id: r.employeeId._id, username: r.employeeId.username, employeeId: r.employeeId.employeeId
    } : undefined
  };
}

// ── Employee side ────────────────────────────────────────────────────────

// POST /api/requests — submit a correction or leave request
router.post('/', verifyEmployee, async (req, res) => {
  try {
    const { type, date, requestedClockIn, requestedClockOut, requestedStatus,
            leaveKind, startDate, endDate, halfDaySession, reason } = req.body;

    if (!reason || !reason.trim()) return res.status(400).json({ error: 'A reason is required' });
    if (!['correction', 'leave'].includes(type)) return res.status(400).json({ error: 'Invalid request type' });

    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (type === 'correction') {
      if (!date) return res.status(400).json({ error: 'Date is required for a correction request' });
      if (new Date(date + 'T00:00:00') > today) return res.status(400).json({ error: 'Cannot request a correction for a future date' });
      if (requestedStatus && !VALID_STATUSES.includes(requestedStatus))
        return res.status(400).json({ error: 'Invalid requested status' });

      const doc = await AttendanceRequest.create({
        companyId: req.employee.companyId, employeeId: req.employee.id, type: 'correction',
        date, requestedClockIn: requestedClockIn || '', requestedClockOut: requestedClockOut || '',
        requestedStatus: requestedStatus || '', reason: reason.trim()
      });
      return res.status(201).json(serialize(doc));
    }

    // Leave
    if (!['full', 'half'].includes(leaveKind)) return res.status(400).json({ error: 'leaveKind must be "full" or "half"' });
    if (!startDate) return res.status(400).json({ error: 'Start date is required' });
    const finalEnd = leaveKind === 'half' ? startDate : (endDate || startDate);
    if (new Date(finalEnd + 'T00:00:00') < new Date(startDate + 'T00:00:00'))
      return res.status(400).json({ error: 'End date cannot be before start date' });
    if (leaveKind === 'half' && !['first', 'second'].includes(halfDaySession))
      return res.status(400).json({ error: 'Half-day leave requires a session: "first" or "second"' });

    const doc = await AttendanceRequest.create({
      companyId: req.employee.companyId, employeeId: req.employee.id, type: 'leave',
      leaveKind, startDate, endDate: finalEnd,
      halfDaySession: leaveKind === 'half' ? halfDaySession : '',
      reason: reason.trim()
    });
    res.status(201).json(serialize(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/requests/mine — the logged-in employee's own requests
router.get('/mine', verifyEmployee, async (req, res) => {
  try {
    const list = await AttendanceRequest.find({ companyId: req.employee.companyId, employeeId: req.employee.id })
      .sort({ createdAt: -1 });
    res.json(list.map(serialize));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/requests/:id — cancel own pending request
router.delete('/:id', verifyEmployee, async (req, res) => {
  try {
    const doc = await AttendanceRequest.findOne({ _id: req.params.id, employeeId: req.employee.id });
    if (!doc) return res.status(404).json({ error: 'Request not found' });
    if (doc.status !== 'pending') return res.status(409).json({ error: 'Only pending requests can be cancelled' });
    await doc.deleteOne();
    res.json({ message: 'Request cancelled' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin side ───────────────────────────────────────────────────────────

// GET /api/requests?status=pending — list company requests (all by default)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const filter = { companyId: req.admin.companyId };
    if (req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    const list = await AttendanceRequest.find(filter)
      .populate('employeeId', 'username employeeId')
      .sort({ createdAt: -1 });
    res.json(list.map(serialize));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/requests/:id/approve  { adminRemark }
router.put('/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const doc = await AttendanceRequest.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!doc) return res.status(404).json({ error: 'Request not found' });
    if (doc.status !== 'pending') return res.status(409).json({ error: `This request was already ${doc.status}` });

    if (doc.type === 'correction') {
      const status = doc.requestedStatus || 'P';
      await writeDay(req.admin.companyId, doc.employeeId, doc.date, status, '');
    } else {
      const company  = await Company.findById(req.admin.companyId);
      const employee = await Employee.findById(doc.employeeId);
      const dates = eachDateInRange(doc.startDate, doc.endDate);
      const status = doc.leaveKind === 'half' ? 'HD' : 'PL';
      for (const d of dates) {
        // Skip days that are configured Weekend days for this employee —
        // leave shouldn't consume/pay out a day nobody was scheduled to work.
        if (isWeekendDay(company, employee, d)) continue;
        await writeDay(req.admin.companyId, doc.employeeId, d, status, '');
      }
    }

    doc.status = 'approved';
    doc.adminRemark = '';
    doc.reviewedBy = req.admin.id;
    doc.reviewedAt = new Date();
    await doc.save();
    res.json(serialize(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/requests/:id/reject  { adminRemark }
router.put('/:id/reject', verifyAdmin, async (req, res) => {
  try {
    const doc = await AttendanceRequest.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!doc) return res.status(404).json({ error: 'Request not found' });
    if (doc.status !== 'pending') return res.status(409).json({ error: `This request was already ${doc.status}` });

    doc.status = 'rejected';
    doc.adminRemark = '';
    doc.reviewedBy = req.admin.id;
    doc.reviewedAt = new Date();
    await doc.save();
    res.json(serialize(doc));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
