'use strict';

// Resolves whether a given date is a Weekend (day off) day for a specific
// employee: the employee's own override wins if set, otherwise the
// company's global weekend schedule applies. Both are 7-boolean arrays
// indexed Sunday(0)..Saturday(6). A normal company schedule defaults to
// Sunday as the sole weekly off until an admin customizes it.
const DEFAULT_SCHEDULE = [true, false, false, false, false, false, false];

function isLegacyInvertedSundayOnly(schedule) {
  return Array.isArray(schedule) && schedule.length === 7 &&
    schedule[0] === false && schedule.slice(1).every(Boolean);
}

function scheduleFor(company, employee) {
  if (Array.isArray(employee?.weekendOverride) && employee.weekendOverride.length === 7) {
    if (isLegacyInvertedSundayOnly(employee.weekendOverride)) return DEFAULT_SCHEDULE;
    return employee.weekendOverride;
  }
  const global = company?.settings?.weekend?.global;
  if (Array.isArray(global) && global.length === 7) {
    if (global.every(Boolean) || isLegacyInvertedSundayOnly(global)) return DEFAULT_SCHEDULE;
    return global;
  }
  return DEFAULT_SCHEDULE;
}

// `date` may be a Date object or a 'YYYY-MM-DD' string.
function isWeekendDay(company, employee, date) {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const schedule = scheduleFor(company, employee);
  return !!schedule[d.getDay()];
}

module.exports = { isWeekendDay, scheduleFor, DEFAULT_SCHEDULE, isLegacyInvertedSundayOnly };
