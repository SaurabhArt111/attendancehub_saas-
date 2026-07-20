import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './EmployeesPage.css'
import './ReportsPage.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Breaks a report row's estimated salary into a Gross (regular days) component
// and an Overtime/PP (double-shift) component. The two always sum exactly to
// estimatedSalary so Gross + Overtime − Deductions === Net Pay.
function salaryBreakdown(r) {
  const gross = Math.round((r.dailySalary || 0) * (r.P || 0))
  const overtime = Math.max((r.estimatedSalary || 0) - gross, 0)
  const deductions = parseAdvance(r.remarks)
  const net = Math.max((r.estimatedSalary || 0) - deductions, 0)
  return { gross, overtime, deductions, net }
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

export default function ReportsPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [report, setReport] = useState([])
  const [loading, setLoading] = useState(false)
  const [company, setCompany] = useState(null)
  const [search, setSearch] = useState('')
  const [filterDesig, setFilterDesig] = useState('')

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

  const uniqueDesignations = useMemo(
    () => [...new Set(report.map(r => r.designation).filter(Boolean))].sort(),
    [report]
  )

  const filteredReport = useMemo(() => {
    const q = search.toLowerCase()
    return report.filter(r => {
      const matchSearch = !q || r.username.toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q) || (r.designation || '').toLowerCase().includes(q)
      const matchDesig = !filterDesig || r.designation === filterDesig
      return matchSearch && matchDesig
    })
  }, [report, search, filterDesig])

  const totals = filteredReport.reduce((a, r) => {
    const { deductions, net } = salaryBreakdown(r)
    a.employees += 1
    a.present += r.totalPresent || 0
    a.advance += deductions
    a.salaryAfterAdvance += net
    return a
  }, { employees: 0, present: 0, advance: 0, salaryAfterAdvance: 0 })

  // ── CSV Download (reflects current search/filter) ──
  function downloadCSV() {
    const daysInMonth = report[0]?.daysInMonth || 30
    const headerRow = ['Sr.No.', 'Name', 'Employee ID', 'Designation', `Monthly Salary (${daysInMonth} days)`, 'Daily Salary', 'Present', 'Gross Salary', 'Overtime/PP Pay', 'Deductions/Advances', 'Net Pay', 'Remarks', 'Signature']
    const rows = filteredReport.map((r, idx) => {
      const { gross, overtime, deductions, net } = salaryBreakdown(r)
      return [
        idx + 1,
        r.username,
        r.employeeId,
        r.designation || '-',
        r.salary ? `Rs ${r.salary}/mo` : 'Not set',
        r.salary ? `Rs ${(r.dailySalary || 0).toLocaleString()}/day` : '-',
        r.totalPresent,
        r.salary ? gross : '-',
        r.salary ? overtime : '-',
        deductions,
        r.salary ? net : '-',
        r.remarks.join(', ') || '-',
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

  // ── Download PDF directly (no browser print dialog) ──
  function downloadPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const margin = 40
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const maxY = pageHeight - margin
    let y = margin

    const addLine = (text, fontSize = 10, weight = 'normal') => {
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', weight)
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2)
      lines.forEach(line => {
        if (y > maxY) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += fontSize + 4
      })
    }

    addLine(`${company?.name || 'Attendance Report'}`, 16, 'bold')
    addLine(`Monthly Report — ${MONTHS[month]} ${year}`, 11)
    addLine(`Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 10)
    y += 8

    addLine('Summary', 12, 'bold')
    addLine(`Total Employees: ${totals.employees}`)
    addLine(`Total Present: ${totals.present}`)
    addLine(`Total Advance: Rs ${totals.advance.toLocaleString()}`)
    addLine(`Salary After Advance: Rs ${totals.salaryAfterAdvance.toLocaleString()}`)
    y += 6

    addLine('Employees', 12, 'bold')
    filteredReport.forEach((r, idx) => {
      const { gross, overtime, deductions, net } = salaryBreakdown(r)
      addLine(`${idx + 1}. ${r.username} (${r.employeeId})`, 10, 'bold')
      addLine(`Designation: ${r.designation || '-'} | P: ${r.P || 0} | PP: ${r.PP || 0}`)
      addLine(`Gross: Rs ${gross.toLocaleString()} | Overtime: Rs ${overtime.toLocaleString()} | Deductions: Rs ${deductions.toLocaleString()} | Net: Rs ${net.toLocaleString()}`)
      addLine(`Remarks: ${r.remarks.join(', ') || '-'}`)
      y += 4
    })

    doc.save(`Attendance_${company?.name || 'Report'}_${MONTHS[month]}_${year}.pdf`)
  }

  return (
    <div>

      <div className="reports-header-container" style={{ marginBottom: '1.5rem' }}>
        {/* Title & Company Info */}
        <div className="no-print" style={{ flex: '0 0 auto' }}>
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
          <div className="reports-month-nav no-print">
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

          {/* Download CSV + Print/PDF — always visible */}
          <div className="reports-download-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
            <div className="flex gap-1 no-print">
              <button
                className="btn btn-success btn-sm reports-download-btn"
                onClick={downloadCSV}
                disabled={!filteredReport.length}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  padding: '0.4rem 0.9rem',
                  opacity: filteredReport.length ? 1 : 0.45,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download CSV</span>
              </button>
              <button
                className="btn btn-secondary btn-sm reports-download-btn"
                onClick={downloadPDF}
                disabled={!filteredReport.length}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  padding: '0.4rem 0.9rem',
                  opacity: filteredReport.length ? 1 : 0.45,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Download PDF</span>
              </button>
            </div>
            <div className="text-xs text-2 reports-csv-hint no-print" style={{ textAlign: 'right' }}>
              PDF will be downloaded automatically
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER */}
      <div className="emp-filters no-print mb-2">
        <div className="search-wrap">
          <SearchIcon />
          <input className="input" placeholder="Search by name, ID, or designation..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        {uniqueDesignations.length > 0 && (
          <select className="input emp-filter-select" value={filterDesig} onChange={e => setFilterDesig(e.target.value)}>
            <option value="">All designations</option>
            {uniqueDesignations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {/* Print-only header */}
      <div className="print-only reports-print-header">
        <h1>{company?.name || 'Attendance Report'}</h1>
        <div>Monthly Report — {MONTHS[month]} {year}</div>
        <div className="text-xs">Generated {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>

      {(search || filterDesig) && (
        <div className="text-xs text-2 mb-1 no-print">
          Showing {filteredReport.length} of {report.length} employees
          <button className="bulk-link" style={{ marginLeft: '.6rem' }} onClick={() => { setSearch(''); setFilterDesig('') }}>Clear filters</button>
        </div>
      )}

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
        ) : filteredReport.length === 0 ? (
          <div className="empty no-print">No employees match your search/filter.</div>
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
                    <th><span className="badge badge-P">P</span></th>
                    <th><span className="badge badge-PP">PP</span></th>
                    <th>Gross Salary</th>
                    <th>Overtime/PP Pay</th>
                    <th>Deductions/Advances</th>
                    <th>Net Pay</th>
                    <th className="no-print">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReport.map((r, idx) => {
                    const { gross, overtime, deductions, net } = salaryBreakdown(r)
                    const hasSalary = !!r.salary
                    return (
                      <tr key={r.id}>
                        <td className="text-2 text-sm">{idx + 1}</td>
                        <td className="font-600">
                          <button className="report-name-link" onClick={() => navigate(`/employees/${r.id}?tab=attendance`)}>
                            {r.username}
                          </button>
                          <div className="text-xs text-2" style={{ fontFamily: 'monospace' }}>{r.employeeId}</div>
                        </td>
                        <td className="text-sm text-2">{r.designation || '-'}</td>
                        <td className="text-success font-600">{r.P || 0}</td>
                        <td style={{ color: '#a78bfa', fontWeight: 600 }}>{r.PP || 0}</td>
                        <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>
                          {hasSalary ? (
                            <>
                              Rs {gross.toLocaleString()}
                              <div className="text-xs text-2">Rs {(r.dailySalary || 0).toLocaleString()}/day</div>
                            </>
                          ) : (
                            <button className="report-set-salary-link no-print" onClick={() => navigate(`/employees/${r.id}?tab=edit`)}>
                              Set Salary
                            </button>
                          )}
                        </td>
                        <td className="text-sm" style={{ color: overtime ? '#a78bfa' : undefined }}>
                          {hasSalary ? `Rs ${overtime.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-sm" style={{ color: deductions ? 'var(--danger)' : undefined }}>
                          {deductions ? `Rs ${deductions.toLocaleString()}` : '-'}
                        </td>
                        <td className="font-600">
                          {hasSalary ? `Rs ${net.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-sm no-print" style={{ maxWidth: 160 }}>
                          {r.remarks.length > 0 ? (
                            <span title={r.remarks.join(' | ')} style={{ color: 'var(--warn)', cursor: 'help' }}>
                              {r.remarks.length} rmk{r.remarks.length > 1 ? 's' : ''}
                            </span>
                          ) : <span className="text-2">-</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="report-table-mobile">
              <div className="report-cards-list">
                {filteredReport.map((r, idx) => {
                  const { gross, overtime, deductions, net } = salaryBreakdown(r)
                  const hasSalary = !!r.salary
                  return (
                    <div key={r.id} className="report-employee-card">
                      {/* Card Header: Name & ID */}
                      <div className="report-card-header">
                        <div>
                          <button className="report-name-link report-card-name" onClick={() => navigate(`/employees/${r.id}?tab=attendance`)}>
                            {r.username}
                          </button>
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
                        <div className="report-detail-row">
                          <span className="report-detail-label">Gross Salary</span>
                          <span className="report-detail-value">
                            {hasSalary ? (
                              <>Rs {gross.toLocaleString()}<span className="text-xs text-2"> (Rs {(r.dailySalary || 0).toLocaleString()}/day)</span></>
                            ) : (
                              <button className="report-set-salary-link no-print" onClick={() => navigate(`/employees/${r.id}?tab=edit`)}>Set Salary</button>
                            )}
                          </span>
                        </div>
                        <div className="report-detail-row">
                          <span className="report-detail-label">Overtime/PP Pay</span>
                          <span className="report-detail-value">{hasSalary ? `Rs ${overtime.toLocaleString()}` : '-'}</span>
                        </div>
                        <div className="report-detail-row">
                          <span className="report-detail-label">Deductions/Advances</span>
                          <span className="report-detail-value">{deductions ? `Rs ${deductions.toLocaleString()}` : '-'}</span>
                        </div>
                        <div className="report-detail-row">
                          <span className="report-detail-label">Net Pay</span>
                          <span className="report-detail-value font-600">
                            {hasSalary ? `Rs ${net.toLocaleString()}` : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer: Remarks */}
                      {r.remarks.length > 0 && (
                        <div className="report-card-remarks no-print">
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
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg> }
