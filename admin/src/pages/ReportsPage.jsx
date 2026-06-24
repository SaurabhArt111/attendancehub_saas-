import { useState, useEffect, useMemo } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './ReportsPage.css'

const MONTHS = [
  'January','February','March','April',
  'May','June','July','August',
  'September','October','November','December'
]

export default function ReportsPage() {

  const now = new Date()

  const [year,setYear] = useState(now.getFullYear())
  const [month,setMonth] = useState(now.getMonth())

  const [report,setReport] = useState([])
  const [loading,setLoading] = useState(false)
  const [company,setCompany] = useState(null)

  const monthStr =
    `${year}-${String(month + 1).padStart(2,'0')}`

  useEffect(() => {
    api.get('/company/info')
      .then(r => setCompany(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadReport()
  }, [monthStr])

  async function loadReport() {
    try {
      setLoading(true)

      const { data } =
        await api.get(`/attendance/report/${monthStr}`)

      setReport(data)

    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() {
    if (month === 0) {
      setYear(y => y - 1)
      setMonth(11)
    } else {
      setMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (
      new Date(year, month + 1, 1) >
      new Date()
    ) return

    if (month === 11) {
      setYear(y => y + 1)
      setMonth(0)
    } else {
      setMonth(m => m + 1)
    }
  }

  const stats = useMemo(() => {

    let P = 0
    let A = 0
    let PP = 0
    let payroll = 0

    report.forEach(r => {
      P += r.P || 0
      A += r.A || 0
      PP += r.PP || 0
      payroll += r.estimatedSalary || 0
    })

    return {
      P,
      A,
      PP,
      payroll
    }

  }, [report])

  function parseAdvance(remarks = []) {
    let total = 0

    remarks.forEach(text => {

      const lower = text.toLowerCase()

      if (
        lower.includes('adv') ||
        lower.includes('advance')
      ) {
        const nums =
          text.match(/\d+(\.\d+)?/g)

        if (nums) {
          nums.forEach(n => {
            total += Number(n)
          })
        }
      }
    })

    return total
  }

  function downloadCSV() {

    if (!report.length) return

    const header = [
      'Name',
      'Employee ID',
      'Designation',
      'Present',
      'Half Day',
      'Salary',
      'Payable'
    ]

    const rows = report.map(r => [
      r.username,
      r.employeeId,
      r.designation,
      r.P,
      r.PP,
      r.salary,
      r.estimatedSalary
    ])

    const csv =
      [header, ...rows]
      .map(row =>
        row.map(x => `"${x}"`).join(',')
      )
      .join('\n')

    const blob =
      new Blob([csv], {
        type: 'text/csv'
      })

    const url =
      URL.createObjectURL(blob)

    const a =
      document.createElement('a')

    a.href = url

    a.download =
      `${company?.name || 'Report'}_${MONTHS[month]}_${year}.csv`

    a.click()

    URL.revokeObjectURL(url)
  }

  return (
    <div className="reports-page">

      {/* HEADER */}

      <div className="report-header">

        <div>
          <h1 className="report-title">
            Monthly Report
          </h1>

          <div className="report-company">
            {company?.name}
          </div>
        </div>

        <div className="report-controls">

          <button
            className="nav-btn"
            onClick={prevMonth}
          >
            ←
          </button>

          <div className="month-display">
            {MONTHS[month]} {year}
          </div>

          <button
            className="nav-btn"
            onClick={nextMonth}
          >
            →
          </button>

          <button
            className="export-btn"
            onClick={downloadCSV}
          >
            Export CSV
          </button>

        </div>

      </div>

      {/* KPI CARDS */}

      <div className="report-stats">

        <div className="stat-card present">
          <div className="stat-value">
            {stats.P}
          </div>
          <div className="stat-label">
            Present
          </div>
        </div>

        <div className="stat-card absent">
          <div className="stat-value">
            {stats.A}
          </div>
          <div className="stat-label">
            Absent
          </div>
        </div>

        <div className="stat-card half">
          <div className="stat-value">
            {stats.PP}
          </div>
          <div className="stat-label">
            Half Day
          </div>
        </div>

        <div className="stat-card payroll">
          <div className="stat-value">
            ₹{stats.payroll.toLocaleString()}
          </div>
          <div className="stat-label">
            Payroll
          </div>
        </div>

      </div>

      {/* EMPLOYEES */}

      {loading ? (

        <div className="report-loader">
          Loading Report...
        </div>

      ) : report.length === 0 ? (

        <div className="report-empty">
          No report available
        </div>

      ) : (

        <div className="employee-grid">

          {report.map(emp => {

            const advance =
              parseAdvance(emp.remarks)

            const net =
              (emp.estimatedSalary || 0)
              - advance

            return (

              <div
                key={emp.id}
                className="employee-card"
              >

                <div className="employee-top">

                  <div>

                    <div className="employee-name">
                      {emp.username}
                    </div>

                    <div className="employee-meta">
                      {emp.employeeId}
                    </div>

                  </div>

                  <div className="employee-role">
                    {emp.designation || 'Employee'}
                  </div>

                </div>

                <div className="employee-stats">

                  <div>
                    <span>P</span>
                    <strong>{emp.P}</strong>
                  </div>

                  <div>
                    <span>PP</span>
                    <strong>{emp.PP}</strong>
                  </div>

                  <div>
                    <span>Total</span>
                    <strong>
                      {emp.totalPresent}
                    </strong>
                  </div>

                </div>

                <div className="salary-section">

                  <div>
                    Salary
                    <strong>
                      ₹{emp.salary?.toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    Payable
                    <strong>
                      ₹{emp.estimatedSalary?.toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    Net
                    <strong>
                      ₹{net.toLocaleString()}
                    </strong>
                  </div>

                </div>

                {emp.remarks?.length > 0 && (

                  <div className="remarks">

                    {emp.remarks.map(
                      (remark, i) => (
                        <div
                          key={i}
                          className="remark"
                        >
                          {remark}
                        </div>
                      )
                    )}

                  </div>

                )}

              </div>

            )

          })}

        </div>

      )}

    </div>
  )
}