import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CrmLayout } from './layouts/CrmLayout';
import { ContenuLayout } from './layouts/ContenuLayout';
import { Login } from './views/Login';
import { Portal } from './views/Portal';
import { Pipeline } from './views/Pipeline';
import { Leads } from './views/Leads';
import { AddLead } from './views/AddLead';
import { Tasks } from './views/Tasks';
import { Agenda } from './views/Agenda';
import { Stats } from './views/Stats';
import { Codir } from './views/Codir';
import { Settings } from './views/Settings';
import { Contenu } from './views/Contenu';
import { Prospection } from './views/Prospection';
import './App.css';

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const goToCrmView = (view: string) => navigate(`/crm/${view}`);

  return (
    <Routes>
      {/* Public Route */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/portal" replace /> : <Login />}
      />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/portal" replace />} />
        <Route path="/portal" element={<Portal />} />

        {/* CRM Section with CrmLayout */}
        <Route path="/crm" element={<CrmLayout />}>
          <Route index element={<Navigate to="/crm/pipeline" replace />} />
          <Route path="pipeline" element={<Pipeline setView={goToCrmView} />} />
          <Route path="leads" element={<Leads setView={goToCrmView} />} />
          <Route path="add" element={<AddLead setView={goToCrmView} />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="stats" element={<Stats />} />
          <Route path="codir" element={<Codir />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Contenu Section with ContenuLayout */}
        <Route path="/contenu" element={<ContenuLayout />}>
          <Route index element={<Navigate to="/contenu/linkedin" replace />} />
          <Route path="linkedin" element={<Contenu />} />
          <Route path="prospection" element={<Prospection />} />
        </Route>
      </Route>

      {/* Fallback Catch-all Route */}
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
