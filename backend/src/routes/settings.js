const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const Company = require('../models/Company');
const Employee = require('../models/Employee');
const { verifyAdmin, JWT_SECRET } = require('../middleware/auth');
const { DEFAULT_SCHEDULE, isLegacyInvertedSundayOnly } = require('../utils/weekend');

// Shared by every route below: both Admins and Employees need to read the
// attendance settings (the Employee app needs to know which method/geofence
// is active), but only Admins may change them.
async function requireCompanyContext(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin' && decoded.role !== 'employee')
      return res.status(403).json({ error: 'Unauthorized' });
    req.companyId = decoded.companyId;
    req.role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function publicSettings(company) {
  const s = company?.settings || {};
  return {
    method: s.method || 'admin',
    geofencing: {
      enabled: !!s.geofencing?.enabled,
      locations: (s.geofencing?.locations || []).map(l => ({
        id: l._id, name: l.name, lat: l.lat, lng: l.lng, radiusMeters: l.radiusMeters
      }))
    },
    weekend: {
      global: (s.weekend?.global && s.weekend.global.length === 7)
        ? s.weekend.global
      : DEFAULT_SCHEDULE
    }
  };
}

// GET /api/settings — readable by both admin and employee of the company
router.get('/', requireCompanyContext, async (req, res) => {
  try {
    const company = await Company.findById(req.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const global = company.settings?.weekend?.global;
    // Repair the pre-release default (all days off) and the common first-click
    // result where selecting Sunday inverted the intended Sunday-only setup.
    if (Array.isArray(global) && (global.every(Boolean) || isLegacyInvertedSundayOnly(global))) {
      company.settings.weekend = { global: DEFAULT_SCHEDULE };
      await company.save();
    }
    res.json(publicSettings(company));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings/attendance-method  { method: 'admin' | 'employee' }
router.put('/attendance-method', verifyAdmin, async (req, res) => {
  try {
    const { method } = req.body;
    if (!['admin', 'employee'].includes(method))
      return res.status(400).json({ error: "method must be 'admin' or 'employee'" });

    const company = await Company.findById(req.admin.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    if (!company.settings) company.settings = {};
    company.settings.method = method;
    await company.save();
    res.json({ message: 'Attendance method updated', settings: publicSettings(company) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings/geofencing  { enabled, locations: [{ name, lat, lng, radiusMeters }] }
router.put('/geofencing', verifyAdmin, async (req, res) => {
  try {
    const { enabled, locations } = req.body;
    if (locations !== undefined && !Array.isArray(locations))
      return res.status(400).json({ error: 'locations must be an array' });

    if (Array.isArray(locations)) {
      for (const loc of locations) {
        if (!loc.name || typeof loc.lat !== 'number' || typeof loc.lng !== 'number')
          return res.status(400).json({ error: 'Each location needs a name, lat, and lng' });
        if (loc.lat < -90 || loc.lat > 90 || loc.lng < -180 || loc.lng > 180)
          return res.status(400).json({ error: 'Invalid coordinates' });
      }
    }

    const company = await Company.findById(req.admin.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    if (!company.settings) company.settings = {};
    if (enabled !== undefined) company.settings.geofencing = { ...(company.settings.geofencing || {}), enabled: !!enabled };
    if (Array.isArray(locations)) {
      company.settings.geofencing = {
        ...(company.settings.geofencing || {}),
        locations: locations.map(l => ({
          name: l.name.trim(), lat: l.lat, lng: l.lng,
          radiusMeters: Math.min(20000, Math.max(10, Number(l.radiusMeters) || 200))
        }))
      };
    }
    await company.save();
    res.json({ message: 'Geofencing settings updated', settings: publicSettings(company) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings/weekend  { global: [7 booleans, Sun..Sat] }
router.put('/weekend', verifyAdmin, async (req, res) => {
  try {
    const { global } = req.body;
    if (!Array.isArray(global) || global.length !== 7 || !global.every(v => typeof v === 'boolean'))
      return res.status(400).json({ error: 'global must be an array of 7 booleans (Sun..Sat)' });

    const company = await Company.findById(req.admin.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    if (!company.settings) company.settings = {};
    company.settings.weekend = { global };
    await company.save();
    res.json({ message: 'Weekend schedule updated', settings: publicSettings(company) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
