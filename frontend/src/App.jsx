import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './utils/api';
import useIdleTimeout from './hooks/useIdleTimeout';
import IdleWarningModal from './components/IdleWarningModal';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LoeManager from './pages/LoeManager';
import LoeDetails from './pages/LoeDetails';
import ClientLoeApproval from './pages/ClientLoeApproval';
import ManagerDashboard from './pages/ManagerDashboard';
import ServiceManager from './pages/ServiceManager';
import CompanyManager from './pages/CompanyManager';
import TaskAllocation from './pages/TaskAllocation';
import EmployeeManager from './pages/EmployeeManager';
import InvoiceManager from './pages/InvoiceManager';
import DispatchTracker from './pages/DispatchTracker';
import Settings from './pages/Settings';
import AccessControl from './pages/AccessControl';
import PettyCashManager from './pages/PettyCashManager';

// Safe helper to decode JWT payload without external library dependencies
const decodeJwtPayload = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonStr);
  } catch (e) {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }
};

/**
 * Validates whether the client has an active, valid authentication token and user profile
 */
export const isAuthenticated = () => {
  try {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr || token === 'undefined' || token === 'null' || userStr === 'undefined' || userStr === 'null') {
      return false;
    }

    // Verify token expiry if payload contains exp
    const payload = decodeJwtPayload(token);
    if (!payload) {
      return false;
    }

    if (payload.exp && typeof payload.exp === 'number') {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (nowInSeconds >= payload.exp) {
        return false;
      }
    }

    const user = JSON.parse(userStr);
    if (!user || (!user.emp_id && !user.id && !user.email)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Route guard that requires active authentication.
 * If user is not authenticated (e.g. visiting URL from another browser or new session),
 * it redirects immediately to the /login page.
 */
export const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const authed = isAuthenticated();

  if (!authed) {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (_) {}
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * Route guard for public-only pages like Login and Register.
 * If an already authenticated user visits /login, redirect to /dashboard.
 */
export const PublicRoute = ({ children }) => {
  const authed = isAuthenticated();
  if (authed) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

/**
 * Mounts the 30-minute sliding idle timeout tracker & 1-minute warning modal
 * strictly while a user is authenticated.
 */
function IdleSessionManager() {
  useLocation(); // Re-evaluate authentication state on route transitions
  const authed = isAuthenticated();
  const {
    showWarning,
    remainingSeconds,
    stayingSignedIn,
    staySignedIn,
    logoutNow
  } = useIdleTimeout({ enabled: authed });

  if (!authed) return null;

  return (
    <IdleWarningModal
      isOpen={showWarning}
      remainingSeconds={remainingSeconds}
      stayingSignedIn={stayingSignedIn}
      onStaySignedIn={staySignedIn}
      onLogoutNow={logoutNow}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <IdleSessionManager />
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated() ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loes"
          element={
            <ProtectedRoute>
              <LoeManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loes/:id"
          element={
            <ProtectedRoute>
              <LoeDetails />
            </ProtectedRoute>
          }
        />
        {/* Client approval proposal accessed by client signers without employee login */}
        <Route path="/loes/:id/client-approval" element={<ClientLoeApproval />} />
        <Route
          path="/approvals"
          element={
            <ProtectedRoute>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <TaskAllocation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/petty-cash"
          element={
            <ProtectedRoute>
              <PettyCashManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <ProtectedRoute>
              <InvoiceManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <EmployeeManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/services"
          element={
            <ProtectedRoute>
              <ServiceManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies"
          element={
            <ProtectedRoute>
              <CompanyManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispatch"
          element={
            <ProtectedRoute>
              <DispatchTracker />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/access-control"
          element={
            <ProtectedRoute>
              <AccessControl />
            </ProtectedRoute>
          }
        />
        <Route
          path="/permissions"
          element={
            <ProtectedRoute>
              <AccessControl />
            </ProtectedRoute>
          }
        />
        {/* Wildcard redirect */}
        <Route
          path="*"
          element={
            isAuthenticated() ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
