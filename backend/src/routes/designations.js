const router      = require('express').Router();
const Designation = require('../models/Designation');
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

// DELETE /api/designations/:id
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await Designation.findOneAndDelete({ _id: req.params.id, companyId: req.admin.companyId });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
