'use strict';

// Minimal, dependency-free User-Agent parsing — good enough for a human-readable
// "device label" shown in Settings → Security & Sessions. Not exhaustive.

function detectBrowser(ua) {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera';
  if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) return 'Safari';
  return 'Browser';
}

function detectOS(ua) {
  if (/windows/i.test(ua)) return 'Windows';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/mac os x|macintosh/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown OS';
}

function detectDeviceType(ua) {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android.*mobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getDeviceInfo(req) {
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const browser = detectBrowser(ua);
  const os = detectOS(ua);
  const deviceType = detectDeviceType(ua);
  return {
    userAgent: ua,
    ip: String(ip).split(',')[0].trim(),
    deviceLabel: `${browser} on ${os}`,
    deviceType
  };
}

module.exports = { getDeviceInfo };
