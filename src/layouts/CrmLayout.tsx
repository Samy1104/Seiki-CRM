import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ErrorBoundary } from '../components/ErrorBoundary';

export const CrmLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="app-container">
      <Sidebar section="crm" />
      <main className="main-content">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};
