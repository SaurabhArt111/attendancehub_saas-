const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const Employee = require('../models/Employee');
const { verifyAdmin, verifyEmployee } = require('../middleware/auth');

const JWT_SECRET  = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function randomChunk(length) {
  let out = '';
  for (let i = 0; i < length; i++) out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  return out;
}
function employeePrefix(companyName) {
  const words = companyName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  return words.slice(0, 3).map(w => (w.replace(/[^a-zA-Z]/g, '')[0] || 'X').toUpperCase()).join('').padEnd(3, 'X');
}
async function generateEmployeeId(companyId, companyName) {
  const prefix = employeePrefix(companyName);
  let id = `${prefix}${randomChunk(4)}`;
  let exists = await Employee.findOne({ employeeId: id });
  while (exists) { id = `${prefix}${randomChunk(4)}`; exists = await Employee.findOne({ employeeId: id }); }
  return id;
}

// POST /api/employees/login
router.post('/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) return res.status(400).json({ error: 'Employee ID and password required' });
    const emp = await Employee.findOne({ employeeId: { $regex: new RegExp(`^${escapeRegex(employeeId.trim())}$`, 'i') } });
    if (!emp || !await bcrypt.compare(password, emp.password))
      return res.status(401).json({ error: 'Invalid Employee ID or password' });
    if (!emp.isActive) return res.status(403).json({ error: 'Account deactivated' });
    const Company = require('../models/Company');
    const company = await Company.findById(emp.companyId);
    const token = jwt.sign(
      { id: emp._id, companyId: emp.companyId, username: emp.username, role: 'employee' },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({
      token,
      employee: { id: emp._id, username: emp.username, employeeId: emp.employeeId, contact: emp.contact, designation: emp.designation },
      company: { name: company?.name, companyCode: company?.companyCode }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees/suggest-id  — before /:id routes
router.get('/suggest-id', verifyAdmin, async (req, res) => {
  try {
    const Company = require('../models/Company');
    const company = await Company.findById(req.admin.companyId);
    const id = await generateEmployeeId(req.admin.companyId, company.name);
    res.json({ employeeId: id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees/me  — before /:id routes
router.get('/me', verifyEmployee, async (req, res) => {
  try {
    const emp = await Employee.findById(req.employee.id).select('-password');
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees/archived  — before /:id routes
router.get('/archived', verifyAdmin, async (req, res) => {
  try {
    const employees = await Employee.find({ companyId: req.admin.companyId, archived: true })
      .select('-password').sort({ archivedAt: -1 });
    res.json(employees);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees  (active only)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const employees = await Employee.find({ companyId: req.admin.companyId, archived: { $ne: true } })
      .select('-password').sort({ createdAt: 1 });
    res.json(employees);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employees
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { username, employeeId, contact, password, salary, designation } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const companyId = req.admin.companyId;
    if (await Employee.findOne({ companyId, username: { $regex: new RegExp(`^${username}$`, 'i') }, archived: { $ne: true } }))
      return res.status(409).json({ error: 'Username already exists' });
    let finalId = employeeId?.trim();
    if (!finalId) {
      const Company = require('../models/Company');
      const company = await Company.findById(companyId);
      finalId = await generateEmployeeId(companyId, company.name);
    } else {
      finalId = finalId.toUpperCase();
      if (await Employee.findOne({ employeeId: { $regex: new RegExp(`^${escapeRegex(finalId)}$`, 'i') } }))
        return res.status(409).json({ error: 'Employee ID already exists' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const emp = await Employee.create({
      companyId, username, employeeId: finalId, contact: contact || '',
      password: hashed, salary: parseFloat(salary) || 0,
      salaryType: 'monthly', designation: designation || ''
    });
    res.status(201).json({
      id: emp._id, username: emp.username, employeeId: emp.employeeId,
      contact: emp.contact, salary: emp.salary, salaryType: emp.salaryType, designation: emp.designation
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employees/bulk
router.post('/bulk', verifyAdmin, async (req, res) => {
  try {
    const { employees } = req.body;
    if (!Array.isArray(employees) || !employees.length)
      return res.status(400).json({ error: 'employees array required' });
    const companyId = req.admin.companyId;
    const Company   = require('../models/Company');
    const company   = await Company.findById(companyId);
    const results   = { created: [], failed: [] };
    for (const emp of employees) {
      try {
        const { username, contact, password, salary, designation } = emp;
        if (!username || !password) { results.failed.push({ username, reason: 'Missing required fields' }); continue; }
        const finalId = await generateEmployeeId(companyId, company.name);
        const hashed  = await bcrypt.hash(password, 10);
        const created = await Employee.create({
          companyId, username, employeeId: finalId, contact: contact || '',
          password: hashed, salary: parseFloat(salary) || 0,
          salaryType: 'monthly', designation: designation || ''
        });
        results.created.push({ id: created._id, username, employeeId: finalId });
      } catch (err) { results.failed.push({ username: emp.username, reason: err.message }); }
    }
    res.status(207).json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees/:id/export
router.get('/:id/export', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId }).select('-password');
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const Attendance = require('../models/Attendance');
    const records = await Attendance.find({ employeeId: req.params.id }).sort({ month: 1 });
    const exportData = {
      exportedAt: new Date().toISOString(),
      employee: emp.toObject(),
      attendanceRecords: records.map(r => {
        const obj = r.toObject();
        // Convert Map to plain object
        if (obj.days instanceof Map) obj.days = Object.fromEntries(obj.days);
        return obj;
      }),
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="employee_${emp.employeeId}_${emp.username}.json"`);
    res.json(exportData);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/employees/:id
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const { salary, contact, password, isActive, designation } = req.body;
    if (salary      !== undefined) emp.salary      = parseFloat(salary) || 0;
    emp.salaryType = 'monthly';
    if (contact     !== undefined) emp.contact     = contact;
    if (isActive    !== undefined) emp.isActive    = isActive;
    if (designation !== undefined) emp.designation = designation;
    if (password) emp.password = await bcrypt.hash(password, 10);
    await emp.save();
    res.json({ message: 'Employee updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/employees/:id  — archives
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    emp.archived = true; emp.archivedAt = new Date(); emp.isActive = false;
    await emp.save();
    res.json({ message: 'Employee archived' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employees/:id/restore
router.post('/:id/restore', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId, archived: true });
    if (!emp) return res.status(404).json({ error: 'Archived employee not found' });
    emp.archived = false; emp.archivedAt = undefined; emp.isActive = true;
    await emp.save();
    res.json({ message: 'Employee restored' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/employees/:id/permanent
router.delete('/:id/permanent', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOneAndDelete({ _id: req.params.id, companyId: req.admin.companyId, archived: true });
    if (!emp) return res.status(404).json({ error: 'Archived employee not found' });
    await require('../models/Attendance').deleteMany({ employeeId: req.params.id });
    res.json({ message: 'Employee permanently deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
