const router  = require('express').Router();
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const Admin   = require('../models/Admin');
const Company = require('../models/Company');
const Session = require('../models/Session');
const PendingLogin = require('../models/PendingLogin');
const { verifyAdmin, signToken, JWT_SECRET, SLIDING_MS } = require('../middleware/auth');
const { getDeviceInfo } = require('../utils/deviceInfo');
const { sendPushToAdmin, VAPID_PUBLIC_KEY } = require('../utils/push');

const MAX_ADMIN_DEVICES = 3;
const PENDING_LOGIN_TTL_MS = 5 * 60 * 1000; // security key / approval window

// Creates a Session document for `admin` on the given device, evicting the
// least-recently-active device if the account is already at the concurrent
// device limit. Returns { session, evicted } where `evicted` is a boolean.
async function createSessionForDevice(admin, deviceInfo) {
  const { userAgent, ip, deviceLabel, deviceType } = deviceInfo;
  const now = new Date();

  const activeSessions = await Session.find({
    role: 'admin', userId: admin._id, revoked: false, expiresAt: { $gt: now }
  }).sort({ lastActiveAt: 1 }); // oldest activity first

  let evicted = false;
  if (activeSessions.length >= MAX_ADMIN_DEVICES) {
    const oldest = activeSessions[0];
    oldest.revoked = true;
    oldest.revokedAt = now;
    oldest.revokedReason = 'device-limit';
    await oldest.save();
    evicted = true;
  }

  const session = await Session.create({
    role: 'admin', userId: admin._id, companyId: admin.companyId,
    userAgent, ip, deviceLabel, deviceType,
    createdAt: now, lastActiveAt: now, expiresAt: new Date(now.getTime() + SLIDING_MS)
  });

  return { session, evicted };
}

// Convenience wrapper — pulls device info straight from the request.
async function createAdminSession(admin, req) {
  return createSessionForDevice(admin, getDeviceInfo(req));
}

// Generates a 6-digit numeric "security key" for the device-approval flow.
function generateSecurityCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// POST /api/admin/setup — create primary admin (owner) after company login
router.post('/setup', async (req, res) => {
  try {
    const { companySetupToken, username, adminId, contact, email, password } = req.body;
    if (!companySetupToken || !username || !adminId || !password)
      return res.status(400).json({ error: 'Setup token, username, admin ID, and password required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    let decoded;
    try { decoded = jwt.verify(companySetupToken, JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Invalid or expired setup token' }); }
    if (decoded.role !== 'company_setup')
      return res.status(403).json({ error: 'Invalid token type' });

    const companyId = decoded.companyId;
    const existing = await Admin.findOne({ companyId, isOwner: true });
    if (existing) return res.status(409).json({ error: 'Primary admin already created for this company' });

    if (await Admin.findOne({ companyId, username }))
      return res.status(409).json({ error: 'Username already exists' });
    if (await Admin.findOne({ companyId, adminId }))
      return res.status(409).json({ error: 'Admin ID already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const admin  = await Admin.create({
      companyId, username, adminId, contact: contact || '',
      email: email ? email.trim().toLowerCase() : '', password: hashed, isOwner: true
    });

    const company = await Company.findById(companyId).select('-password');
    const { session } = await createAdminSession(admin, req);
    const token = signToken(
      { id: admin._id, companyId, username: admin.username, role: 'admin', isOwner: true, sid: session._id.toString() }
    );

    res.status(201).json({
      token,
      admin: { id: admin._id, username: admin.username, adminId: admin.adminId, isOwner: true },
      company: { name: company?.name, companyCode: company?.companyCode }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { companyCode, username, password } = req.body;
    if (!companyCode || !username || !password)
      return res.status(400).json({ error: 'Company code, username, and password required' });

    const company = await Company.findOne({ companyCode: companyCode.toUpperCase() });
    if (!company) return res.status(401).json({ error: 'Invalid company code' });

    const admin = await Admin.findOne({
      companyId: company._id,
      $or: [
        { username: { $regex: new RegExp(`^${username}$`, 'i') } },
        { adminId:  { $regex: new RegExp(`^${username}$`, 'i') } }
      ]
    });

    if (!admin || !await bcrypt.compare(password, admin.password))
      return res.status(401).json({ error: 'Invalid credentials' });

    const deviceInfo = getDeviceInfo(req);

    const activeSessionCount = await Session.countDocuments({
      role: 'admin', userId: admin._id, revoked: false, expiresAt: { $gt: new Date() }
    });

    // Already signed in elsewhere → hold this login for approval instead of
    // completing it immediately. The requesting device gets a one-time
    // security key; an already-trusted device must enter it to let this
    // device in (Settings → Security & Sessions → Login Code for Another Session).
    if (activeSessionCount > 0) {
      const code = generateSecurityCode();
      const now = new Date();
      const pending = await PendingLogin.create({
        companyId: company._id, adminId: admin._id, code,
        userAgent: deviceInfo.userAgent, ip: deviceInfo.ip,
        deviceLabel: deviceInfo.deviceLabel, deviceType: deviceInfo.deviceType,
        createdAt: now, expiresAt: new Date(now.getTime() + PENDING_LOGIN_TTL_MS)
      });

      sendPushToAdmin(admin, {
        title: 'New session',
        body: `Someone is trying to sign in on ${deviceInfo.deviceLabel}. Tap to review.`,
        tag: 'new-session',
        url: '/settings/security-sessions',
        pendingId: pending._id.toString()
      }).catch(() => { /* push is best-effort */ });

      return res.json({
        requiresApproval: true,
        pendingId: pending._id,
        code,
        deviceLabel: deviceInfo.deviceLabel,
        expiresAt: pending.expiresAt,
        message: 'This account is already signed in elsewhere. Approve this sign-in from a trusted device.'
      });
    }

    const { session, evicted } = await createAdminSession(admin, req);
    const token = signToken(
      { id: admin._id, companyId: company._id, username: admin.username, role: 'admin', isOwner: admin.isOwner, sid: session._id.toString() }
    );

    res.json({
      token,
      admin: { id: admin._id, username: admin.username, adminId: admin.adminId, isOwner: admin.isOwner },
      company: { name: company.name, companyCode: company.companyCode },
      deviceLimitReached: evicted
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── New-device login approval ("security key") ─────────────────────

// GET /api/admin/pending-login/:id/status — polled by the *new* (unauthenticated)
// device while it waits to be approved.
router.get('/pending-login/:id/status', async (req, res) => {
  try {
    const pending = await PendingLogin.findById(req.params.id);
    if (!pending) return res.status(404).json({ status: 'expired' });

    if (pending.status === 'pending' && pending.expiresAt < new Date()) {
      pending.status = 'expired';
      await pending.save();
    }

    if (pending.status === 'pending') return res.json({ status: 'pending' });
    if (pending.status === 'denied')  return res.json({ status: 'denied' });
    if (pending.status === 'expired') return res.json({ status: 'expired' });

    // approved
    const admin = await Admin.findById(pending.adminId);
    const company = await Company.findById(pending.companyId).select('-password');
    if (!admin || !pending.approvedSessionId) return res.status(410).json({ status: 'expired' });

    const token = signToken({
      id: admin._id, companyId: pending.companyId, username: admin.username,
      role: 'admin', isOwner: admin.isOwner, sid: pending.approvedSessionId.toString()
    });

    res.json({
      status: 'approved',
      token,
      admin: { id: admin._id, username: admin.username, adminId: admin.adminId, isOwner: admin.isOwner },
      company: { name: company?.name, companyCode: company?.companyCode }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/pending-login/check — polled/checked by already-signed-in
// devices so the approval prompt can appear as soon as the app is opened.
router.get('/pending-login/check', verifyAdmin, async (req, res) => {
  try {
    const pending = await PendingLogin.find({
      adminId: req.admin.id, status: 'pending', expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json(pending.map(p => ({
      id: p._id, deviceLabel: p.deviceLabel, deviceType: p.deviceType, ip: p.ip,
      createdAt: p.createdAt, expiresAt: p.expiresAt
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/pending-login/:id/approve — entered from a trusted, already
// signed-in device via "Login Code for Another Session".
router.post('/pending-login/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Security code required' });

    const pending = await PendingLogin.findOne({ _id: req.params.id, adminId: req.admin.id });
    if (!pending) return res.status(404).json({ error: 'Login request not found' });
    if (pending.status !== 'pending') return res.status(409).json({ error: `This request was already ${pending.status}` });
    if (pending.expiresAt < new Date()) {
      pending.status = 'expired';
      await pending.save();
      return res.status(410).json({ error: 'This security key has expired' });
    }
    if (String(code).trim() !== pending.code)
      return res.status(401).json({ error: 'Incorrect security key' });

    const admin = await Admin.findById(pending.adminId);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const { session } = await createSessionForDevice(admin, {
      userAgent: pending.userAgent, ip: pending.ip,
      deviceLabel: pending.deviceLabel, deviceType: pending.deviceType
    });

    pending.status = 'approved';
    pending.approvedSessionId = session._id;
    pending.approvedBySessionId = req.admin.sid || null;
    await pending.save();

    res.json({ message: 'Sign-in approved', deviceLabel: pending.deviceLabel });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/pending-login/:id/deny
router.post('/pending-login/:id/deny', verifyAdmin, async (req, res) => {
  try {
    const pending = await PendingLogin.findOne({ _id: req.params.id, adminId: req.admin.id });
    if (!pending) return res.status(404).json({ error: 'Login request not found' });
    if (pending.status === 'pending') {
      pending.status = 'denied';
      await pending.save();
    }
    res.json({ message: 'Sign-in denied' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Web Push subscriptions ──────────────────────────────────────────

// GET /api/admin/push/vapid-public-key — public, needed before the client can subscribe.
router.get('/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY || null });
});

// POST /api/admin/push/subscribe
router.post('/push/subscribe', verifyAdmin, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth)
      return res.status(400).json({ error: 'Invalid push subscription' });

    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    admin.pushSubscriptions = (admin.pushSubscriptions || []).filter(s => s.endpoint !== subscription.endpoint);
    admin.pushSubscriptions.push({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      sessionId: req.admin.sid || undefined
    });
    await admin.save();
    res.json({ message: 'Subscribed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/push/unsubscribe
router.post('/push/unsubscribe', verifyAdmin, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    admin.pushSubscriptions = (admin.pushSubscriptions || []).filter(s => s.endpoint !== endpoint);
    await admin.save();
    res.json({ message: 'Unsubscribed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/me
router.get('/me', verifyAdmin, async (req, res) => {
  try {
    const admin   = await Admin.findById(req.admin.id).select('-password');
    const company = await Company.findById(req.admin.companyId).select('-password');
    res.json({ admin, company });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/update — update admin profile
router.put('/update', verifyAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const { username, contact, email, currentPassword, newPassword } = req.body;

    if (username && username !== admin.username) {
      const conflict = await Admin.findOne({ companyId: admin.companyId, username, _id: { $ne: admin._id } });
      if (conflict) return res.status(409).json({ error: 'Username already taken' });
      admin.username = username.trim();
    }
    if (contact !== undefined) admin.contact = contact;
    if (email   !== undefined) admin.email   = email.trim().toLowerCase();

    if (newPassword) {
      if (!currentPassword)
        return res.status(400).json({ error: 'Current password required to change password' });
      const valid = await bcrypt.compare(currentPassword, admin.password);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      if (newPassword.length < 6)
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      admin.password = await bcrypt.hash(newPassword, 10);
    }

    await admin.save();
    res.json({ message: 'Profile updated', admin: { username: admin.username, contact: admin.contact, email: admin.email, adminId: admin.adminId } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Security & Sessions ─────────────────────────────────────────────

// GET /api/admin/sessions — active (non-revoked, non-expired) devices
router.get('/sessions', verifyAdmin, async (req, res) => {
  try {
    const sessions = await Session.find({
      role: 'admin', userId: req.admin.id, revoked: false, expiresAt: { $gt: new Date() }
    }).sort({ lastActiveAt: -1 });

    res.json({
      currentSessionId: req.admin.sid || null,
      maxDevices: MAX_ADMIN_DEVICES,
      sessions: sessions.map(s => ({
        id: s._id, deviceLabel: s.deviceLabel, deviceType: s.deviceType, ip: s.ip,
        createdAt: s.createdAt, lastActiveAt: s.lastActiveAt, expiresAt: s.expiresAt,
        isCurrent: req.admin.sid === s._id.toString()
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/sessions/history — recent login history (active + revoked/expired)
router.get('/sessions/history', verifyAdmin, async (req, res) => {
  try {
    const sessions = await Session.find({ role: 'admin', userId: req.admin.id })
      .sort({ createdAt: -1 })
      .limit(25);

    const now = new Date();
    res.json(sessions.map(s => ({
      id: s._id, deviceLabel: s.deviceLabel, deviceType: s.deviceType, ip: s.ip,
      createdAt: s.createdAt, lastActiveAt: s.lastActiveAt,
      status: s.revoked ? (s.revokedReason === 'device-limit' ? 'signed-out (device limit)' : 'signed-out') :
              (s.expiresAt < now ? 'expired' : 'active'),
      isCurrent: req.admin.sid === s._id.toString()
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/sessions/:id/revoke — sign a specific device out
router.post('/sessions/:id/revoke', verifyAdmin, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, role: 'admin', userId: req.admin.id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    session.revoked = true;
    session.revokedAt = new Date();
    session.revokedReason = 'user';
    await session.save();

    await Admin.updateOne(
      { _id: req.admin.id },
      { $pull: { pushSubscriptions: { sessionId: session._id } } }
    );

    res.json({ message: 'Device signed out', wasCurrent: req.admin.sid === session._id.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/sessions/logout-others — sign out every device except this one
router.post('/sessions/logout-others', verifyAdmin, async (req, res) => {
  try {
    const others = await Session.find({ role: 'admin', userId: req.admin.id, revoked: false, _id: { $ne: req.admin.sid } }).select('_id');
    const result = await Session.updateMany(
      { role: 'admin', userId: req.admin.id, revoked: false, _id: { $ne: req.admin.sid } },
      { $set: { revoked: true, revokedAt: new Date(), revokedReason: 'logout-others' } }
    );

    if (others.length) {
      await Admin.updateOne(
        { _id: req.admin.id },
        { $pull: { pushSubscriptions: { sessionId: { $in: others.map(o => o._id) } } } }
      );
    }

    res.json({ message: 'Other devices signed out', count: result.modifiedCount || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
