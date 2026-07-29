import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  useEffect(() => {
    if (!loading) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setShowOverlay(false);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  return (
    <>
      {showOverlay && (
        <div className={`app-launch-overlay ${isFadingOut ? 'fade-out' : ''}`}>
          <div className="app-launch-content">
            <img src="/logo_sans_ecriture.png" alt="Seiki CRM" className="app-launch-logo" />
            <div className="loading-spinner"></div>
            <div className="app-launch-text">Démarrage de Seiki CRM...</div>
          </div>
        </div>
      )}

      {!loading && (
        isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
      )}
    </>
  );
};
