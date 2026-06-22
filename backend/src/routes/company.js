const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const Company = require('../models/Company');
const Admin   = require('../models/Admin');
const { verifyAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';

// Generate unique company code
function genCode(name) {
  const prefix = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4).padEnd(4, 'X');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${suffix}`;
}

// POST /api/company/register — register new company
router.post('/register', async (req, res) => {
  try {
    const { name, contact, password } = req.body;
    if (!name || !contact || !password)
      return res.status(400).json({ error: 'Company name, contact, and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Generate unique company code
    let companyCode, exists = true;
    while (exists) {
      companyCode = genCode(name);
      exists = await Company.findOne({ companyCode });
    }

    const hashed = await bcrypt.hash(password, 10);
    const company = await Company.create({ name: name.trim(), companyCode, contact, password: hashed });

    res.status(201).json({
      message: 'Company registered successfully',
      companyCode: company.companyCode,
      companyId:   company._id,
      name:        company.name
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/company/login — company logs in (to create admin account in setup flow)
router.post('/login', async (req, res) => {
  try {
    const { companyCode, password } = req.body;
    if (!companyCode || !password)
      return res.status(400).json({ error: 'Company code and password are required' });

    const company = await Company.findOne({ companyCode: companyCode.toUpperCase() });
    if (!company || !await bcrypt.compare(password, company.password))
      return res.status(401).json({ error: 'Invalid company code or password' });

    // Issue a short-lived company setup token
    const token = jwt.sign(
      { companyId: company._id, role: 'company_setup' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Check if primary admin already created
    const adminExists = await Admin.findOne({ companyId: company._id, isOwner: true });

    res.json({
      token,
      companyId:   company._id,
      companyCode: company.companyCode,
      name:        company.name,
      adminSetupDone: !!adminExists
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/company/info — admin gets their company info
router.get('/info', verifyAdmin, async (req, res) => {
  try {
    const company = await Company.findById(req.admin.companyId).select('-password');
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
