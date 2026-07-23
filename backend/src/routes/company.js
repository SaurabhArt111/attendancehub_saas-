const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const Company = require('../models/Company');
const Admin   = require('../models/Admin');
const { verifyAdmin } = require('../middleware/auth');

const JWT_SECRET    = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChunk(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function genCode(name) {
  const prefix = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  return `${prefix}${randomChunk(5)}`;
}

// POST /api/company/register
router.post('/register', async (req, res) => {
  try {
    const { name, contact, email, password } = req.body;
    if (!name || !contact || !email || !password)
      return res.status(400).json({ error: 'Company name, contact, email, and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    let companyCode, exists = true;
    while (exists) {
      companyCode = genCode(name);
      exists = await Company.findOne({ companyCode });
    }

    const hashed = await bcrypt.hash(password, 10);
    const company = await Company.create({
      name: name.trim(), companyCode, contact, email: email.trim().toLowerCase(), password: hashed
    });

    res.status(201).json({
      message: 'Company registered successfully',
      companyCode: company.companyCode,
      companyId: company._id,
      name: company.name
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/company/login
router.post('/login', async (req, res) => {
  try {
    const { companyCode, password } = req.body;
    if (!companyCode || !password)
      return res.status(400).json({ error: 'Company code and password are required' });

    const company = await Company.findOne({ companyCode: companyCode.toUpperCase() });
    if (!company || !await bcrypt.compare(password, company.password))
      return res.status(401).json({ error: 'Invalid company code or password' });

    const token = jwt.sign(
      { companyId: company._id, role: 'company_setup' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const adminExists = await Admin.findOne({ companyId: company._id, isOwner: true });

    res.json({
      token,
      companyId: company._id,
      companyCode: company.companyCode,
      name: company.name,
      adminSetupDone: !!adminExists
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/company/info
router.get('/info', verifyAdmin, async (req, res) => {
  try {
    const company = await Company.findById(req.admin.companyId).select('-password');
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/company/update — update company profile
router.put('/update', verifyAdmin, async (req, res) => {
  try {
    const company = await Company.findById(req.admin.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const { name, contact, email, currentPassword, newPassword } = req.body;

    if (name)    company.name    = name.trim();
    if (contact) company.contact = contact;
    if (email)   company.email   = email.trim().toLowerCase();

    if (newPassword) {
      if (!currentPassword)
        return res.status(400).json({ error: 'Current password required to change password' });
      const valid = await bcrypt.compare(currentPassword, company.password);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      if (newPassword.length < 6)
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      company.password = await bcrypt.hash(newPassword, 10);
    }

    await company.save();
    res.json({ message: 'Company updated', company: { name: company.name, contact: company.contact, email: company.email, companyCode: company.companyCode } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
