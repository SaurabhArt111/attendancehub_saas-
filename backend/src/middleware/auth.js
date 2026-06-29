const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';

function verifyAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.admin = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function verifyEmployee(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'employee') {
      return res.status(403).json({ error: 'Employee access required' });
    }

    req.employee = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { verifyAdmin, verifyEmployee };
