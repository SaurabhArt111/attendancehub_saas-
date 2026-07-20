import { Link } from 'react-router-dom'
import './SettingsPage.css'

export default function PrivacyPolicyPage() {
  const sections = [
    {
      title: 'What We Collect',
      items: [
        { q: 'Company & Admin Details', a: 'Company name, company code, admin username, contact number, and email address supplied at registration.' },
        { q: 'Employee Records', a: 'Employee name, system-generated Employee ID, mobile number, email (optional), designation, and salary — entered by your company\'s admin.' },
        { q: 'Attendance Data', a: 'Daily attendance status (Present, Absent, Double Shift), optional remarks, and holiday records maintained by your admin.' },
        { q: 'Identification Proof Images', a: 'If an admin chooses to upload an identification proof image for an employee, it is compressed and stored securely against that employee\'s record.' },
        { q: 'Device & Session Info', a: 'Basic device and session metadata (like browser/device type and login timestamps) used to secure admin and employee logins.' },
      ]
    },
    {
      title: 'How We Use It',
      items: [
        { q: 'Attendance & Payroll', a: 'Attendance and salary data is used purely to calculate presence, absences, and estimated salary for your company\'s own reports.' },
        { q: 'Account Access', a: 'Login credentials are used only to authenticate admins and employees into their respective portals.' },
        { q: 'Communication', a: 'Contact details may be used to reach an admin about their account, never for marketing to third parties.' },
      ]
    },
    {
      title: 'Data Storage & Security',
      items: [
        { q: 'Company-Scoped Data', a: 'Every employee, attendance, and holiday record is scoped strictly to the company that created it — no cross-company access is possible.' },
        { q: 'Password Security', a: 'Admin and employee passwords are hashed before storage; AttendanceHub never stores or displays raw passwords.' },
        { q: 'Identification Proof Handling', a: 'Uploaded ID proof images are compressed in memory and saved directly to the database — the original uploaded file is never written to disk.' },
        { q: 'Data Retention', a: 'Archived employees and their attendance history are retained until an admin explicitly and permanently deletes them.' },
      ]
    },
    {
      title: 'Your Choices',
      items: [
        { q: 'Access & Correction', a: 'Admins can view, edit, or archive employee records at any time from the Employees page.' },
        { q: 'Removing Identification Proof', a: 'An uploaded identification proof image can be removed at any time from an employee\'s profile.' },
        { q: 'Account Deletion', a: 'Permanently deleting an archived employee also removes all of their attendance records.' },
      ]
    },
    {
      title: 'Contact',
      items: [
        { q: 'Questions About This Policy', a: 'If you have questions about how your data is handled, please reach out to your company\'s AttendanceHub administrator.' },
      ]
    },
  ]

  return (
    <section className="about-page">
      <h1 className="font-700 mb-4" style={{ fontSize: '1.1rem' }}>Privacy Policy</h1>
      <div className="about-container">
        <div className="about-hero card">
          <div className="about-logo">AttendanceHub</div>
          <div className="text-sm text-2 mt-1">
            How AttendanceHub collects, uses, and protects company and employee data.
          </div>
          <div className="text-xs text-2 mt-1">Last updated: July 2026</div>
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

        <div className="text-sm text-2" style={{ textAlign: 'center' }}>
          <Link to="/about" className="footer-link">About AttendanceHub</Link>
        </div>
      </div>
    </section>
  )
}
