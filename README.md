# AttendanceHub SaaS

Multi-tenant attendance management system.

```
AttendanceHub-SaaS/
├── backend/   Node.js + Express + MongoDB
├── admin/     React (Vite) — Company + Admin portal  [port 5901]
└── user/      React (Vite) — Employee portal         [port 5902]
```

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set MONGO_URI to your MongoDB connection string
npm install
npm start
```

Backend runs on **http://localhost:5900**

### 2. Admin App

```bash
cd admin
npm install
npm run dev
```

Open **http://localhost:5901**

### 3. User App

```bash
cd user
npm install
npm run dev
```

Open **http://localhost:5902**

---

## Onboarding Flow

### New Company

1. Go to `/register` in the Admin app
2. Fill company name, contact, password
3. System generates a unique **Company Code** (e.g. `ACME1234`) — save it
4. You are redirected to set up the **Primary Admin account**
5. After admin setup, you land on the dashboard

### Admin Login

- Go to `/login` in the Admin app
- Enter Company Code + Admin Username/ID + Password

### Employee Login

- Go to the User app (`http://localhost:5902`)
- Enter Company Code + Employee Username/ID + Password
- Employees **cannot** access the Admin app

---

## Attendance Status Codes

| Code | Label   | Description            |
|------|---------|------------------------|
| P    | Present | Regular workday        |
| A    | Absent  | Absent                 |
| PP   | Double  | Double shift worked    |

---

## Data Isolation

Every company's data (employees, attendance, holidays) is scoped by `companyId` in MongoDB. Employees of one company cannot see or access data from another company.

## Security

- Passwords hashed with bcrypt
- JWT tokens scoped by role (`admin` vs `employee`)
- Admin routes reject employee tokens and vice versa
- Employee app does not expose any admin routes
