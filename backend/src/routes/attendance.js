const router     = require('express').Router();
const Attendance = require('../models/Attendance');
const Employee   = require('../models/Employee');
const { verifyAdmin, verifyEmployee } = require('../middleware/auth');
const jwt        = require('jsonwebtoken');

const VALID_STATUSES = ['P', 'A', 'PP'];
const JWT_SECRET     = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';

// Helper: convert "YYYY-MM" to "MM-YYYY"
function toMonthKey(yearMonth) {
  const [y, m] = yearMonth.split('-');
  return `${m}-${y}`;
}

// GET /api/attendance/report/:month  (YYYY-MM)
router.get('/report/:month', verifyAdmin, async (req, res) => {
  try {
    const { month } = req.params;  // YYYY-MM
    const monthKey  = toMonthKey(month);

    const employees = await Employee.find({ companyId: req.admin.companyId }).select('-password');
    const records   = await Attendance.find({ companyId: req.admin.companyId, month: monthKey });

    // Index by employeeId
    const byEmp = {};
    for (const rec of records) {
      byEmp[rec.employeeId.toString()] = rec.days;
    }

    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    const report = employees.map(e => {
      const eid      = e._id.toString();
      const daysMap  = byEmp[eid] || new Map();
      let P = 0, A = 0, PP = 0;
      const remarks  = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const rec = daysMap.get ? daysMap.get(String(d)) : daysMap[String(d)];
        if (!rec) continue;
        if (rec.status === 'P')  P++;
        if (rec.status === 'A')  A++;
        if (rec.status === 'PP') PP++;
        if (rec.remark && rec.remark.trim()) remarks.push(rec.remark.trim());
      }

      const totalPresent = P + PP * 2;
      const monthlySalary = e.salary || 0;
      const dailySalary = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
      const estimatedSalary = Math.round(dailySalary * totalPresent);

      return {
        id: e._id, username: e.username, employeeId: e.employeeId,
        designation: e.designation || '', salary: monthlySalary, salaryType: 'monthly',
        dailySalary: Math.round(dailySalary * 100) / 100,
        daysInMonth, P, A, PP, totalPresent, estimatedSalary, remarks
      };
    });
    res.json(report);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/attendance/:employeeId/:month  (month = YYYY-MM)
router.get('/:employeeId/:month', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, JWT_SECRET);

    const { employeeId, month } = req.params;
    const monthKey = toMonthKey(month);

    if (decoded.role === 'admin') {
      const emp = await Employee.findOne({ _id: employeeId, companyId: decoded.companyId });
      if (!emp) return res.status(404).json({ error: 'Employee not found' });
    } else if (decoded.role === 'employee') {
      if (decoded.id !== employeeId) return res.status(403).json({ error: 'Unauthorized' });
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const record = await Attendance.findOne({ employeeId, month: monthKey });
    // Convert Map to plain object for JSON response, zero-padding day keys
    const result = {};
    if (record && record.days) {
      const daysObj = record.days instanceof Map ? Object.fromEntries(record.days) : record.days;
      Object.entries(daysObj).forEach(([day, val]) => {
        const paddedDay = String(day).padStart(2, '0');
        result[paddedDay] = { status: val.status, remark: val.remark || '' };
      });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/attendance  — mark or update a single day
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { employeeId, date, status, remark } = req.body;
    if (!employeeId || !date || !status)
      return res.status(400).json({ error: 'employeeId, date, and status required' });
    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` });

    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const attDate = new Date(date + 'T00:00:00');
    if (attDate > today) return res.status(400).json({ error: 'Cannot mark attendance for future dates' });

    const emp = await Employee.findOne({ _id: employeeId, companyId: req.admin.companyId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Build month key MM-YYYY and day key
    const [y, m, d] = date.split('-');
    const monthKey  = `${m}-${y}`;
    const dayKey    = String(parseInt(d, 10)); // strip leading zero

    await Attendance.findOneAndUpdate(
      { companyId: req.admin.companyId, employeeId, month: monthKey },
      { $set: { [`days.${dayKey}`]: { status, remark: remark || '' } } },
      { upsert: true, new: true }
    );
    res.status(201).json({ month: monthKey, day: dayKey, status, remark: remark || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/attendance/bulk  — mark the SAME day/status/remark for MULTIPLE employees at once
router.post('/bulk', verifyAdmin, async (req, res) => {
  try {
    const { employeeIds, date, status, remark } = req.body;
    if (!Array.isArray(employeeIds) || !employeeIds.length)
      return res.status(400).json({ error: 'employeeIds array required' });
    if (!date || !status)
      return res.status(400).json({ error: 'date and status required' });
    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` });

    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const attDate = new Date(date + 'T00:00:00');
    if (attDate > today) return res.status(400).json({ error: 'Cannot mark attendance for future dates' });

    const [y, m, d] = date.split('-');
    const monthKey  = `${m}-${y}`;
    const dayKey    = String(parseInt(d, 10));

    // Only touch employees that actually belong to this admin's company.
    const validEmployees = await Employee.find({
      _id: { $in: employeeIds }, companyId: req.admin.companyId
    }).select('_id username');
    const validIds = validEmployees.map(e => e._id.toString());
    const skipped  = employeeIds.filter(id => !validIds.includes(String(id)));

    await Promise.all(validIds.map(employeeId =>
      Attendance.findOneAndUpdate(
        { companyId: req.admin.companyId, employeeId, month: monthKey },
        { $set: { [`days.${dayKey}`]: { status, remark: remark || '' } } },
        { upsert: true, new: true }
      )
    ));

    res.status(201).json({
      month: monthKey, day: dayKey, status, remark: remark || '',
      updated: validEmployees.map(e => ({ id: e._id, username: e.username })),
      updatedCount: validIds.length,
      skippedCount: skipped.length
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/attendance/:employeeId/:date  (date = YYYY-MM-DD)
router.delete('/:employeeId/:date', verifyAdmin, async (req, res) => {
  try {
    const { employeeId, date } = req.params;
    const [y, m, d] = date.split('-');
    const monthKey  = `${m}-${y}`;
    const dayKey    = String(parseInt(d, 10));

    await Attendance.findOneAndUpdate(
      { companyId: req.admin.companyId, employeeId, month: monthKey },
      { $unset: { [`days.${dayKey}`]: '' } }
    );
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
