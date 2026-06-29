const router = require('express').Router();
const Designation = require('../models/Designation');
const Employee = require('../models/Employee');
const { verifyAdmin } = require('../middleware/auth');

// GET /api/designations — list all designations
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const list = await Designation.find({ companyId: req.admin.companyId })
      .select('_id name createdAt')
      .sort({ name: 1 });

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/designations — create new designation
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Designation name is required' });
    }

    // Check for duplicate (case-insensitive)
    const existing = await Designation.findOne({
      companyId: req.admin.companyId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });

    if (existing) {
      return res.status(409).json({ error: 'Designation already exists' });
    }

    const designation = await Designation.create({
      companyId: req.admin.companyId,
      name: name.trim(),
    });

    res.status(201).json(designation);
  } catch (e) {
    console.error('Designation creation error:', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/designations/:id — update designation name
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Designation name is required' });
    }

    const designation = await Designation.findOne({
      _id: req.params.id,
      companyId: req.admin.companyId,
    });

    if (!designation) {
      return res.status(404).json({ error: 'Designation not found' });
    }

    // Check for duplicate with new name
    const existing = await Designation.findOne({
      companyId: req.admin.companyId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: designation._id },
    });

    if (existing) {
      return res.status(409).json({ error: 'A designation with this name already exists' });
    }

    const oldName = designation.name;
    designation.name = name.trim();
    await designation.save();

    // Update all employees with this designation
    await Employee.updateMany(
      { companyId: req.admin.companyId, designationId: designation._id },
      {} // MongoDB will trigger the post-save hook if needed
    );

    res.json({
      message: 'Designation updated successfully',
      designation,
    });
  } catch (e) {
    console.error('Designation update error:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/designations/:id — delete designation
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const designation = await Designation.findOne({
      _id: req.params.id,
      companyId: req.admin.companyId,
    });

    if (!designation) {
      return res.status(404).json({ error: 'Designation not found' });
    }

    // Check if any employee uses this designation
    const employeeCount = await Employee.countDocuments({
      companyId: req.admin.companyId,
      designationId: designation._id,
    });

    if (employeeCount > 0) {
      return res.status(409).json({
        error: `Cannot delete designation "${designation.name}" — it is assigned to ${employeeCount} employee${employeeCount > 1 ? 's' : ''}. Remove all assignments first.`,
      });
    }

    await Designation.findByIdAndDelete(req.params.id);

    res.json({ message: 'Designation deleted successfully' });
  } catch (e) {
    console.error('Designation delete error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
