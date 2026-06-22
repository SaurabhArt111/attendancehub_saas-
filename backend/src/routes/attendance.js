const router     = require('express').Router();
const Attendance = require('../models/Attendance');
const Employee   = require('../models/Employee');
const { verifyAdmin, verifyEmployee } = require('../middleware/auth');

const VALID_STATUSES = ['P', 'A', 'PP'];
const JWT_SECRET = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';

// GET /api/attendance/report/:month  — must be BEFORE /:employeeId/:month
router.get('/report/:month', verifyAdmin, async (req, res) => {
  try {
    const { month } = req.params;
    const employees = await Employee.find({ companyId: req.admin.companyId }).select('-password');
    const records   = await Attendance.find({
      companyId: req.admin.companyId,
      date: { $gte: `${month}-01`, $lte: `${month}-31` }
    });

    // Group records by employeeId
    const byEmp = {};
    records.forEach(r => {
      const eid = r.employeeId.toString();
      if (!byEmp[eid]) byEmp[eid] = { P: 0, A: 0, PP: 0, remarks: [] };
      byEmp[eid][r.status] = (byEmp[eid][r.status] || 0) + 1;
      if (r.remark && r.remark.trim()) byEmp[eid].remarks.push(r.remark.trim());
    });

    // Days in month
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    const report = employees.map(e => {
      const eid  = e._id.toString();
      const data = byEmp[eid] || { P: 0, A: 0, PP: 0, remarks: [] };
      const totalPresent = data.P + data.PP * 2;

      let estimatedSalary = 0;
      if (e.salary) {
        if (e.salaryType === 'monthly') {
          estimatedSalary = e.salary;
        } else {
          // daily: multiply by actual present count (P=1 PP=2)
          estimatedSalary = Math.round(e.salary * totalPresent);
        }
      }

      return {
        id:             e._id,
        username:       e.username,
        employeeId:     e.employeeId,
        designation:    e.designation || '',
        salary:         e.salary,
        salaryType:     e.salaryType,
        daysInMonth,
        P:              data.P,
        A:              data.A,
        PP:             data.PP,
        totalPresent,
        estimatedSalary,
        remarks:        data.remarks
      };
    });
    res.json(report);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/attendance/:employeeId/:month
router.get('/:employeeId/:month', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const jwt     = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);

    const { employeeId, month } = req.params;

    if (decoded.role === 'admin') {
      const emp = await Employee.findOne({ _id: employeeId, companyId: decoded.companyId });
      if (!emp) return res.status(404).json({ error: 'Employee not found' });
    } else if (decoded.role === 'employee') {
      if (decoded.id !== employeeId) return res.status(403).json({ error: 'Unauthorized' });
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const records = await Attendance.find({
      employeeId,
      date: { $gte: `${month}-01`, $lte: `${month}-31` }
    });

    const result = {};
    records.forEach(r => {
      const day = r.date.split('-')[2];
      result[day] = { status: r.status, remark: r.remark };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/attendance
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

    const record = await Attendance.findOneAndUpdate(
      { companyId: req.admin.companyId, employeeId, date },
      { companyId: req.admin.companyId, employeeId, date, status, remark: remark || '' },
      { upsert: true, new: true }
    );
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/attendance/:employeeId/:date
router.delete('/:employeeId/:date', verifyAdmin, async (req, res) => {
  try {
    await Attendance.findOneAndDelete({
      companyId:  req.admin.companyId,
      employeeId: req.params.employeeId,
      date:       req.params.date
    });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
