import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import AttendanceCalendar from '../components/AttendanceCalendar'
import EmployeeScheduleTab from '../components/EmployeeScheduleTab'
import BackButton from '../components/BackButton'
import { ProfileSkeleton } from '../components/Skeleton'
import './EmployeesPage.css'

const EMPTY_FORM = {
  username: '',
  employeeId: '',
  contact: '',
  email: '',
  designation: '',
  salary: '',
  salaryType: 'monthly',
  password: '',
  isActive: true,
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function EmployeeDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [employee, setEmployee] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [proofFile, setProofFile] = useState(null)
  const [existingProofUrl, setExistingProofUrl] = useState(null)
  const [hasExistingProof, setHasExistingProof] = useState(false)
  const [removingProof, setRemovingProof] = useState(false)
  const [resettingPin, setResettingPin] = useState(false)
  const [payrollStats, setPayrollStats] = useState(null)
  const [payrollLoading, setPayrollLoading] = useState(true)
  const [payrollError, setPayrollError] = useState(null)
  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    ['overview', 'edit', 'documents', 'attendance', 'schedule'].includes(requestedTab) ? requestedTab : 'overview'
  )

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get(`/employees/${id}`)
        if (!ignore) {
          setEmployee(data)
          setForm({
            username: data.username || '',
            employeeId: data.employeeId || '',
            contact: data.contact || '',
            email: data.email || '',
            designation: data.designation || '',
            salary: data.salary || '',
            salaryType: data.salaryType || 'monthly',
            password: '',
            isActive: data.isActive !== false,
          })
          setHasExistingProof(!!data.hasIdProof)
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load employee')
        if (!ignore) navigate('/employees')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => { ignore = true }
  }, [id, navigate])

  useEffect(() => {
    if (!employee?.hasIdProof) {
      setExistingProofUrl(null)
      return
    }

    let revoked = false
    let blobUrl = ''
    api.get(`/employees/${id}/id-proof`, { responseType: 'blob' })
      .then(res => {
        if (!revoked) {
          blobUrl = URL.createObjectURL(res.data)
          setExistingProofUrl(blobUrl)
        }
      })
      .catch(() => {
        if (!revoked) setExistingProofUrl(null)
      })

    return () => {
      revoked = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [employee?.hasIdProof, id])

  useEffect(() => {
    async function loadPayroll() {
      if (!employee) return
      setPayrollLoading(true)
      setPayrollError(null)
      try {
        const now = new Date()
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const { data } = await api.get(`/attendance/report/${monthStr}`)
        const current = data.find(r => r.id === employee._id || r.employeeId === employee.employeeId)
        if (!current) {
          setPayrollStats({ totalPresent: 0, gross: 0, overtime: 0, deductions: 0, net: 0, month: monthStr })
        } else {
          const dailySalary = current.dailySalary || 0
          const overtime = Math.round(dailySalary * (current.PP || 0))
          const gross = Math.max(Math.round((current.estimatedSalary || 0) - overtime), 0)
          const deductions = current.remarks ? current.remarks.reduce((sum, remark) => {
            const nums = String(remark).match(/\d+(\.\d+)?/g)
            if (nums) nums.forEach(n => { sum += parseFloat(n) })
            return sum
          }, 0) : 0
          const net = Math.max((current.estimatedSalary || 0) - deductions, 0)
          setPayrollStats({ ...current, gross, overtime, deductions, net, month: monthStr })
        }
      } catch (err) {
        setPayrollError('Failed to load payroll data')
      } finally {
        setPayrollLoading(false)
      }
    }

    loadPayroll()
  }, [employee])

  useEffect(() => {
    if (!proofFile) return
    return () => URL.revokeObjectURL(URL.createObjectURL(proofFile))
  }, [proofFile])

  const previewUrl = useMemo(() => {
    if (proofFile) {
      return URL.createObjectURL(proofFile)
    }
    return existingProofUrl
  }, [proofFile, existingProofUrl])

  const handleChange = (field) => (event) => {
    const value = event.target.value
    setForm(prev => ({ ...prev, [field]: field === 'isActive' ? value === 'true' : value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        username: form.username,
        employeeId: form.employeeId,
        contact: form.contact,
        email: form.email,
        designation: form.designation,
        salary: form.salary,
        salaryType: form.salaryType,
        isActive: form.isActive,
      }
      if (form.password) payload.password = form.password
      await api.put(`/employees/${id}`, payload)

      if (proofFile) {
        const fd = new FormData()
        fd.append('idProof', proofFile)
        await api.post(`/employees/${id}/id-proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }

      toast.success('Employee profile updated')
      const { data } = await api.get(`/employees/${id}`)
      setEmployee(data)
      setHasExistingProof(!!data.hasIdProof)
      setProofFile(null)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveProof = async () => {
    if (!confirm('Remove the uploaded identification proof image?')) return
    setRemovingProof(true)
    try {
      await api.delete(`/employees/${id}/id-proof`)
      setExistingProofUrl(null)
      setHasExistingProof(false)
      toast.success('Identification proof removed')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove proof')
    } finally {
      setRemovingProof(false)
    }
  }

  const handleResetPayrollPin = async () => {
    if (!confirm("Reset this employee's Payroll PIN? They'll be asked to create a new one next time they open Payroll.")) return
    setResettingPin(true)
    try {
      await api.post(`/employees/${id}/payroll-pin/reset`)
      setEmployee((prev) => prev ? { ...prev, hasPayrollPin: false } : prev)
      toast.success('Payroll PIN reset')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset PIN')
    } finally {
      setResettingPin(false)
    }
  }

  if (loading || !employee) {
    return (
      <div className="emp-page">
        <ProfileSkeleton />
      </div>
    )
  }

  return (
    <div className="emp-page">
      <div className="emp-page-header">
        <div>
          <div className="mb-2"><BackButton fallback="/employees" /></div>
          <h1 className="emp-page-title">{employee.username}</h1>
          <div className="emp-page-meta">
            <span className="id-badge"><IdIcon />{employee.employeeId}</span>
            <span className="emp-desg-tag" style={{ marginLeft: '.5rem' }}>{employee.designation || 'No designation'}</span>
          </div>
        </div>
        <div className="emp-header-actions">
          <button className={`btn btn-sm ${employee.isActive === false ? 'btn-danger' : 'btn-success'}`}>
            {employee.isActive === false ? 'Inactive' : 'Active'}
          </button>
        </div>
      </div>

      <div className="profile-shell">
        <section className="profile-card profile-hero">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">
              {employee.username?.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'EM'}
            </div>
            <div>
              <h2>{employee.username}</h2>
              <p>{employee.designation || 'Employee'}</p>
              <div className="profile-metrics">
                <div>
                  <strong>₹{Number(employee.salary || 0).toLocaleString()}</strong>
                  <span>Salary</span>
                </div>
                <div>
                  <strong>{employee.contact}</strong>
                  <span>Phone</span>
                </div>
                <div>
                  <strong>{employee.email || '—'}</strong>
                  <span>Email</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-card profile-tabs">
          <div className="profile-tab-list">
            <button className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
            <button className={`profile-tab ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>Attendance</button>
            <button className={`profile-tab ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>Schedule</button>
            <button className={`profile-tab ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>Edit Profile</button>
            <button className={`profile-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>Documents</button>
          </div>

          {activeTab === 'overview' && (
            <div className="profile-grid">
              <div className="profile-panel">
                <h3>Personal info</h3>
                <div className="profile-info-row"><span>Employee ID</span><strong>{employee.employeeId}</strong></div>
                <div className="profile-info-row"><span>Name</span><strong>{employee.username}</strong></div>
                <div className="profile-info-row"><span>Phone</span><strong>{employee.contact}</strong></div>
                <div className="profile-info-row"><span>Email</span><strong>{employee.email || '—'}</strong></div>
              </div>
              <div className="profile-panel">
                <h3>Employment details</h3>
                <div className="profile-info-row"><span>Designation</span><strong>{employee.designation || '—'}</strong></div>
                <div className="profile-info-row"><span>Salary</span><strong>₹{Number(employee.salary || 0).toLocaleString()}</strong></div>
                <div className="profile-info-row"><span>Salary type</span><strong>{employee.salaryType === 'daily' ? 'Daily' : 'Monthly'}</strong></div>
                <div className="profile-info-row"><span>Status</span><strong>{employee.isActive === false ? 'Inactive' : 'Active'}</strong></div>
              </div>
              <div className="profile-panel">
                <h3>Payroll summary</h3>
                {payrollLoading ? (
                  <div className="profile-info-row"><span>Payroll</span><strong>Loading...</strong></div>
                ) : payrollError ? (
                  <div className="profile-info-row"><span>Payroll</span><strong>{payrollError}</strong></div>
                ) : payrollStats ? (
                  <>
                    <div className="profile-info-row"><span>Month</span><strong>{MONTHS[Number(payrollStats.month?.split('-')[1] || '1') - 1]} {payrollStats.month?.split('-')[0]}</strong></div>
                    <div className="profile-info-row"><span>Total present</span><strong>{payrollStats.totalPresent ?? 0}</strong></div>
                    <div className="profile-info-row"><span>Estimated salary</span><strong>₹{Number(payrollStats.estimatedSalary || 0).toLocaleString()}</strong></div>
                    <div className="profile-info-row"><span>Overtime/PP pay</span><strong>₹{Number(payrollStats.overtime || 0).toLocaleString()}</strong></div>
                    <div className="profile-info-row"><span>Deductions/advances</span><strong>₹{Number(payrollStats.deductions || 0).toLocaleString()}</strong></div>
                    <div className="profile-info-row"><span>Net pay</span><strong>₹{Number(payrollStats.net || 0).toLocaleString()}</strong></div>
                  </>
                ) : (
                  <div className="profile-info-row"><span>Payroll</span><strong>No payroll data yet</strong></div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="profile-panel fade-in">
              <h3>Monthly attendance calendar</h3>
              <AttendanceCalendar employeeId={id} adminMode />
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="profile-panel fade-in">
              <h3>Weekend schedule</h3>
              <EmployeeScheduleTab employeeId={id} />
            </div>
          )}

          {activeTab === 'edit' && (
            <form className="profile-form" onSubmit={handleSubmit}>
              <div className="form-grid-2">
                <label className="form-group">
                  <span>Full name</span>
                  <input className="input" value={form.username} onChange={handleChange('username')} required />
                </label>
                <label className="form-group">
                  <span>Employee ID</span>
                  <input className="input" value={form.employeeId} onChange={handleChange('employeeId')} required readOnly />
                </label>
              </div>
              <div className="form-grid-2">
                <label className="form-group">
                  <span>Phone number</span>
                  <input className="input" value={form.contact} onChange={handleChange('contact')} required />
                </label>
                <label className="form-group">
                  <span>Email</span>
                  <input className="input" type="email" value={form.email} onChange={handleChange('email')} />
                </label>
              </div>
              <div className="form-grid-2">
                <label className="form-group">
                  <span>Designation</span>
                  <input className="input" value={form.designation} onChange={handleChange('designation')} />
                </label>
                <label className="form-group">
                  <span>Salary</span>
                  <input className="input" type="number" min="0" value={form.salary} onChange={handleChange('salary')} />
                </label>
              </div>
              <div className="form-grid-2">
                <label className="form-group">
                  <span>Salary type</span>
                  <select className="input" value={form.salaryType} onChange={handleChange('salaryType')}>
                    <option value="monthly">Monthly</option>
                    <option value="daily">Daily</option>
                  </select>
                </label>
                <label className="form-group">
                  <span>Status</span>
                  <select className="input" value={String(form.isActive)} onChange={handleChange('isActive')}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
              </div>
              <label className="form-group">
                <span>New password</span>
                <input className="input" type="password" value={form.password} onChange={handleChange('password')} placeholder={employee.hasPassword ? 'Leave blank to keep current password' : 'Set a login password'} />
              </label>
              <div className="form-group">
                <span>Payroll PIN</span>
                <div className="flex items-center gap-2" style={{ marginTop: '0.35rem' }}>
                  <span className="text-sm text-2">
                    {employee.hasPayrollPin ? 'A PIN is set for viewing Payroll.' : 'Not set up yet — the employee will be prompted on their first Payroll visit.'}
                  </span>
                  {employee.hasPayrollPin && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetPayrollPin} disabled={resettingPin}>
                      {resettingPin ? <span className="spinner" /> : 'Reset PIN'}
                    </button>
                  )}
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Save changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'documents' && (
            <div className="profile-docs">
              <div className="profile-doc-card">
                <div className="profile-doc-title">Identification proof</div>
                <div className="profile-doc-preview-wrap">
                  {previewUrl ? (
                    <img className="profile-doc-preview" src={previewUrl} alt="Identification proof" />
                  ) : (
                    <div className="profile-doc-placeholder">No uploaded image yet</div>
                  )}
                </div>
                <div className="profile-doc-actions">
                  <label className="btn btn-secondary btn-sm">
                    {previewUrl ? 'Replace image' : 'Upload image'}
                    <input type="file" accept="image/*" hidden onChange={(event) => setProofFile(event.target.files?.[0] || null)} />
                  </label>
                  {hasExistingProof && !proofFile && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={handleRemoveProof} disabled={removingProof}>
                      {removingProof ? <span className="spinner" /> : 'Remove image'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="employee-page-url">
            <span>Go to Employee's Login Page:
              <Link to={import.meta.env.VITE_USER_LOGIN_PAGE} target="_blank" rel="noopener noreferrer">
                Employee Login
              </Link>   
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}

function IdIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  )
}
