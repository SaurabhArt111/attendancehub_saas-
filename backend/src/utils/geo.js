'use strict';

// Haversine great-circle distance between two lat/lng points, in meters.
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius, meters
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Given a punch's coordinates and a company's configured workplace
// locations, finds the nearest location and whether the punch falls inside
// its allowed radius. Returns null if there are no configured locations.
function nearestLocation(lat, lng, locations) {
  if (!Array.isArray(locations) || !locations.length) return null;
  let best = null;
  for (const loc of locations) {
    const d = distanceMeters(lat, lng, loc.lat, loc.lng);
    if (!best || d < best.distanceMeters) {
      best = { location: loc, distanceMeters: d, withinRadius: d <= (loc.radiusMeters || 200) };
    }
  }
  return best;
}

module.exports = { distanceMeters, nearestLocation };
