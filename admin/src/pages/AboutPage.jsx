import './SettingsPage.css'

export default function AboutPage() {

  const sections = [
    {
      title: 'Getting Started',
      items: [
        { q: 'Register Your Company', a: 'Create your company account with a name, contact, email, and password. You will receive a unique Company Code to sign in.' },
        { q: 'Set Up Admin Account', a: 'After registration, set up the primary admin account with a username and password. This admin manages employees, attendance, and reports.' },
        { q: 'Create Designations', a: 'Add job titles in Designations first. Employees are assigned roles from this list so attendance records stay consistent.' },
      ]
    },
    {
      title: 'Managing Attendance',
      items: [
        { q: 'Mark Attendance', a: 'Use the attendance calendar to mark Present, Absent, or Double Shift for any employee on any date.' },
        { q: 'Attendance Status Types', a: 'P = Present, A = Absent, PP = Double Shift. Salary is calculated from monthly salary and selected month days.' },
        { q: 'Add Remarks', a: 'Add a remark to any attendance day for notes like advances, penalties, or special work details.' },
      ]
    },
    {
      title: 'Reports & Export',
      items: [
        { q: 'Monthly Reports', a: 'View full monthly attendance reports with total present, absent, double shifts, and estimated salary.' },
        { q: 'CSV Export', a: 'Export reports as a CSV file for payroll or record keeping.' },
      ]
    },
    {
      title: 'Employee Access',
      items: [
        { q: 'Employee Login', a: 'Employees use their Employee ID and password to sign in to the employee portal. Admins manage credentials.' },
        { q: 'Profile Access', a: 'Employees can see their attendance calendar and profile but cannot edit other users or attendance data.' },
      ]
    },
  ]

  return (
    <section className="about-page">
      <h1 className="font-700 mb-4" style={{ fontSize: '1.1rem' }}>About AttendanceHub</h1>
      <div className="about-container">
        <div className="about-hero card">
          <div className="about-logo">AttendanceHub</div>
          <div className="text-sm text-2 mt-1">Workforce attendance management made simple.</div>
        </div>

        {sections.map(section => (
          <div key={section.title} className="card about-section">
            <div className="about-section-title">{section.title}</div>
            {section.items.map((item, index) => (
              <div key={index} className="about-item">
                <div className="about-item-q">{item.q}</div>
                <div className="about-item-a">{item.a}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

