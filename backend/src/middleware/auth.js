const jwt     = require('jsonwebtoken');
const Session = require('../models/Session');

const JWT_SECRET   = process.env.JWT_SECRET || 'attendancehub-saas-super-secret-key-2024';
const SLIDING_DAYS  = 30;
const SLIDING_MS    = SLIDING_DAYS * 24 * 60 * 60 * 1000;

// Sign a token with the standard sliding expiry (30 days from "now").
// Used both at login and on every authenticated request (refresh).
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SLIDING_DAYS}d` });
}

// verifyAdmin — validates the JWT, validates the underlying Session (device),
// bumps the session's sliding expiry, and hands the client a freshly-signed
// token (via the `x-new-token` response header) with another 30 days on it.
// If the device is inactive for 30 consecutive days, the last-issued token's
// exp claim lapses naturally and this will start rejecting with 401.
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  try {
    if (decoded.sid) {
      const session = await Session.findById(decoded.sid);
      if (!session || session.revoked || session.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Session expired or was signed out. Please log in again.' });
      }
      const now = new Date();
      session.lastActiveAt = now;
      session.expiresAt = new Date(now.getTime() + SLIDING_MS);
      // Awaited to guarantee persistence before responding.
      await session.save();
    }

    req.admin = decoded;

    const freshToken = signToken({
      id: decoded.id, companyId: decoded.companyId, username: decoded.username,
      role: 'admin', isOwner: decoded.isOwner, sid: decoded.sid
    });
    res.setHeader('x-new-token', freshToken);
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// verifyEmployee — same sliding-refresh behavior as verifyAdmin. Employee
// sessions aren't tracked in the Session collection (no device-list UI is
// required for employees), so this just re-signs the token on every request.
const verifyEmployee = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (decoded.role !== 'employee') return res.status(403).json({ error: 'Employee access required' });

  req.employee = decoded;

  const freshToken = signToken({
    id: decoded.id, companyId: decoded.companyId, username: decoded.username, role: 'employee'
  });
  res.setHeader('x-new-token', freshToken);
  next();
};

module.exports = { verifyAdmin, verifyEmployee, signToken, JWT_SECRET, SLIDING_DAYS, SLIDING_MS };
