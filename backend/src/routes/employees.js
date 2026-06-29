const router = require('express').Router();
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { verifyAdmin, verifyEmployee } = require('../middleware/auth');

// Validate email
function isValidEmail(email) {
  if (!email) return true; // Optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate contact
function isValidContact(contact) {
  if (!contact) return true; // Optional field
  return /^\d{10}$/.test(contact.replace(/\D/g, ''));
}

// GET /api/employees — list active employees
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const employees = await Employee.find({
      companyId: req.admin.companyId,
      isActive: true,
    })
      .populate('designationId', 'name')
      .select('-password')
      .sort({ username: 1 });

    res.json(employees);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/employees/archived — list archived employees
router.get('/archived', verifyAdmin, async (req, res) => {
  try {
    const employees = await Employee.find({
      companyId: req.admin.companyId,
      isActive: false,
    })
      .populate('designationId', 'name')
      .select('-password')
      .sort({ username: 1 });

    res.json(employees);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate unique employee ID
async function generateEmployeeId(companyId) {
  const count = await Employee.countDocuments({ companyId });
  const num = count + 1;
  return `EMP${String(num).padStart(5, '0')}`;
}

// POST /api/employees — create new employee
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { username, email, contact, designationId, salaryType, salary, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (contact && !isValidContact(contact)) {
      return res.status(400).json({ error: 'Contact must be 10 digits' });
    }

    // Generate unique employee ID
    const employeeId = await generateEmployeeId(req.admin.companyId);

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const employee = await Employee.create({
      companyId: req.admin.companyId,
      username: username.trim(),
      employeeId,
      email: email ? email.toLowerCase() : '',
      contact: contact ? contact.trim() : '',
      designationId: designationId || null,
      salaryType: salaryType || 'monthly',
      salary: salary || 0,
      password: hashed,
    });

    res.status(201).json({
      message: 'Employee created',
      employee: {
        id: employee._id,
        username: employee.username,
        employeeId: employee.employeeId,
        email: employee.email,
        contact: employee.contact,
      },
    });
  } catch (e) {
    console.error('Employee creation error:', e);
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Employee ID already exists' });
    }
    res.status(500).json({ error: e.message });
  }
});

// POST /api/employees/bulk — bulk add employees
router.post('/bulk', verifyAdmin, async (req, res) => {
  try {
    const { employees: employeeList } = req.body;

    if (!Array.isArray(employeeList) || !employeeList.length) {
      return res.status(400).json({ error: 'No employees provided' });
    }

    const created = [];
    const failed = [];

    for (const emp of employeeList) {
      try {
        if (!emp.username || !emp.password) {
          failed.push({ username: emp.username || '(unnamed)', reason: 'Name and password required' });
          continue;
        }

        if (emp.password.length < 6) {
          failed.push({ username: emp.username, reason: 'Password min 6 chars' });
          continue;
        }

        if (emp.email && !isValidEmail(emp.email)) {
          failed.push({ username: emp.username, reason: 'Invalid email' });
          continue;
        }

        if (emp.contact && !isValidContact(emp.contact)) {
          failed.push({ username: emp.username, reason: 'Contact must be 10 digits' });
          continue;
        }

        const employeeId = await generateEmployeeId(req.admin.companyId);
        const hashed = await bcrypt.hash(emp.password, 10);

        const newEmp = await Employee.create({
          companyId: req.admin.companyId,
          username: emp.username.trim(),
          employeeId,
          email: emp.email ? emp.email.toLowerCase() : '',
          contact: emp.contact ? emp.contact.trim() : '',
          designationId: emp.designationId || null,
          salaryType: emp.salaryType || 'monthly',
          salary: emp.salary || 0,
          password: hashed,
        });

        created.push({
          username: newEmp.username,
          employeeId: newEmp.employeeId,
          email: newEmp.email,
        });
      } catch (err) {
        failed.push({
          username: emp.username,
          reason: err.message,
        });
      }
    }

    res.status(201).json({ created, failed });
  } catch (e) {
    console.error('Bulk add error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/employees/:id — get employee details
router.get('/:id', verifyAdmin, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      companyId: req.admin.companyId,
    })
      .populate('designationId', 'name')
      .select('-password');

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(employee);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/employees/:id — update employee
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { email, contact, designationId, salaryType, salary, password } = req.body;

    const employee = await Employee.findOne({
      _id: req.params.id,
      companyId: req.admin.companyId,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (contact && !isValidContact(contact)) {
      return res.status(400).json({ error: 'Contact must be 10 digits' });
    }

    if (email) employee.email = email.toLowerCase();
    if (contact) employee.contact = contact.trim();
    if (designationId !== undefined) employee.designationId = designationId || null;
    if (salaryType) employee.salaryType = salaryType;
    if (salary !== undefined) employee.salary = salary;

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      employee.password = await bcrypt.hash(password, 10);
    }

    await employee.save();

    res.json({ message: 'Employee updated', employee });
  } catch (e) {
    console.error('Employee update error:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/employees/:id — archive employee
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      companyId: req.admin.companyId,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    employee.isActive = false;
    await employee.save();

    res.json({ message: 'Employee archived' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/employees/:id/restore — restore archived employee
router.post('/:id/restore', verifyAdmin, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      companyId: req.admin.companyId,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    employee.isActive = true;
    await employee.save();

    res.json({ message: 'Employee restored' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/employees/:id/permanent — permanently delete employee and their records
router.delete('/:id/permanent', verifyAdmin, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      companyId: req.admin.companyId,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Delete all attendance records
    await Attendance.deleteMany({ employeeId: employee._id });

    // Delete employee
    await Employee.findByIdAndDelete(employee._id);

    res.json({ message: 'Employee permanently deleted' });
  } catch (e) {
    console.error('Permanent delete error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
