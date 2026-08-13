const router     = require('express').Router();
const Attendance = require('../models/Attendance');
const Employee   = require('../models/Employee');
const Company    = require('../models/Company');
const Holiday    = require('../models/Holiday');
const PayrollArchive = require('../models/PayrollArchive');
const { verifyAdmin, verifyEmployee } = require('../middleware/auth');
const jwt        = require('jsonwebtoken');
const { computeEmployeeMonthRow, salaryBreakdown } = require('../utils/payroll');
const { nearestLocation } = require('../utils/geo');
const { isWeekendDay } = require('../utils/weekend');

// Original three statuses stay exactly as they were for every existing
// admin-marking flow. WO/PL/HD are additive — only ever written by the new
// Weekend Management / Clock-In / Leave-request features, but an admin can
// also choose them manually from the calendar if they want to.
const VALID_STATUSES = ['P', 'A', 'PP', 'WO', 'PL', 'HD'];
const JWT_SECRET     = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';

// Helper: convert "YYYY-MM" to "MM-YYYY"
function toMonthKey(yearMonth) {
  const [y, m] = yearMonth.split('-');
  return `${m}-${y}`;
}

function daysInMonthFor(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function isWithinAttendanceWindow(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const earliest = new Date();
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(1);
  earliest.setMonth(earliest.getMonth() - 2);
  return new Date(year, monthNumber - 1, 1) >= earliest;
}

function todayParts() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  return {
    dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    monthKey: `${String(m).padStart(2, '0')}-${y}`,
    dayKey: String(d)
  };
}

function adjacentMonths(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return [-1, 0, 1].map(offset => {
    const date = new Date(year, monthNumber - 1 + offset, 1);
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  });
}

function calendarForEmployee(company, employee, month, records, holidayDates) {
  const recordsByMonth = new Map(records.map(record => [record.month, record.days]));
  return {
    month,
    holidayDates,
    joiningDate: employee.joiningDate || '',
    isWeekend: date => isWeekendDay(company, employee, date),
    statusForDate: date => {
      const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
      const days = recordsByMonth.get(monthKey);
      const key = String(date.getDate());
      const record = days?.get ? days.get(key) : days?.[key];
      return record?.status;
    }
  };
}

function monthDate(monthKey) {
  const [month, year] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

async function archiveExpiredAttendance(companyId) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(1);
  cutoff.setMonth(cutoff.getMonth() - 2);
  const records = await Attendance.find({ companyId });
  const expired = records.filter(record => monthDate(record.month) < cutoff);
  if (!expired.length) return;

  const [company, employees, holidays] = await Promise.all([
    Company.findById(companyId),
    Employee.find({ companyId }),
    Holiday.find({ companyId })
  ]);
  const employeesById = new Map(employees.map(employee => [employee._id.toString(), employee]));
  const recordsByEmployee = new Map();
  for (const record of records) {
    const id = record.employeeId.toString();
    if (!recordsByEmployee.has(id)) recordsByEmployee.set(id, []);
    recordsByEmployee.get(id).push(record);
  }
  const holidayDates = new Set(holidays.map(holiday => holiday.date));
  for (const record of expired) {
    const employee = employeesById.get(record.employeeId.toString());
    if (!employee) continue;
    const [month, year] = record.month.split('-');
    const payrollMonth = `${year}-${month}`;
    const row = computeEmployeeMonthRow(employee, record.days, daysInMonthFor(payrollMonth),
      calendarForEmployee(company, employee, payrollMonth, recordsByEmployee.get(employee._id.toString()) || [], holidayDates));
    await PayrollArchive.findOneAndUpdate(
      { companyId, employeeId: employee._id, month: payrollMonth },
      { $set: { payroll: { ...row, ...salaryBreakdown(row) }, archivedAt: new Date() } },
      { upsert: true }
    );
  }
  await Attendance.deleteMany({ _id: { $in: expired.map(record => record._id) } });
}

// GET /api/attendance/report/:month  (YYYY-MM)
router.get('/report/:month', verifyAdmin, async (req, res) => {
  try {
    await archiveExpiredAttendance(req.admin.companyId);
    const { month } = req.params;  // YYYY-MM
    const monthKey  = toMonthKey(month);
    if (!isWithinAttendanceWindow(month)) {
      const archives = await PayrollArchive.find({ companyId: req.admin.companyId, month });
      return res.json(archives.map(archive => archive.payroll));
    }

    const [company, employees, records, holidays] = await Promise.all([
      Company.findById(req.admin.companyId),
      Employee.find({ companyId: req.admin.companyId }).select('-password'),
      Attendance.find({ companyId: req.admin.companyId, month: { $in: adjacentMonths(month) } }),
      Holiday.find({ companyId: req.admin.companyId })
    ]);

    // Index by employeeId
    const byEmp = {};
    for (const rec of records) {
      const id = rec.employeeId.toString();
      if (!byEmp[id]) byEmp[id] = [];
      byEmp[id].push(rec);
    }

    const daysInMonth = daysInMonthFor(month);
    const holidayDates = new Set(holidays.map(h => h.date));
    const report = employees.map(e => {
      const employeeRecords = byEmp[e._id.toString()] || [];
      const currentRecord = employeeRecords.find(r => r.month === monthKey);
      return computeEmployeeMonthRow(e, currentRecord?.days || new Map(), daysInMonth,
        calendarForEmployee(company, e, month, employeeRecords, holidayDates));
    });
    res.json(report);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/attendance/my-report/:month  (YYYY-MM) — the logged-in employee's
// own payroll row, with the gross/overtime/deductions/net breakdown. Uses
// the exact same computation as the admin Reports endpoint above, so the
// numbers an employee sees on their Payroll page always match what their
// admin sees.
router.get('/my-report/:month', verifyEmployee, async (req, res) => {
  try {
    const { month } = req.params;
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Invalid month format' });
    const monthKey = toMonthKey(month);

    const emp = await Employee.findById(req.employee.id).select('-password -idProofData');
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    await archiveExpiredAttendance(req.employee.companyId);
    if (!isWithinAttendanceWindow(month)) {
      const archived = await PayrollArchive.findOne({ companyId: req.employee.companyId, employeeId: emp._id, month });
      if (!archived) return res.status(404).json({ error: 'Archived payroll not found' });
      return res.json({ month, ...archived.payroll });
    }

    const [company, records, holidays] = await Promise.all([
      Company.findById(req.employee.companyId),
      Attendance.find({ companyId: req.employee.companyId, employeeId: emp._id, month: { $in: adjacentMonths(month) } }),
      Holiday.find({ companyId: req.employee.companyId })
    ]);
    const record = records.find(r => r.month === monthKey);
    const daysInMonth = daysInMonthFor(month);
    const row = computeEmployeeMonthRow(emp, record?.days || new Map(), daysInMonth,
      calendarForEmployee(company, emp, month, records, new Set(holidays.map(h => h.date))));
    const breakdown = salaryBreakdown(row);

    res.json({ month, ...row, ...breakdown });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/attendance/my-report — last 6 months' net pay, oldest first, for
// the Payroll history strip. Months with no salary configured are skipped
// on the frontend, not here, so a brand-new employee just sees an empty list.
router.get('/my-report', verifyEmployee, async (req, res) => {
  try {
    const emp = await Employee.findById(req.employee.id).select('-password -idProofData');
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    await archiveExpiredAttendance(req.employee.companyId);

    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const results = await Promise.all(months.map(async (month) => {
      if (!isWithinAttendanceWindow(month)) {
        const archived = await PayrollArchive.findOne({ companyId: req.employee.companyId, employeeId: emp._id, month });
        return archived ? { month, ...archived.payroll } : { month, salary: 0, totalPresent: 0, net: 0 };
      }
      const monthKey = toMonthKey(month);
      const [company, records, holidays] = await Promise.all([
        Company.findById(req.employee.companyId),
        Attendance.find({ companyId: req.employee.companyId, employeeId: emp._id, month: { $in: adjacentMonths(month) } }),
        Holiday.find({ companyId: req.employee.companyId })
      ]);
      const record = records.find(r => r.month === monthKey);
      const daysInMonth = daysInMonthFor(month);
      const row = computeEmployeeMonthRow(emp, record?.days || new Map(), daysInMonth,
        calendarForEmployee(company, emp, month, records, new Set(holidays.map(h => h.date))));
      const breakdown = salaryBreakdown(row);
      return { month, ...row, ...breakdown };
    }));

    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Employee Clock-In / Clock-Out ───────────────────────────────────────
// Only usable when the company's attendance method is 'employee' (Settings
// → Attendance Method). Geofencing, when enabled, is enforced here on the
// server — the client-side check is only ever a courtesy prompt.

// GET /api/attendance/clock-status — today's clock state + what the
// Employee app needs to render the Clock In/Out card (method, geofencing
// config so it can request the right permissions, whether today is a
// configured Weekend day for this employee).
router.get('/clock-status', verifyEmployee, async (req, res) => {
  try {
    const [company, emp] = await Promise.all([
      Company.findById(req.employee.companyId),
      Employee.findById(req.employee.id)
    ]);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const { dateStr, monthKey, dayKey } = todayParts();
    const record = await Attendance.findOne({ companyId: req.employee.companyId, employeeId: emp._id, month: monthKey });
    const day = record?.days?.get ? record.days.get(dayKey) : record?.days?.[dayKey];

    res.json({
      method: company.settings?.method || 'admin',
      geofencing: {
        enabled: !!company.settings?.geofencing?.enabled,
        locations: (company.settings?.geofencing?.locations || []).map(l => ({
          id: l._id, name: l.name, lat: l.lat, lng: l.lng, radiusMeters: l.radiusMeters
        }))
      },
      isWeekend: isWeekendDay(company, emp, dateStr),
      date: dateStr,
      today: day ? {
        status: day.status, remark: day.remark || '',
        clockIn: day.clockIn || null, clockOut: day.clockOut || null
      } : null
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/attendance/clock-in  { lat, lng, accuracy }
router.post('/clock-in', verifyEmployee, async (req, res) => {
  try {
    const company = await Company.findById(req.employee.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if ((company.settings?.method || 'admin') !== 'employee')
      return res.status(403).json({ error: 'Employee Clock-In is not enabled for your company. Contact your admin.' });

    const { dateStr, monthKey, dayKey } = todayParts();
    const record = await Attendance.findOne({ companyId: req.employee.companyId, employeeId: req.employee.id, month: monthKey });
    const existing = record?.days?.get ? record.days.get(dayKey) : record?.days?.[dayKey];

    if (existing?.clockIn && !existing?.clockOut)
      return res.status(409).json({ error: 'You are already clocked in. Clock out first.' });
    if (existing?.clockIn && existing?.clockOut)
      return res.status(409).json({ error: "You've already clocked in and out for today." });

    const { lat, lng, accuracy } = req.body;
    const geofencing = company.settings?.geofencing;
    let withinGeofence = null, distanceMeters = undefined, locationName = '';

    if (geofencing?.enabled) {
      if (typeof lat !== 'number' || typeof lng !== 'number')
        return res.status(400).json({ error: 'Location is required to clock in. Please enable Location and try again.' });
      const nearest = nearestLocation(lat, lng, geofencing.locations);
      if (!nearest)
        return res.status(400).json({ error: 'No workplace location has been configured yet. Contact your admin.' });
      withinGeofence = nearest.withinRadius;
      distanceMeters = Math.round(nearest.distanceMeters);
      locationName = nearest.location.name;
      if (!nearest.withinRadius) {
        return res.status(403).json({
          error: `You're ${distanceMeters}m away from ${nearest.location.name}. You must be within ${nearest.location.radiusMeters}m to clock in.`,
          distanceMeters, requiredRadiusMeters: nearest.location.radiusMeters, locationName: nearest.location.name
        });
      }
    }

    const clockIn = { time: new Date(), lat, lng, accuracy, withinGeofence, distanceMeters, locationName };
    await Attendance.findOneAndUpdate(
      { companyId: req.employee.companyId, employeeId: req.employee.id, month: monthKey },
      { $set: { [`days.${dayKey}`]: { status: 'P', remark: existing?.remark || '', clockIn, source: 'employee' } } },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Clocked in', date: dateStr, clockIn });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/attendance/clock-out  { lat, lng, accuracy }
router.post('/clock-out', verifyEmployee, async (req, res) => {
  try {
    const company = await Company.findById(req.employee.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if ((company.settings?.method || 'admin') !== 'employee')
      return res.status(403).json({ error: 'Employee Clock-In is not enabled for your company. Contact your admin.' });

    const { dateStr, monthKey, dayKey } = todayParts();
    const record = await Attendance.findOne({ companyId: req.employee.companyId, employeeId: req.employee.id, month: monthKey });
    const existing = record?.days?.get ? record.days.get(dayKey) : record?.days?.[dayKey];

    if (!existing?.clockIn) return res.status(409).json({ error: "You haven't clocked in yet today." });
    if (existing?.clockOut) return res.status(409).json({ error: "You've already clocked out for today." });

    const { lat, lng, accuracy } = req.body;
    const geofencing = company.settings?.geofencing;
    let withinGeofence = null, distanceMeters = undefined, locationName = '';

    if (geofencing?.enabled) {
      if (typeof lat !== 'number' || typeof lng !== 'number')
        return res.status(400).json({ error: 'Location is required to clock out. Please enable Location and try again.' });
      const nearest = nearestLocation(lat, lng, geofencing.locations);
      if (nearest) {
        withinGeofence = nearest.withinRadius;
        distanceMeters = Math.round(nearest.distanceMeters);
        locationName = nearest.location.name;
        if (!nearest.withinRadius) {
          return res.status(403).json({
            error: `You're ${distanceMeters}m away from ${nearest.location.name}. You must be within ${nearest.location.radiusMeters}m to clock out.`,
            distanceMeters, requiredRadiusMeters: nearest.location.radiusMeters, locationName: nearest.location.name
          });
        }
      }
    }

    const clockOut = { time: new Date(), lat, lng, accuracy, withinGeofence, distanceMeters, locationName };
    await Attendance.findOneAndUpdate(
      { companyId: req.employee.companyId, employeeId: req.employee.id, month: monthKey },
      { $set: { [`days.${dayKey}.clockOut`]: clockOut } },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Clocked out', date: dateStr, clockOut });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/attendance/:employeeId/:month  (month = YYYY-MM)
router.get('/:employeeId/:month', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, JWT_SECRET);

    const { employeeId, month } = req.params;
    await archiveExpiredAttendance(decoded.companyId);
    if (!/^\d{4}-\d{2}$/.test(month) || !isWithinAttendanceWindow(month)) {
      return res.status(403).json({ error: 'Attendance is available for the current month and previous two months only' });
    }
    const monthKey = toMonthKey(month);
    let employee;

    if (decoded.role === 'admin') {
      employee = await Employee.findOne({ _id: employeeId, companyId: decoded.companyId });
      if (!employee) return res.status(404).json({ error: 'Employee not found' });
    } else if (decoded.role === 'employee') {
      if (decoded.id !== employeeId) return res.status(403).json({ error: 'Unauthorized' });
      employee = await Employee.findOne({ _id: employeeId, companyId: decoded.companyId });
      if (!employee) return res.status(404).json({ error: 'Employee not found' });
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [record, company, holidays] = await Promise.all([
      Attendance.findOne({ companyId: decoded.companyId, employeeId, month: monthKey }),
      Company.findById(decoded.companyId),
      Holiday.find({ companyId: decoded.companyId, date: { $regex: `^${month}` } })
    ]);
    // Convert Map to plain object for JSON response, zero-padding day keys
    const result = {};
    if (record && record.days) {
      const daysObj = record.days instanceof Map ? Object.fromEntries(record.days) : record.days;
      Object.entries(daysObj).forEach(([day, val]) => {
        const paddedDay = String(day).padStart(2, '0');
        result[paddedDay] = {
          status: val.status, remark: val.remark || '',
          clockIn: val.clockIn || undefined, clockOut: val.clockOut || undefined
        };
      });
    }
    const holidayDates = new Set(holidays.map(holiday => holiday.date));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysInMonth = daysInMonthFor(month);
    for (let day = 1; day <= daysInMonth; day++) {
      const dayKey = String(day).padStart(2, '0');
      const date = `${month}-${dayKey}`;
      const calendarDate = new Date(`${date}T00:00:00`);
      if (calendarDate < today && (!employee.joiningDate || date >= employee.joiningDate) && !result[dayKey] && !holidayDates.has(date) && !isWeekendDay(company, employee, date)) {
        result[dayKey] = { status: 'A', remark: '' };
      }
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
