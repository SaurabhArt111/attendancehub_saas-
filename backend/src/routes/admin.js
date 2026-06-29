const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const Admin   = require('../models/Admin');
const Company = require('../models/Company');
const { verifyAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';

// POST /api/admin/setup — create primary admin (owner) after company login
router.post('/setup', async (req, res) => {
  try {
    const { companySetupToken, username, adminId, contact, password } = req.body;
    if (!companySetupToken || !username || !adminId || !password)
      return res.status(400).json({ error: 'Setup token, username, admin ID, and password required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    let decoded;
    try {
      decoded = jwt.verify(companySetupToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired setup token' });
    }
    if (decoded.role !== 'company_setup')
      return res.status(403).json({ error: 'Invalid token type' });

    const companyId = decoded.companyId;

    // Only one owner per company
    const existing = await Admin.findOne({ companyId, isOwner: true });
    if (existing) return res.status(409).json({ error: 'Primary admin already created for this company' });

    if (await Admin.findOne({ companyId, username }))
      return res.status(409).json({ error: 'Username already exists' });
    if (await Admin.findOne({ companyId, adminId }))
      return res.status(409).json({ error: 'Admin ID already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const admin  = await Admin.create({ companyId, username, adminId, contact: contact || '', password: hashed, isOwner: true });

    const token = jwt.sign(
      { id: admin._id, companyId, username: admin.username, role: 'admin', isOwner: true },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, admin: { id: admin._id, username: admin.username, adminId: admin.adminId, isOwner: true } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { companyCode, username, password } = req.body;
    if (!companyCode || !username || !password)
      return res.status(400).json({ error: 'Company code, username, and password required' });

    const company = await Company.findOne({ companyCode: companyCode.toUpperCase() });
    if (!company) return res.status(401).json({ error: 'Invalid company code' });

    const admin = await Admin.findOne({
      companyId: company._id,
      $or: [
        { username: { $regex: new RegExp(`^${username}$`, 'i') } },
        { adminId:  { $regex: new RegExp(`^${username}$`, 'i') } }
      ]
    });

    if (!admin || !await bcrypt.compare(password, admin.password))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin._id, companyId: company._id, username: admin.username, role: 'admin', isOwner: admin.isOwner },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: { id: admin._id, username: admin.username, adminId: admin.adminId, isOwner: admin.isOwner },
      company: { name: company.name, companyCode: company.companyCode }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/me
router.get('/me', verifyAdmin, async (req, res) => {
  try {
    const admin   = await Admin.findById(req.admin.id).select('-password');
    const company = await Company.findById(req.admin.companyId).select('-password');
    res.json({ admin, company });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
