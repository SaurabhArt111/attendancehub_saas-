const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const Admin = require('../models/Admin');
const { verifyAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChunk(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// Generate unique company code from company name
function genCode(name) {
  const prefix = name
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');
  return `${prefix}${randomChunk(5)}`;
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate contact number (basic validation for Indian format)
function isValidContact(contact) {
  return /^\d{10}$/.test(contact.replace(/\D/g, ''));
}

// POST /api/company/register — register new company
router.post('/register', async (req, res) => {
  try {
    const { name, companyCode, email, contact, password } = req.body;

    // Validation
    if (!name || !email || !contact || !password) {
      return res.status(400).json({
        error: 'Company Name, Email, Contact Number, and Password are required',
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

    // Check if email already exists
    const existingCompany = await Company.findOne({ email: email.toLowerCase() });
    if (existingCompany) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Use provided company code or generate one
    let finalCode = companyCode ? companyCode.toUpperCase() : null;

    if (finalCode) {
      // Validate provided code format
      if (!/^[A-Z0-9]{3,}$/.test(finalCode)) {
        return res.status(400).json({ error: 'Company code must be alphanumeric (min 3 chars)' });
      }

      // Check if provided code exists
      const existingCode = await Company.findOne({ companyCode: finalCode });
      if (existingCode) {
        return res.status(409).json({ error: 'Company code already exists' });
      }
    } else {
      // Generate unique code
      let exists = true;
      while (exists) {
        finalCode = genCode(name);
        exists = await Company.findOne({ companyCode: finalCode });
      }
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create company
    const company = await Company.create({
      name: name.trim(),
      companyCode: finalCode,
      email: email.toLowerCase(),
      contact: contact.trim(),
      password: hashed,
    });

    res.status(201).json({
      message: 'Company registered successfully',
      companyCode: company.companyCode,
      companyId: company._id,
      name: company.name,
      email: company.email,
    });
  } catch (e) {
    console.error('Company registration error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/company/login — company logs in (for admin setup flow)
router.post('/login', async (req, res) => {
  try {
    const { companyCode, password } = req.body;

    if (!companyCode || !password) {
      return res.status(400).json({ error: 'Company code and password are required' });
    }

    const company = await Company.findOne({ companyCode: companyCode.toUpperCase() });
    if (!company || !(await bcrypt.compare(password, company.password))) {
      return res.status(401).json({ error: 'Invalid company code or password' });
    }

    // Issue a short-lived company setup token
    const token = jwt.sign({ companyId: company._id, role: 'company_setup' }, JWT_SECRET, {
      expiresIn: '1h',
    });

    // Check if primary admin already created
    const adminExists = await Admin.findOne({ companyId: company._id, isOwner: true });

    res.json({
      token,
      companyId: company._id,
      companyCode: company.companyCode,
      name: company.name,
      email: company.email,
      adminSetupDone: !!adminExists,
    });
  } catch (e) {
    console.error('Company login error:', e);
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

// PUT /api/company/update — admin updates company info
router.put('/update', verifyAdmin, async (req, res) => {
  try {
    const { name, email, contact } = req.body;

    const company = await Company.findById(req.admin.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    // Validate email if changed
    if (email && email !== company.email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      const existingEmail = await Company.findOne({ email: email.toLowerCase(), _id: { $ne: company._id } });
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    // Validate contact if changed
    if (contact && !isValidContact(contact)) {
      return res.status(400).json({ error: 'Contact number must be 10 digits' });
    }

    // Update fields
    if (name) company.name = name.trim();
    if (email) company.email = email.toLowerCase();
    if (contact) company.contact = contact.trim();

    await company.save();

    res.json({
      message: 'Company updated successfully',
      company: company.toObject({ getters: true }),
    });
  } catch (e) {
    console.error('Company update error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
