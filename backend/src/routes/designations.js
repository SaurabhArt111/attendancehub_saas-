const router      = require('express').Router();
const Designation = require('../models/Designation');
const Employee    = require('../models/Employee');
const { verifyAdmin } = require('../middleware/auth');

// GET /api/designations
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const list = await Designation.find({ companyId: req.admin.companyId }).sort({ name: 1 });
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/designations
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const d = await Designation.create({ companyId: req.admin.companyId, name: name.trim() });
    res.status(201).json(d);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Designation already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/designations/:id  — rename designation and cascade to employees
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const desig = await Designation.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!desig) return res.status(404).json({ error: 'Designation not found' });

    const oldName = desig.name;
    desig.name = name.trim();
    await desig.save();

    // Cascade rename to all employees using the old name
    await Employee.updateMany(
      { companyId: req.admin.companyId, designation: oldName },
      { $set: { designation: desig.name } }
    );

    res.json({ message: 'Designation renamed', designation: desig });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Designation name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/designations/:id
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const desig = await Designation.findOne({ _id: req.params.id, companyId: req.admin.companyId });
    if (!desig) return res.status(404).json({ error: 'Designation not found' });

    // Check if any active employee uses this designation
    const inUse = await Employee.countDocuments({
      companyId: req.admin.companyId,
      designation: desig.name,
      archived: { $ne: true }
    });
    if (inUse > 0)
      return res.status(409).json({
        error: `Cannot delete "${desig.name}" — ${inUse} employee${inUse > 1 ? 's are' : ' is'} assigned to it. Reassign them first.`
      });

    await desig.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
