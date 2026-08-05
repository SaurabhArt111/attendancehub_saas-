'use strict';

const Session = require('../models/Session');

// How long a device can go completely dark (no authenticated request at all)
// before we treat it as gone rather than merely idle. Every authenticated
// request refreshes `lastActiveAt` (see middleware/auth.js), so an app that's
// still installed keeps this current on its own just by being opened now and
// then — a genuinely idle-but-installed device is never affected. This is
// what actually catches an uninstall / "clear site data": once that happens
// the client can never call the server again, so lastActiveAt simply stops
// moving, and the session ages past this cutoff on its own.
//
// Deliberately much shorter than the 30-day sliding JWT expiry (SLIDING_DAYS
// in auth.js), which answers a different question — "how long can you go
// without re-entering your password" — not "does this still count as one of
// your devices for the device-limit cap".
const STALE_SESSION_DAYS = parseInt(process.env.STALE_SESSION_DAYS || '5', 10);
const STALE_SESSION_MS   = STALE_SESSION_DAYS * 24 * 60 * 60 * 1000;

function staleCutoff() {
  return new Date(Date.now() - STALE_SESSION_MS);
}

// Revokes every session for this account that has gone dark past the stale
// cutoff. Called right before any device-limit decision so a phantom session
// left behind by an uninstalled app can never block a real login — while a
// session that's still genuinely in use (even if not opened today) is left
// completely alone, and the cap itself is never bypassed, only kept honest.
async function pruneStaleSessions(role, userId) {
  const result = await Session.updateMany(
    { role, userId, revoked: false, expiresAt: { $gt: new Date() }, lastActiveAt: { $lt: staleCutoff() } },
    { $set: { revoked: true, revokedAt: new Date(), revokedReason: 'stale-device' } }
  );
  return result.modifiedCount || 0;
}

// The single source of truth for "how many devices does this account
// currently occupy" — always prunes stale ones first, so the number handed
// back is never inflated by a device that's actually gone.
async function countActiveSessions(role, userId) {
  await pruneStaleSessions(role, userId);
  return Session.countDocuments({ role, userId, revoked: false, expiresAt: { $gt: new Date() } });
}

// Housekeeping sweep across every account — keeps the Security & Sessions /
// signed-in-devices lists honest even for accounts that aren't actively
// trying to log in right now. Safe to run repeatedly; it only ever revokes
// sessions that are already stale.
async function pruneAllStaleSessions() {
  const result = await Session.updateMany(
    { revoked: false, expiresAt: { $gt: new Date() }, lastActiveAt: { $lt: staleCutoff() } },
    { $set: { revoked: true, revokedAt: new Date(), revokedReason: 'stale-device' } }
  );
  return result.modifiedCount || 0;
}

module.exports = {
  pruneStaleSessions,
  countActiveSessions,
  pruneAllStaleSessions,
  STALE_SESSION_DAYS,
  STALE_SESSION_MS
};
