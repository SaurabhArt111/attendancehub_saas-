const router = require('express').Router();
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Holiday = require('../models/Holiday');
const Designation = require('../models/Designation');
const { verifyAdmin, verifyEmployee } = require('../middleware/auth');

const VALID_STATUSES = ['P', 'A', 'PP', 'H'];

// Helper: Format date as MM-YYYY
function getMonthKey(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}-${year}`;
}

// Helper: Get days in month
function daysInMonth(monthStr) {
  const [month, year] = monthStr.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

// GET /api/attendance/report/:month — monthly attendance report for all employees
router.get('/report/:month', verifyAdmin, async (req, res) => {
  try {
    const { month } = req.params;

    // Validate month format
    if (!/^\d{2}-\d{4}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format (use MM-YYYY)' });
    }

    const daysCount = daysInMonth(month);

    // Get all active employees
    const employees = await Employee.find({
      companyId: req.admin.companyId,
      isActive: true,
    })
      .populate('designationId', 'name')
      .select('-password');

    // Get attendance records for the month
    const attendanceRecords = await Attendance.findOne({
      companyId: req.admin.companyId,
      month,
    });

    // Get holidays for the month
    const holidays = await Holiday.find({
      companyId: req.admin.companyId,
      date: { $gte: `${month}-01`, $lte: `${month}-${daysCount}` },
    });

    const holidayDates = new Set(holidays.map(h => h.date.split('-')[2]));

    // Generate report
    const report = employees.map(emp => {
      const empDays = attendanceRecords?.days?.get(emp._id.toString()) || {};

      let P = 0, A = 0, PP = 0, H = 0;
      const remarks = [];

      // Count statuses
      for (let day = 1; day <= daysCount; day++) {
        const dayData = empDays[day];
        if (dayData) {
          if (dayData.status === 'P') P++;
          else if (dayData.status === 'A') A++;
          else if (dayData.status === 'PP') PP++;
          else if (dayData.status === 'H') H++;

          if (dayData.remark) remarks.push(dayData.remark);
        } else if (holidayDates.has(String(day).padStart(2, '0'))) {
          H++;
        }
      }

      const totalPresent = P + PP * 2;

      let estimatedSalary = 0;
      if (emp.salary) {
        if (emp.salaryType === 'monthly') {
          estimatedSalary = emp.salary;
        } else {
          estimatedSalary = Math.round(emp.salary * totalPresent);
        }
      }

      return {
        id: emp._id,
        name: emp.username,
        employeeId: emp.employeeId,
        email: emp.email,
        contact: emp.contact,
        designation: emp.designationId?.name || '-',
        salary: emp.salary,
        salaryType: emp.salaryType,
        daysInMonth: daysCount,
        P,
        A,
        PP,
        H,
        totalPresent,
        estimatedSalary,
        remarks,
      };
    });

    res.json(report);
  } catch (e) {
    console.error('Attendance report error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attendance/:employeeId/:month — get attendance for specific employee-month
router.get('/:employeeId/:month', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';
    const decoded = jwt.verify(token, JWT_SECRET);

    const { employeeId, month } = req.params;

    // Permission check
    if (decoded.role === 'admin') {
      const emp = await Employee.findOne({
        _id: employeeId,
        companyId: decoded.companyId,
      });
      if (!emp) return res.status(404).json({ error: 'Employee not found' });
    } else if (decoded.role === 'employee') {
      if (decoded.id !== employeeId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get attendance document
    const attendance = await Attendance.findOne({
      employeeId,
      month,
    });

    const result = {};
    if (attendance && attendance.days) {
      attendance.days.forEach((dayData, day) => {
        result[day] = { status: dayData.status, remark: dayData.remark };
      });
    }

    res.json(result);
  } catch (e) {
    console.error('Get attendance error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/attendance — mark attendance for a day
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { employeeId, date, status, remark } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        error: 'employeeId, date (YYYY-MM-DD), and status are required',
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Prevent marking future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attDate = new Date(date + 'T00:00:00');
    if (attDate > today) {
      return res.status(400).json({ error: 'Cannot mark attendance for future dates' });
    }

    // Verify employee exists
    const emp = await Employee.findOne({
      _id: employeeId,
      companyId: req.admin.companyId,
    });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Get month key
    const month = getMonthKey(date);
    const day = date.split('-')[2]; // Extract day from YYYY-MM-DD

    // Update or create monthly attendance document
    const attendance = await Attendance.findOneAndUpdate(
      { companyId: req.admin.companyId, employeeId, month },
      {
        $set: {
          [`days.${day}`]: {
            status,
            remark: remark || '',
          },
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      message: 'Attendance marked',
      attendance: {
        employeeId,
        date,
        status,
        remark: remark || '',
      },
    });
  } catch (e) {
    console.error('Mark attendance error:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/attendance/:employeeId/:date — remove attendance record
router.delete('/:employeeId/:date', verifyAdmin, async (req, res) => {
  try {
    const { employeeId, date } = req.params;
    const month = getMonthKey(date);
    const day = date.split('-')[2];

    const result = await Attendance.findOneAndUpdate(
      {
        companyId: req.admin.companyId,
        employeeId,
        month,
      },
      { $unset: { [`days.${day}`]: 1 } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.json({ message: 'Attendance deleted' });
  } catch (e) {
    console.error('Delete attendance error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
