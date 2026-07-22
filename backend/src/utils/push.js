'use strict';

const webpush = require('web-push');

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT      = process.env.VAPID_SUBJECT || 'mailto:support@attendancehub.app';

const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (pushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  // Not fatal — the app works fine without push, sessions can still be
  // approved from the "Login Code for Another Session" screen manually.
  console.warn('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications are disabled.');
}

// Sends `payload` (plain object; will be JSON-stringified) to every push
// subscription stored on `admin`, optionally skipping one session's device
// (e.g. don't notify the device that is itself the subject of the alert).
// Silently drops subscriptions the browser has invalidated (404/410).
async function sendPushToAdmin(admin, payload, { excludeSessionId } = {}) {
  if (!pushConfigured) return { sent: 0, configured: false };
  const subs = (admin.pushSubscriptions || []).filter(
    s => !excludeSessionId || String(s.sessionId) !== String(excludeSessionId)
  );
  if (!subs.length) return { sent: 0, configured: true };

  const body = JSON.stringify(payload);
  const stale = [];
  let sent = 0;

  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) stale.push(sub.endpoint);
    }
  }));

  if (stale.length) {
    admin.pushSubscriptions = admin.pushSubscriptions.filter(s => !stale.includes(s.endpoint));
    await admin.save();
  }

  return { sent, configured: true };
}

module.exports = { sendPushToAdmin, VAPID_PUBLIC_KEY, pushConfigured };
