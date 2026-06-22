const router  = require('express').Router();
const Holiday = require('../models/Holiday');
const { verifyAdmin, verifyEmployee } = require('../middleware/auth');

// GET /api/holidays — both admin and employee can view
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024');
    const companyId = decoded.companyId;
    const holidays = await Holiday.find({ companyId }).sort({ date: 1 });
    res.json(holidays);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/holidays — admin only
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { date, name } = req.body;
    if (!date || !name) return res.status(400).json({ error: 'Date and name required' });
    const holiday = await Holiday.create({ companyId: req.admin.companyId, date, name: name.trim() });
    res.status(201).json(holiday);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Holiday already exists for this date' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/holidays/:id — admin only
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await Holiday.findOneAndDelete({ _id: req.params.id, companyId: req.admin.companyId });
    res.json({ message: 'Holiday deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
