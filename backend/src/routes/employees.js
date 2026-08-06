const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const Employee = require('../models/Employee');
const Session  = require('../models/Session');
const { verifyAdmin, verifyEmployee, signToken, SLIDING_MS } = require('../middleware/auth');
const { compressToJpeg } = require('../utils/imageCompress');
const { getDeviceInfo } = require('../utils/deviceInfo');
const { countActiveSessions, pruneStaleSessions } = require('../utils/sessionCleanup');

// Employees get the same session tracking as Admins (added to bring this
// side up to par with the admin session-security work), but with a simpler
// flow: no push-based approval handshake, just a straightforward cap. Lower
// stakes than an admin account holding company-wide data, so a plain block
// at the limit — with a way to see/sign-out devices from Profile — is
// proportionate.
const MAX_EMPLOYEE_DEVICES = 3;
const DEVICE_LIMIT_MESSAGE = 'Maximum device limit reached. Please sign out from another device to continue.';
const PIN_LOCK_MS = 15 * 60 * 1000;
const PIN_MAX_ATTEMPTS = 5;

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

    // Stale sessions (device uninstalled / site data cleared) are pruned
    // before counting against the cap — see utils/sessionCleanup.js. A
    // session that's still genuinely in use is never evicted automatically;
    // the employee signs it out themselves (Profile → Signed-in Devices).
    const activeSessionCount = await countActiveSessions('employee', emp._id);
    if (activeSessionCount >= MAX_EMPLOYEE_DEVICES) {
      return res.status(403).json({ error: DEVICE_LIMIT_MESSAGE, deviceLimitReached: true });
    }

    const Company = require('../models/Company');
    const company = await Company.findById(emp.companyId);

    const deviceInfo = getDeviceInfo(req);
    const now = new Date();
    const session = await Session.create({
      role: 'employee', userId: emp._id, companyId: emp.companyId,
      userAgent: deviceInfo.userAgent, ip: deviceInfo.ip,
      deviceLabel: deviceInfo.deviceLabel, deviceType: deviceInfo.deviceType,
      createdAt: now, lastActiveAt: now,
      expiresAt: new Date(now.getTime() + SLIDING_MS)
    });

    const token = signToken(
      { id: emp._id, companyId: emp.companyId, username: emp.username, role: 'employee', sid: session._id }
    );
    res.json({
      token,
      employee: { id: emp._id, username: emp.username, employeeId: emp.employeeId, contact: emp.contact, designation: emp.designation },
      company: { name: company?.name, companyCode: company?.companyCode }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employees/logout — explicitly revokes *this* device's session.
// Without this, signing out only cleared the token locally and the session
// kept counting toward the device limit until it expired or went stale.
router.post('/logout', verifyEmployee, async (req, res) => {
  try {
    if (req.employee.sid) {
      await Session.updateOne(
        { _id: req.employee.sid, role: 'employee', userId: req.employee.id, revoked: false },
        { $set: { revoked: true, revokedAt: new Date(), revokedReason: 'user' } }
      );
    }
    res.json({ message: 'Signed out' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/employees/sessions — this employee's signed-in devices
router.get('/sessions', verifyEmployee, async (req, res) => {
  try {
    await pruneStaleSessions('employee', req.employee.id);
    const sessions = await Session.find({
      role: 'employee', userId: req.employee.id, revoked: false, expiresAt: { $gt: new Date() }
    }).sort({ lastActiveAt: -1 }).lean();
    res.json({
      currentSessionId: req.employee.sid || null,
      maxDevices: MAX_EMPLOYEE_DEVICES,
      sessions: sessions.map(s => ({
        id: s._id, deviceLabel: s.deviceLabel, deviceType: s.deviceType,
        createdAt: s.createdAt, lastActiveAt: s.lastActiveAt,
        isCurrent: req.employee.sid && String(s._id) === String(req.employee.sid)
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employees/sessions/:id/revoke — sign out one other device
router.post('/sessions/:id/revoke', verifyEmployee, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, role: 'employee', userId: req.employee.id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    session.revoked = true;
    session.revokedAt = new Date();
    session.revokedReason = 'user';
    await session.save();
    res.json({ message: 'Device signed out', wasCurrent: req.employee.sid === session._id.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employees/sessions/logout-others — sign out every device but this one
router.post('/sessions/logout-others', verifyEmployee, async (req, res) => {
  try {
    await Session.updateMany(
      { role: 'employee', userId: req.employee.id, revoked: false, _id: { $ne: req.employee.sid } },
      { $set: { revoked: true, revokedAt: new Date(), revokedReason: 'logout-others' } }
    );
    res.json({ message: 'Other devices signed out' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Payroll PIN ────────────────────────────────────────────────────────
// Gates the Payroll page. First visit → employee creates a 4-digit PIN.
// Every visit after that → they must re-enter it. Locks out for 15 minutes
// after 5 wrong attempts (a 4-digit space is small; this matters).

// GET /api/employees/payroll-pin/status
router.get('/payroll-pin/status', verifyEmployee, async (req, res) => {
  try {
    const emp = await Employee.findById(req.employee.id).select('payrollPin');
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json({ hasPin: !!emp.payrollPin });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employees/payroll-pin/setup  { pin, confirmPin }
router.post('/payroll-pin/setup', verifyEmployee, async (req, res) => {
  try {
    const { pin, confirmPin } = req.body;
    if (!/^\d{4}$/.test(pin || '')) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    if (pin !== confirmPin) return res.status(400).json({ error: 'PINs do not match' });

    const emp = await Employee.findById(req.employee.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (emp.payrollPin) return res.status(409).json({ error: 'A PIN is already set. Ask your admin to reset it if you\'ve forgotten it.' });

    emp.payrollPin = await bcrypt.hash(pin, 10);
    emp.payrollPinSetAt = new Date();
    emp.payrollPinFailedAttempts = 0;
    emp.payrollPinLockedUntil = undefined;
    await emp.save();
    res.json({ message: 'PIN created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/employees/payroll-pin/verify  { pin }
router.post('/payroll-pin/verify', verifyEmployee, async (req, res) => {
  try {
    const { pin } = req.body;
    const emp = await Employee.findById(req.employee.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (!emp.payrollPin) return res.status(400).json({ error: 'No PIN set up yet' });

    if (emp.payrollPinLockedUntil && emp.payrollPinLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((emp.payrollPinLockedUntil - new Date()) / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` });
    }

    const match = await bcrypt.compare(pin || '', emp.payrollPin);
    if (!match) {
      emp.payrollPinFailedAttempts = (emp.payrollPinFailedAttempts || 0) + 1;
      if (emp.payrollPinFailedAttempts >= PIN_MAX_ATTEMPTS) {
        emp.payrollPinLockedUntil = new Date(Date.now() + PIN_LOCK_MS);
        emp.payrollPinFailedAttempts = 0;
        await emp.save();
        return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
      }
      await emp.save();
      const remaining = PIN_MAX_ATTEMPTS - emp.payrollPinFailedAttempts;
      return res.status(401).json({ error: 'Incorrect PIN', attemptsRemaining: remaining });
    }

    emp.payrollPinFailedAttempts = 0;
    emp.payrollPinLockedUntil = undefined;
    await emp.save();
    res.json({ verified: true });
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
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId }).select('-idProofData -payrollPin').lean();
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json({
      ...emp,
      hasPassword: !!emp.password,
      hasIdProof: !!emp.idProofContentType,
      hasPayrollPin: !!emp.payrollPinSetAt
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

// POST /api/employees/:id/payroll-pin/reset — admin clears an employee's
// forgotten Payroll PIN so they can set a fresh one on their next visit.
router.post('/:id/payroll-pin/reset', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    emp.payrollPin = '';
    emp.payrollPinSetAt = undefined;
    emp.payrollPinFailedAttempts = 0;
    emp.payrollPinLockedUntil = undefined;
    await emp.save();
    res.json({ message: 'Payroll PIN reset. The employee will be asked to create a new one.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/employees/:id/weekend  { override: [7 booleans, Sun..Sat] | null }
// null clears the override so the employee falls back to the company's
// global Weekend Management schedule.
router.put('/:id/weekend', verifyAdmin, async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const { override } = req.body;
    if (override === null) {
      emp.weekendOverride = null;
    } else {
      if (!Array.isArray(override) || override.length !== 7 || !override.every(v => typeof v === 'boolean'))
        return res.status(400).json({ error: 'override must be an array of 7 booleans (Sun..Sat) or null' });
      emp.weekendOverride = override;
    }
    await emp.save();
    res.json({ message: 'Weekend schedule updated', weekendOverride: emp.weekendOverride });
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
