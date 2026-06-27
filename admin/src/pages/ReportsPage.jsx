import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './ReportsPage.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function ReportsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [report, setReport] = useState([])
  const [loading, setLoading] = useState(false)
  const [company, setCompany] = useState(null)

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  useEffect(() => {
    api.get('/company/info').then(r => setCompany(r.data)).catch(() => { })
  }, [])

  useEffect(() => {
    setLoading(true)
    api.get(`/attendance/report/${monthStr}`)
      .then(r => setReport(r.data))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false))
  }, [monthStr])

  function prevM() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextM() {
    if (new Date(year, month + 1, 1) > new Date()) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  const totals = report.reduce((a, r) => {
    const advance = parseAdvance(r.remarks)
    a.employees += 1
    a.present += r.totalPresent || 0
    a.advance += advance
    a.salaryAfterAdvance += Math.max((r.estimatedSalary || 0) - advance, 0)
    return a
  }, { employees: 0, present: 0, advance: 0, salaryAfterAdvance: 0 })

  // ── CSV Download ──
  function downloadCSV() {
    const daysInMonth = report[0]?.daysInMonth || 30
    const headerRow = ['Sr.No.', 'Name', 'Designation', `Salary (${daysInMonth} days)`, 'Present', 'Total Salary', 'Advance/Remark', 'Net Salary', 'Signature']
    const rows = report.map((r, idx) => {
      const present = r.totalPresent
      const salaryLabel = r.salaryType === 'daily' ? `Rs ${r.salary}/day` : `Rs ${r.salary}/mo`
      const totalSalary = r.estimatedSalary

      // Parse advance amounts from remarks
      const advTotal = parseAdvance(r.remarks)
      const netSalary = Math.max(totalSalary - advTotal, 0)

      return [
        idx + 1,
        r.username,
        r.designation || '-',
        salaryLabel,
        present,
        totalSalary,
        r.remarks.join(', ') || '-',
        netSalary,
        ''
      ]
    })

    const csv = [headerRow, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Attendance_${company?.name || 'Report'}_${MONTHS[month]}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Extract numeric advance from any remark, with or without the word "advance".
  function parseAdvance(remarks) {
    let total = 0
    remarks.forEach(r => {
      const nums = String(r).match(/\d+(\.\d+)?/g)
      if (nums) nums.forEach(n => { total += parseFloat(n) })
    })
    return total
  }

  return (
    <div>

      <div className="reports-header-container" style={{ marginBottom: '1.5rem' }}>
        {/* Title & Company Info */}
        <div style={{ flex: '0 0 auto' }}>
          <h1 className="font-700" style={{ fontSize: '1.2rem', margin: '0 0 0.25rem 0' }}>
            Monthly Report
          </h1>
          {company && (
            <div className="text-xs text-2" style={{ marginTop: '0.25rem' }}>
              {company.name}
            </div>
          )}
        </div>

        {/* Controls: Month Navigation + Download */}
        <div className="reports-controls-wrapper">
          {/* Month Navigation */}
          <div className="reports-month-nav">
            <button
              className="btn btn-secondary btn-sm"
              onClick={prevM}
              style={{
                padding: '0.35rem 0.55rem',
                minWidth: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Previous month"
              aria-label="Previous month"
            >
              &#8249;
            </button>
            <span
              className="font-600"
              style={{
                minWidth: '135px',
                textAlign: 'center',
                fontSize: '.88rem',
                whiteSpace: 'nowrap',
                padding: '0.35rem 0.5rem'
              }}
            >
              {MONTHS[month]} {year}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={nextM}
              disabled={new Date(year, month + 1, 1) > new Date()}
              style={{
                padding: '0.35rem 0.55rem',
                minWidth: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Next month"
              aria-label="Next month"
            >
              &#8250;
            </button>
          </div>

          {/* Download CSV Button — always visible */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
            <button
              className="btn btn-success btn-sm reports-download-btn"
              onClick={downloadCSV}
              disabled={!report.length}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                whiteSpace: 'nowrap',
                padding: '0.4rem 0.9rem',
                opacity: report.length ? 1 : 0.45,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download CSV</span>
            </button>
            <div className="text-xs text-2 reports-csv-hint" style={{ textAlign: 'right' }}>
              Open AttendanceHub in a browser to save the Excel file
            </div>
          </div>
        </div>
      </div>

      {/* STATS CARDS SECTION */}
      <div className="report-stat-grid mb-2">
        {[
          { label: 'Total Employees', val: totals.employees, cls: 'text-success' },
          { label: 'Total Present', val: totals.present, cls: '' },
          { label: 'Total Advance', val: `Rs ${totals.advance.toLocaleString()}`, cls: 'text-danger' },
          { label: 'Salary After Advance', val: `Rs ${totals.salaryAfterAdvance.toLocaleString()}`, cls: '', style: { color: '#a78bfa' } },
        ].map(s => (
          <div key={s.label} className="card card-sm report-stat-card" style={{ textAlign: 'center' }}>
            <div className={`font-700 ${s.cls}`} style={{ fontSize: '1.35rem', ...(s.style || {}) }}>{s.val}</div>
            <div className="text-xs text-2">{s.label}</div>
          </div>
        ))}
      </div>

      {/* DATA TABLE SECTION */}
      <div className="card report-table-wrapper" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem' }}><span className="spinner" /></div>
        ) : report.length === 0 ? (
          <div className="empty">No data for this month.</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="report-table-desktop">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Desig.</th>
                    <th>Salary</th>
                    <th><span className="badge badge-P">P</span></th>
                    <th><span className="badge badge-PP">PP</span></th>
                    <th>Net Pay</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r, idx) => (
                    <tr key={r.id}>
                      <td className="text-2 text-sm">{idx + 1}</td>
                      <td className="font-600">
                        <div>{r.username}</div>
                        <div className="text-xs text-2" style={{ fontFamily: 'monospace' }}>{r.employeeId}</div>
                      </td>
                      <td className="text-sm text-2">{r.designation || '-'}</td>
                      <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>
                        {r.salary ? (r.salaryType === 'daily' ? `Rs ${r.salary}/d` : `Rs ${r.salary?.toLocaleString()}`) : '-'}
                      </td>
                      <td className="text-success font-600">{r.P || 0}</td>
                      <td style={{ color: '#a78bfa', fontWeight: 600 }}>{r.PP || 0}</td>
                      <td className="font-600">
                        {r.salary ? `Rs ${Math.max((r.estimatedSalary || 0) - parseAdvance(r.remarks), 0).toLocaleString()}` : '-'}
                      </td>
                      <td className="text-sm" style={{ maxWidth: 160 }}>
                        {r.remarks.length > 0 ? (
                          <span title={r.remarks.join(' | ')} style={{ color: 'var(--warn)', cursor: 'help' }}>
                            {r.remarks.length} rmk{r.remarks.length > 1 ? 's' : ''}
                          </span>
                        ) : <span className="text-2">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="report-table-mobile">
              <div className="report-cards-list">
                {report.map((r, idx) => (
                  <div key={r.id} className="report-employee-card">
                    {/* Card Header: Name & ID */}
                    <div className="report-card-header">
                      <div>
                        <div className="report-card-name">{r.username}</div>
                        <div className="report-card-id">{r.employeeId}</div>
                      </div>
                      <div className="report-card-badge">#{idx + 1}</div>
                    </div>

                    {/* Card Body: Key Metrics */}
                    <div className="report-card-metrics">
                      <div className="report-metric">
                        <span className="report-metric-label">Present (P)</span>
                        <span className="report-metric-value text-success">{r.P || 0}</span>
                      </div>
                      <div className="report-metric">
                        <span className="report-metric-label">Double (PP)</span>
                        <span className="report-metric-value" style={{ color: '#a78bfa' }}>{r.PP || 0}</span>
                      </div>
                    </div>

                    {/* Card Body: Secondary Details */}
                    <div className="report-card-details">
                      {r.designation && (
                        <div className="report-detail-row">
                          <span className="report-detail-label">Designation</span>
                          <span className="report-detail-value">{r.designation}</span>
                        </div>
                      )}
                      {r.salary && (
                        <div className="report-detail-row">
                          <span className="report-detail-label">Salary</span>
                          <span className="report-detail-value">
                            {r.salaryType === 'daily' ? `Rs ${r.salary}/d` : `Rs ${r.salary?.toLocaleString()}`}
                          </span>
                        </div>
                      )}
                      <div className="report-detail-row">
                        <span className="report-detail-label">Net Pay</span>
                        <span className="report-detail-value font-600">
                          {r.salary ? `Rs ${Math.max((r.estimatedSalary || 0) - parseAdvance(r.remarks), 0).toLocaleString()}` : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Remarks */}
                    {r.remarks.length > 0 && (
                      <div className="report-card-remarks">
                        <span className="report-remarks-tag">
                          {r.remarks.length} remark{r.remarks.length > 1 ? 's' : ''}
                        </span>
                        <div className="report-remarks-list">
                          {r.remarks.map((remark, i) => (
                            <div key={i} className="report-remark-item">{remark}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}