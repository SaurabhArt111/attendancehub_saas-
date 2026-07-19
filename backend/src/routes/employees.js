const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const Employee = require('../models/Employee');
const { verifyAdmin, verifyEmployee, signToken } = require('../middleware/auth');
const { compressToJpeg } = require('../utils/imageCompress');

// Employee ID format: 4 alphabetic characters + 3-5 alphanumeric characters
// (total length 7-9), auto-generated and guaranteed unique.
const ID_ALPHABET  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // alphanumeric, no ambiguous chars
const ID_SUFFIX_LENGTHS = [3, 4, 5];

// Multer: memory storage only — files never touch disk. 8MB cap on the
// original upload; the compression step brings it down to ~100-200KB before
// anything is saved to MongoDB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function randomChunk(length) {
  let out = '';
  for (let i = 0; i < length; i++) out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  return out;
}

// Always produces exactly 4 uppercase alphabetic characters derived from the
// company name (padded with 'X' if the name doesn't yield enough letters).
function employeePrefix(companyName) {
  const words = String(companyName || '').trim().split(/\s+/).filter(Boolean);
  let letters = '';
  if (words.length >= 4) {
    letters = words.slice(0, 4).map(w => (w.replace(/[^a-zA-Z]/g, '')[0] || '')).join('');
  } else if (words.length > 1) {
    letters = words.map(w => (w.replace(/[^a-zA-Z]/g, '')[0] || '')).join('');
    if (letters.length < 4) letters += words[0].replace(/[^a-zA-Z]/g, '').slice(1);
  } else {
    letters = (words[0] || '').replace(/[^a-zA-Z]/g, '');
  }
  letters = letters.toUpperCase().slice(0, 4);
  while (letters.length < 4) letters += 'X';
  return letters;
}

// 4 alpha + (3-5 alphanumeric) => total length 7-9, checked for global uniqueness.
async function generateEmployeeId(companyId, companyName) {
  const prefix = employeePrefix(companyName);
  let id, exists = true;
  while (exists) {
    const suffixLen = ID_SUFFIX_LENGTHS[Math.floor(Math.random() * ID_SUFFIX_LENGTHS.length)];
    id = `${prefix}${randomChunk(suffixLen)}`;
    exists = await Employee.findOne({ employeeId: id });
  }
  return id;
}

// POST /api/employees/login
router.post('/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) return res.status(400).json({ error: 'Employee ID and password required' });
    const emp = await Employee.findOne({ employeeId: { $regex: new RegExp(`^${escapeRegex(employeeId.trim())}$`, 'i') } });
    if (!emp) return res.status(401).json({ error: 'Invalid Employee ID or password' });
    if (!emp.password) return res.status(403).json({ error: 'No password has been set for this account yet. Please contact your admin.' });
    if (!await bcrypt.compare(password, emp.password))
      return res.status(401).json({ error: 'Invalid Employee ID or password' });
    if (!emp.isActive) return res.status(403).json({ error: 'Account deactivated' });
    const Company = require('../models/Company');
    const company = await Company.findById(emp.companyId);
    const token = signToken(
      { id: emp._id, companyId: emp.companyId, username: emp.username, role: 'employee' }
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
    const emp = await Employee.findById(req.employee.id).select('-password -idProofData');
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees/archived  — before /:id routes
router.get('/archived', verifyAdmin, async (req, res) => {
  try {
    const employees = await Employee.find({ companyId: req.admin.companyId, archived: true })
      .select('-idProofData').sort({ archivedAt: -1 }).lean();
    res.json(employees.map(({ password, ...rest }) => ({
      ...rest, hasPassword: !!password, hasIdProof: !!rest.idProofContentType
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees  (active only)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const employees = await Employee.find({ companyId: req.admin.companyId, archived: { $ne: true } })
      .select('-idProofData').sort({ createdAt: 1 }).lean();
    res.json(employees.map(({ password, ...rest }) => ({
      ...rest, hasPassword: !!password, hasIdProof: !!rest.idProofContentType
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employees
// Only Employee Name (username) and Mobile Number (contact) are mandatory.
// Password, email, designation, and salary can all be added/updated later.
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { username, employeeId, contact, password, email, salary, designation } = req.body;
    if (!username || !username.trim()) return res.status(400).json({ error: 'Employee name is required' });
    if (!contact || !contact.trim())   return res.status(400).json({ error: 'Mobile number is required' });

    const companyId = req.admin.companyId;
    if (await Employee.findOne({ companyId, username: { $regex: new RegExp(`^${escapeRegex(username.trim())}$`, 'i') }, archived: { $ne: true } }))
      return res.status(409).json({ error: 'An employee with this name already exists' });

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

    const emp = await Employee.create({
      companyId, username: username.trim(), employeeId: finalId, contact: contact.trim(),
      password: password ? await bcrypt.hash(password, 10) : '',
      email: email ? email.trim().toLowerCase() : '',
      salary: parseFloat(salary) || 0,
      salaryType: 'monthly', designation: designation || ''
    });
    res.status(201).json({
      id: emp._id, username: emp.username, employeeId: emp.employeeId,
      contact: emp.contact, email: emp.email, salary: emp.salary, salaryType: emp.salaryType,
      designation: emp.designation, hasPassword: !!emp.password
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
        const { username, contact, password, salary, designation, email } = emp;
        if (!username || !contact) { results.failed.push({ username, reason: 'Name and mobile number are required' }); continue; }
        const finalId = await generateEmployeeId(companyId, company.name);
        const created = await Employee.create({
          companyId, username, employeeId: finalId, contact,
          password: password ? await bcrypt.hash(password, 10) : '',
          email: email ? email.trim().toLowerCase() : '',
          salary: parseFloat(salary) || 0,
          salaryType: 'monthly', designation: designation || ''
        });
        results.created.push({ id: created._id, username, employeeId: finalId });
      } catch (err) { results.failed.push({ username: emp.username, reason: err.message }); }
    }
    res.status(207).json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees/:id
router.get('/:id', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId }).select('-idProofData').lean();
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json({
      ...emp,
      hasPassword: !!emp.password,
      hasIdProof: !!emp.idProofContentType
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees/:id/export
router.get('/:id/export', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId }).select('-password -idProofData');
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

// ── Identification Proof image ──────────────────────────────────────
// Uploaded file is compressed (JPEG, ~100-200KB) in-memory via Sharp and the
// COMPRESSED buffer only is written straight to MongoDB — the original bytes
// from the upload are never persisted anywhere (not to disk, not to Mongo).

// POST /api/employees/:id/id-proof
router.post('/:id/id-proof', verifyAdmin, (req, res) => {
  upload.single('idProof')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      if (!req.file) return res.status(400).json({ error: 'No image file provided' });
      const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId });
      if (!emp) return res.status(404).json({ error: 'Employee not found' });

      const { buffer, size } = await compressToJpeg(req.file.buffer);

      emp.idProofData = buffer;
      emp.idProofContentType = 'image/jpeg';
      emp.idProofSize = size;
      emp.idProofUploadedAt = new Date();
      await emp.save();

      res.status(201).json({ message: 'Identification proof uploaded', size, sizeKB: Math.round(size / 1024) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// GET /api/employees/:id/id-proof — admin (any employee in their company) or the employee themself
router.get('/:id/id-proof', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'No token provided' });
    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Invalid or expired token' }); }

    const filter = decoded.role === 'admin'
      ? { _id: req.params.id, companyId: decoded.companyId }
      : decoded.role === 'employee' && decoded.id === req.params.id
        ? { _id: req.params.id }
        : null;
    if (!filter) return res.status(403).json({ error: 'Unauthorized' });

    const emp = await Employee.findOne(filter).select('idProofData idProofContentType');
    if (!emp || !emp.idProofData) return res.status(404).json({ error: 'No identification proof on file' });

    res.setHeader('Content-Type', emp.idProofContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(emp.idProofData);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/employees/:id/id-proof
router.delete('/:id/id-proof', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    emp.idProofData = undefined;
    emp.idProofContentType = '';
    emp.idProofSize = undefined;
    emp.idProofUploadedAt = undefined;
    await emp.save();
    res.json({ message: 'Identification proof removed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/employees/:id
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const { salary, contact, password, isActive, designation, email, username, employeeId, salaryType } = req.body;
    if (username !== undefined && username.trim() && username.trim() !== emp.username) {
      const dupe = await Employee.findOne({
        companyId: req.admin.companyId,
        username: { $regex: new RegExp(`^${escapeRegex(username.trim())}$`, 'i') },
        archived: { $ne: true }, _id: { $ne: emp._id }
      });
      if (dupe) return res.status(409).json({ error: 'An employee with this name already exists' });
      emp.username = username.trim();
    }
    if (employeeId !== undefined && employeeId?.trim()) {
      const normalizedId = employeeId.trim().toUpperCase();
      const dupe = await Employee.findOne({
        employeeId: { $regex: new RegExp(`^${escapeRegex(normalizedId)}$`, 'i') },
        _id: { $ne: emp._id }
      });
      if (dupe) return res.status(409).json({ error: 'Employee ID already exists' });
      emp.employeeId = normalizedId;
    }
    if (salary      !== undefined) emp.salary      = parseFloat(salary) || 0;
    if (salaryType  !== undefined) emp.salaryType  = salaryType === 'daily' ? 'daily' : 'monthly';
    if (contact     !== undefined) emp.contact     = contact;
    if (isActive    !== undefined) emp.isActive    = isActive;
    if (designation !== undefined) emp.designation = designation;
    if (email       !== undefined) emp.email       = email.trim().toLowerCase();
    if (password) emp.password = await bcrypt.hash(password, 10);
    await emp.save();
    res.json({ message: 'Employee updated', hasPassword: !!emp.password });
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
