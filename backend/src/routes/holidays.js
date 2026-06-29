const router = require('express').Router();
const Holiday = require('../models/Holiday');
const { verifyAdmin } = require('../middleware/auth');

// GET /api/holidays — list all holidays
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const holidays = await Holiday.find({ companyId: req.admin.companyId })
      .select('_id name date description createdAt')
      .sort({ date: 1 });

    res.json(holidays);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/holidays/:year/:month — holidays for a specific month
router.get('/:year/:month', verifyAdmin, async (req, res) => {
  try {
    const { year, month } = req.params;
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;

    const days = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${days}`;

    const holidays = await Holiday.find({
      companyId: req.admin.companyId,
      date: { $gte: startDate, $lte: endDate },
    });

    res.json(holidays);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/holidays — create holiday
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { name, date, description } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'Holiday name and date are required' });
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
    }

    // Check if already exists
    const existing = await Holiday.findOne({
      companyId: req.admin.companyId,
      date,
    });

    if (existing) {
      return res.status(409).json({ error: 'Holiday already exists for this date' });
    }

    const holiday = await Holiday.create({
      companyId: req.admin.companyId,
      name: name.trim(),
      date,
      description: description || '',
    });

    res.status(201).json(holiday);
  } catch (e) {
    console.error('Holiday creation error:', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/holidays/:id — update holiday
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { name, date, description } = req.body;

    const holiday = await Holiday.findOne({
      _id: req.params.id,
      companyId: req.admin.companyId,
    });

    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    if (date && date !== holiday.date) {
      // Check if new date already exists
      const existing = await Holiday.findOne({
        companyId: req.admin.companyId,
        date,
        _id: { $ne: holiday._id },
      });

      if (existing) {
        return res.status(409).json({ error: 'Holiday already exists for this date' });
      }
    }

    if (name) holiday.name = name.trim();
    if (date) holiday.date = date;
    if (description !== undefined) holiday.description = description;

    await holiday.save();

    res.json({ message: 'Holiday updated', holiday });
  } catch (e) {
    console.error('Holiday update error:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/holidays/:id — delete holiday
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const holiday = await Holiday.findOneAndDelete({
      _id: req.params.id,
      companyId: req.admin.companyId,
    });

    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    res.json({ message: 'Holiday deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
