import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './admin/AuthContext';
import { useAuth } from './admin/AuthContext';
import LoginPage from './admin/LoginPage';
import RegisterPage from './admin/RegisterPage';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import InstitutionsPage from './admin/InstitutionsPage';
import CronJobsAdminPage from './admin/CronJobsAdminPage';
import ActivationCodesPage from './admin/ActivationCodesPage';
import AttendanceSummaryPage from './admin/AttendanceSummaryPage';
import StudentManagementPage from './admin/StudentManagementPage';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Makeup from './pages/Makeup';
import CampusManagement from './pages/CampusManagement';
import RobotStatus from './pages/RobotStatus';
import CronJobs from './pages/CronJobs';
import DevHome from './pages/DevHome';
import { isDevMode } from './lib/mock';

// Protected route wrapper for admin
function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Dev mode landing page */}
          {isDevMode && <Route path="/" element={<DevHome />} />}
          {!isDevMode && <Route path="/" element={<Navigate to="/dashboard" replace />} />}

          {/* User-facing pages (H5) */}
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/makeup" element={<Makeup />} />
          <Route path="/campus" element={<CampusManagement />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/robot-status" element={<RobotStatus />} />
          <Route path="/cron-jobs" element={<CronJobs />} />

          {/* Admin pages */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/register" element={<RegisterPage />} />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/institutions"
            element={
              <AdminProtectedRoute>
                <InstitutionsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/cron"
            element={
              <AdminProtectedRoute>
                <CronJobsAdminPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/activation"
            element={
              <AdminProtectedRoute>
                <ActivationCodesPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance-summary"
            element={
              <AdminProtectedRoute>
                <AttendanceSummaryPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/students"
            element={
              <AdminProtectedRoute>
                <StudentManagementPage />
              </AdminProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
