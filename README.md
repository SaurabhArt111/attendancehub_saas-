# AttendanceHub

AttendanceHub is a full-stack web application designed to streamline the management of employee attendance, company records, and payroll data. It consists of a modular backend API, a user-facing portal, and an administrator dashboard.

## 🚀 Getting Started: Setup Guide

The application is split into three separate components and requires a Node.js environment.

### 1. Installation Steps

**Prerequisites:** Node.js and npm/yarn must be installed.

1.  **Install Dependencies:** Navigate to each component directory and run the appropriate installation command.

    *   **Backend API (`backend/`):**
        ```bash
        cd backend
        npm install
        ```
    *   **User Frontend (`user/`):**
        ```bash
        cd user
        npm install
        ```
    *   **Admin Dashboard (`admin/`):**
        ```bash
        cd admin
        npm install
        ```

2.  **Environment Variables:** Create a `.env` file in the **`backend/`** directory and populate the following required secrets:

    *   `MONGO_URI`: The connection string for the MongoDB database.
    *   `JWT_SECRET`: A secure, strong secret key used for signing JSON Web Tokens (JWT) for authentication.

### 2. Running the Application

Due to the decoupled nature, each service must be started independently.

| Component | Directory | Development Command | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend API** | `backend/` | `npm run dev` | Runs the core API, manages data, and handles business logic. |
| **User Portal** | `user/` | `npm run dev` | The employee-facing application for checking and logging daily attendance. |
| **Admin Dashboard** | `admin/` | `npm run dev` | The administrative interface for bulk updates, reporting, and user management. |

### 💡 Key Technical Details

*   **Architecture:** Client-Server (React/Vite $\to$ Node.js/Express).
*   **Database Schema:** Attendance records are stored monthly (`{companyId}-{year-month}`). Daily status is tracked within a document map.
*   **Security:** Role-Based Access Control (RBAC) is enforced via JWTs. Admins can perform bulk actions; standard employees are restricted to viewing their own records.