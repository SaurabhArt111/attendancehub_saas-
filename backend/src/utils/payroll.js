'use strict';

// Shared monthly payroll computation — used by both the admin Reports
// endpoint (GET /api/attendance/report/:month) and the employee-facing
// Payroll endpoint (GET /api/attendance/my-report/:month) so the two always
// show IDENTICAL numbers for the same employee/month. Extracted so there's
// exactly one place this math lives, instead of it drifting between an
// admin-only view and an employee-only view.

// Builds the P/A/PP + estimated-salary row for one employee, given their
// attendance `days` map (Mongoose Map or plain object) for the month.
// NOTE: the estimated-salary math is always monthly-salary ÷ days-in-month ×
// present-days, regardless of `salaryType` — that's the existing, established
// behavior this was extracted from. We only report the true salaryType label
// now (previously hardcoded to 'monthly'); we deliberately do not change how
// a 'daily' salaryType employee's pay is computed, since nothing else in the
// app currently defines what that would mean, and silently changing anyone's
// computed pay is not this fix's call to make.
// PL (Paid Leave) and HD (Half-Day Leave) are additive statuses introduced
// by the Attendance Requests feature — approved leave requests write these
// onto the same day-record grid a P/A/PP is stored on. Payroll is earned
// from recorded work/leave plus eligible elapsed week-offs and holidays.
function computeEmployeeMonthRow(emp, daysMap, daysInMonth, calendar = {}) {
  let P = 0, A = 0, PP = 0, PL = 0, HD = 0, WO = 0;
  const remarks = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const rec = daysMap?.get ? daysMap.get(String(d)) : daysMap?.[String(d)];
    if (!rec) continue;
    if (rec.status === 'P')  P++;
    if (rec.status === 'A')  A++;
    if (rec.status === 'PP') PP++;
    if (rec.status === 'PL') PL++;
    if (rec.status === 'HD') HD++;
    if (rec.status === 'WO') WO++;
    if (rec.remark && rec.remark.trim()) remarks.push(rec.remark.trim());
  }

  const month = calendar.month;
  const holidayDates = calendar.holidayDates || new Set();
  const isWeekend = calendar.isWeekend || (() => false);
  const statusForDate = calendar.statusForDate || (() => undefined);
  const isPresent = (status) => status === 'P' || status === 'PP';
  const isWeekOff = (date) => isWeekend(date) || statusForDate(date) === 'WO';
  const dateFor = (day) => `${month}-${String(day).padStart(2, '0')}`;
  const joiningDate = calendar.joiningDate || '';
  const asOfDate = calendar.asOfDate ? new Date(`${calendar.asOfDate}T00:00:00`) : startOfToday();
  const paidWeekendDates = new Set();

  // A week-off block is paid only when a neighboring working day has an
  // actual Present/Double Shift record. Blank or absent neighbors do not
  // qualify; declared holidays themselves remain paid unconditionally.
  if (month) {
    for (let day = 1; day <= daysInMonth; day++) {
      const start = new Date(`${dateFor(day)}T00:00:00`);
      if (!isWeekOff(start)) continue;
      const previous = new Date(start); previous.setDate(previous.getDate() - 1);
      if (isWeekOff(previous)) continue;
      const end = new Date(start);
      while (isWeekOff(end)) end.setDate(end.getDate() + 1);
      const before = nearestWorkingDay(new Date(start), -1, isWeekOff, holidayDates);
      const after = nearestWorkingDay(new Date(end), 0, isWeekOff, holidayDates);
      if (isPresent(statusForDate(before)) || isPresent(statusForDate(after))) {
        for (const cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
          const key = toDateKey(cursor);
          if (!holidayDates.has(key)) paidWeekendDates.add(key);
        }
      }
    }
  }

  let paidDays = 0;
  if (month) {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = dateFor(day);
      const calendarDate = new Date(`${date}T00:00:00`);
      if (calendarDate > asOfDate) continue;
      if (joiningDate && date < joiningDate) continue;
      const status = statusForDate(calendarDate) || (daysMap?.get ? daysMap.get(String(day))?.status : daysMap?.[String(day)]?.status);
      if (holidayDates.has(date)) paidDays += 1;
      else if (isWeekOff(calendarDate)) paidDays += paidWeekendDates.has(date) ? 1 : 0;
      else if (status === 'PP') paidDays += 2;
      else if (status === 'HD') paidDays += 0.5;
      else if (status === 'P' || status === 'PL') paidDays += 1;
    }
  } else {
    paidDays = P + PP * 2 + PL + HD * 0.5;
  }

  const totalPresent    = paidDays;
  const monthlySalary   = emp.salary || 0;
  const dailySalary     = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
  const estimatedSalary = Math.round(dailySalary * totalPresent);

  return {
    id: emp._id, username: emp.username, employeeId: emp.employeeId,
    designation: emp.designation || '', salary: monthlySalary, salaryType: emp.salaryType || 'monthly',
    dailySalary: Math.round(dailySalary * 100) / 100,
    daysInMonth, P, A, PP, PL, HD, WO, totalPresent, estimatedSalary, remarks,
    paidWeekendDays: countPaidWeekendDays(month, daysInMonth, isWeekOff, holidayDates, paidWeekendDates, asOfDate),
    paidHolidayDays: countMonthHolidays(month, daysInMonth, holidayDates, asOfDate)
  };
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function nearestWorkingDay(date, direction, isWeekOff, holidayDates) {
  const cursor = new Date(date);
  if (direction) cursor.setDate(cursor.getDate() + direction);
  while (isWeekOff(cursor) || holidayDates.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() + (direction || 1));
  }
  return cursor;
}

function countPaidWeekendDays(month, daysInMonth, isWeekOff, holidayDates, paidWeekendDates, asOfDate) {
  if (!month) return 0;
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const calendarDate = new Date(`${date}T00:00:00`);
    if (calendarDate <= asOfDate && isWeekOff(calendarDate) && !holidayDates.has(date) && paidWeekendDates.has(date)) count++;
  }
  return count;
}

function countMonthHolidays(month, daysInMonth, holidayDates, asOfDate) {
  if (!month) return 0;
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    if (new Date(`${date}T00:00:00`) <= asOfDate && holidayDates.has(date)) count++;
  }
  return count;
}

// Extracts numeric advances mentioned in attendance remarks and derives the
// Gross (regular days) / Overtime (double-shift) / Deductions / Net split.
// Mirrors the admin Reports page's `salaryBreakdown` exactly.
function salaryBreakdown(row) {
  const overtime   = Math.round((row.dailySalary || 0) * (row.PP || 0));
  const gross      = Math.max(Math.round((row.estimatedSalary || 0) - overtime), 0);
  const leavePay    = Math.round((row.dailySalary || 0) * ((row.PL || 0) + (row.HD || 0) * 0.5));
  const deductions = parseAdvance(row.remarks || []);
  const net        = Math.max((row.estimatedSalary || 0) - deductions, 0);
  return { gross, overtime, leavePay, deductions, net };
}

function parseAdvance(remarks) {
  let total = 0;
  remarks.forEach(r => {
    const nums = String(r).match(/\d+(\.\d+)?/g);
    if (nums) nums.forEach(n => { total += parseFloat(n); });
  });
  return total;
}

module.exports = { computeEmployeeMonthRow, salaryBreakdown };
