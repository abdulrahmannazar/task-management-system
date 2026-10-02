import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LoeManager from './pages/LoeManager';
import LoeDetails from './pages/LoeDetails';
import ManagerDashboard from './pages/ManagerDashboard';
import ServiceManager from './pages/ServiceManager';
import CompanyManager from './pages/CompanyManager';
import TaskAllocation from './pages/TaskAllocation';
import EmployeeManager from './pages/EmployeeManager';
import InvoiceManager from './pages/InvoiceManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/loes" element={<LoeManager />} />
        <Route path="/loes/:id" element={<LoeDetails />} />
        <Route path="/approvals" element={<ManagerDashboard />} />
        <Route path="/tasks" element={<TaskAllocation />} />
        <Route path="/invoices" element={<InvoiceManager />} />
        <Route path="/employees" element={<EmployeeManager />} />
        <Route path="/services" element={<ServiceManager />} />
        <Route path="/companies" element={<CompanyManager />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;