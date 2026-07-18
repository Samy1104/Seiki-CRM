import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const nextId = useRef(0);

  // Stable identity (useCallback + useMemo below) so components that list
  // showToast in a useEffect/useCallback dependency array don't re-run every
  // time any toast fires anywhere in the app — without this, showToast and
  // the context value were both new references on every ToastProvider
  // render, silently forcing extra re-fetches in any consumer depending on it.
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++nextId.current;
    setToast({ id, message, type });
    setTimeout(() => {
      // Only dismiss if this is still the toast we scheduled — an older
      // timer must not clear a newer toast that replaced it in the meantime.
      setToast((current) => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`toast-message toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
