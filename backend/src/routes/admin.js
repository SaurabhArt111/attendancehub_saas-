const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Company = require('../models/Company');
const { verifyAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';

// Validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate contact
function isValidContact(contact) {
  return /^\d{10}$/.test(contact.replace(/\D/g, ''));
}

// POST /api/admin/setup — create primary admin (owner) after company login
router.post('/setup', async (req, res) => {
  try {
    const { companySetupToken, name, email, contact, password } = req.body;

    // Validation
    if (!companySetupToken || !name || !email || !contact || !password) {
      return res.status(400).json({
        error: 'Setup token, name, email, contact, and password are required',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!isValidContact(contact)) {
      return res.status(400).json({ error: 'Contact number must be 10 digits' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(companySetupToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired setup token' });
    }

    if (decoded.role !== 'company_setup') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    const companyId = decoded.companyId;

    // Only one owner per company
    const existing = await Admin.findOne({ companyId, isOwner: true });
    if (existing) {
      return res.status(409).json({ error: 'Primary admin already created for this company' });
    }

    // Check if email already exists for this company
    const existingEmail = await Admin.findOne({ companyId, email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered for this company' });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create admin
    const admin = await Admin.create({
      companyId,
      name: name.trim(),
      email: email.toLowerCase(),
      contact: contact.trim(),
      password: hashed,
      isOwner: true,
    });

    // Create auth token
    const token = jwt.sign(
      {
        id: admin._id,
        companyId,
        name: admin.name,
        email: admin.email,
        role: 'admin',
        isOwner: true,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        contact: admin.contact,
        isOwner: true,
      },
    });
  } catch (e) {
    console.error('Admin setup error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { companyCode, email, password } = req.body;

    if (!companyCode || !email || !password) {
      return res.status(400).json({ error: 'Company code, email, and password are required' });
    }

    const company = await Company.findOne({ companyCode: companyCode.toUpperCase() });
    if (!company) {
      return res.status(401).json({ error: 'Invalid company code' });
    }

    const admin = await Admin.findOne({
      companyId: company._id,
      email: email.toLowerCase(),
    });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        companyId: company._id,
        name: admin.name,
        email: admin.email,
        role: 'admin',
        isOwner: admin.isOwner,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        contact: admin.contact,
        isOwner: admin.isOwner,
      },
      company: { name: company.name, companyCode: company.companyCode },
    });
  } catch (e) {
    console.error('Admin login error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/me
router.get('/me', verifyAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    const company = await Company.findById(req.admin.companyId).select('-password');

    if (!admin || !company) {
      return res.status(404).json({ error: 'Admin or company not found' });
    }

    res.json({ admin, company });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/update — admin updates their profile
router.put('/update', verifyAdmin, async (req, res) => {
  try {
    const { name, email, contact, password, newPassword } = req.body;

    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // If changing email, validate and check uniqueness
    if (email && email !== admin.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const existing = await Admin.findOne({
        companyId: admin.companyId,
        email: email.toLowerCase(),
        _id: { $ne: admin._id },
      });

      if (existing) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      admin.email = email.toLowerCase();
    }

    // If changing contact, validate
    if (contact && !/^\d{10}$/.test(contact.replace(/\D/g, ''))) {
      return res.status(400).json({ error: 'Contact number must be 10 digits' });
    }

    // Update fields
    if (name) admin.name = name.trim();
    if (contact) admin.contact = contact.trim();

    // Handle password change
    if (newPassword) {
      if (!password) {
        return res.status(400).json({ error: 'Current password required to change password' });
      }

      if (!(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      admin.password = await bcrypt.hash(newPassword, 10);
    }

    await admin.save();

    res.json({
      message: 'Profile updated successfully',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        contact: admin.contact,
        isOwner: admin.isOwner,
      },
    });
  } catch (e) {
    console.error('Admin update error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
