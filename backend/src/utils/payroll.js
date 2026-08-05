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
function computeEmployeeMonthRow(emp, daysMap, daysInMonth) {
  let P = 0, A = 0, PP = 0;
  const remarks = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const rec = daysMap?.get ? daysMap.get(String(d)) : daysMap?.[String(d)];
    if (!rec) continue;
    if (rec.status === 'P')  P++;
    if (rec.status === 'A')  A++;
    if (rec.status === 'PP') PP++;
    if (rec.remark && rec.remark.trim()) remarks.push(rec.remark.trim());
  }

  const totalPresent    = P + PP * 2;
  const monthlySalary   = emp.salary || 0;
  const dailySalary     = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
  const estimatedSalary = Math.round(dailySalary * totalPresent);

  return {
    id: emp._id, username: emp.username, employeeId: emp.employeeId,
    designation: emp.designation || '', salary: monthlySalary, salaryType: emp.salaryType || 'monthly',
    dailySalary: Math.round(dailySalary * 100) / 100,
    daysInMonth, P, A, PP, totalPresent, estimatedSalary, remarks
  };
}

// Extracts numeric advances mentioned in attendance remarks and derives the
// Gross (regular days) / Overtime (double-shift) / Deductions / Net split.
// Mirrors the admin Reports page's `salaryBreakdown` exactly.
function salaryBreakdown(row) {
  const gross      = Math.round((row.dailySalary || 0) * (row.P || 0));
  const overtime   = Math.max((row.estimatedSalary || 0) - gross, 0);
  const deductions = parseAdvance(row.remarks || []);
  const net        = Math.max((row.estimatedSalary || 0) - deductions, 0);
  return { gross, overtime, deductions, net };
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
