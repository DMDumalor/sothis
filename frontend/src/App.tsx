import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { ActivateAccountPage } from '@/pages/ActivateAccountPage';
import { HomePage } from '@/pages/HomePage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { useBootstrapAuth } from '@/hooks/use-bootstrap-auth';
import { EmployeeDirectoryPage } from '@/pages/employees/EmployeeDirectoryPage';
import { EmployeeProfilePage } from '@/pages/employees/EmployeeProfilePage';
import { MyProfileRedirect } from '@/pages/employees/MyProfileRedirect';
import { DepartmentsPage } from '@/pages/departments/DepartmentsPage';
import { PositionsPage } from '@/pages/positions/PositionsPage';
import { LeavePage } from '@/pages/leave/LeavePage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';
import { OvertimePage } from '@/pages/overtime/OvertimePage';
import { PayrollPage } from '@/pages/payroll/PayrollPage';
import { PayrollPeriodDetailPage } from '@/pages/payroll/PayrollPeriodDetailPage';
import { PaymentsPage } from '@/pages/payroll/PaymentsPage';
import { PayslipsPage } from '@/pages/payroll/PayslipsPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SecurityCenterPage } from '@/pages/security/SecurityCenterPage';
import { IntelligencePage } from '@/pages/intelligence/IntelligencePage';

function App() {
  useBootstrapAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activate" element={<ActivateAccountPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />

            {/* People (M2): HR/Admin see the full directory, a Department
                Head's "My Team" link reuses the same page (the backend
                narrows results to their department), and an Employee's
                "My Profile" link resolves to their own record. */}
            <Route path="/employees" element={<EmployeeDirectoryPage />} />
            <Route path="/employees/:id" element={<EmployeeProfilePage />} />
            <Route path="/team" element={<EmployeeDirectoryPage />} />
            <Route path="/profile" element={<MyProfileRedirect />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/positions" element={<PositionsPage />} />

            {/* Time (M3): the same LeavePage adapts by role — an Employee's
                "Leave" link shows their balances/history + a request form,
                while a Department Head's/HR's "Leave"/"Leave Approvals" link
                (same component) additionally shows the approvals queue the
                backend scopes to their department/tenant. */}
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/leave/approvals" element={<LeavePage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/overtime" element={<OvertimePage />} />

            {/* Finance (M4): PAYROLL_READ (Finance/DG) gates the list and
                detail pages server-side; PAYROLL_PROCESS/REVIEW/APPROVE
                further gate the mutating actions rendered inside them.
                PAYSLIP_READ is OWN-scoped for Employee and TENANT-scoped
                for Finance, so PayslipsPage renders differently per role
                but the backend is what actually enforces the boundary. */}
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/payroll/:id" element={<PayrollPeriodDetailPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/payslips" element={<PayslipsPage />} />

            {/* Insight & security (M5): REPORT_READ (TENANT for
                ADMIN/HR/FINANCE/DG, DEPARTMENT for Department Head) gates
                reports server-side; SMART_INSIGHT_READ/REVIEW gate the
                intelligence engine's list/review actions; SECURITY_READ/
                AUDIT_READ (ADMIN/DG only) gate the security center. Every
                page renders differently by role but the backend — not
                nav-config — is what actually enforces each boundary. */}
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/intelligence" element={<IntelligencePage />} />
            <Route path="/security" element={<SecurityCenterPage />} />

            {/* Remaining feature routes (DG-specific executive dashboard
                widgets beyond HomePage, admin console for Users/Roles/
                Organization) are added milestone by milestone per the
                architecture plan, each as a full vertical slice rather
                than an empty page. */}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
