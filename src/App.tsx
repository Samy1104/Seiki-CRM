import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './views/Login';
import { Pipeline } from './views/Pipeline';
import { Leads } from './views/Leads';
import { AddLead } from './views/AddLead';
import { Tasks } from './views/Tasks';
import { Agenda } from './views/Agenda';
import { Stats } from './views/Stats';
import { Codir } from './views/Codir';
import { Settings } from './views/Settings';
import './App.css';
import { Portal } from './views/Portal';
import { Contenu } from './views/Contenu';

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [currentView, setView] = useState<string>('pipeline');
  const [activeApp, setActiveApp] = useState<'portal' | 'crm' | 'contenu'>('portal');

  React.useEffect(() => {
    if (isAuthenticated) {
      setActiveApp('portal');
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Démarrage de Seiki CRM...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (activeApp === 'portal') {
    return <Portal setActiveApp={setActiveApp} />;
  }

  if (activeApp === 'contenu') {
    return <Contenu setActiveApp={setActiveApp} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <Sidebar section="crm" currentView={currentView} setView={setView} setActiveApp={setActiveApp} />

      {/* Main workspace area */}
      <main className="main-content">
        <ErrorBoundary key={currentView}>
          {currentView === 'pipeline' && <Pipeline setView={setView} />}
          {currentView === 'leads' && <Leads setView={setView} />}
          {currentView === 'add' && <AddLead setView={setView} />}
          {currentView === 'tasks' && <Tasks />}
          {currentView === 'agenda' && <Agenda />}
          {currentView === 'stats' && <Stats />}
          {currentView === 'codir' && <Codir />}
          {currentView === 'settings' && <Settings />}
        </ErrorBoundary>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
