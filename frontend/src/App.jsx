import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LoeManager from './pages/LoeManager';
import ManagerDashboard from './pages/ManagerDashboard';
import ServiceManager from './pages/ServiceManager';
import CompanyManager from './pages/CompanyManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/loes" element={<LoeManager />} />
        <Route path="/approvals" element={<ManagerDashboard />} />
        <Route path="/services" element={<ServiceManager />} />
        <Route path="/companies" element={<CompanyManager />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;