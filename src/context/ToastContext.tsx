import React, { createContext, useContext, useRef, useState } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const nextId = useRef(0);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++nextId.current;
    setToast({ id, message, type });
    setTimeout(() => {
      // Only dismiss if this is still the toast we scheduled — an older
      // timer must not clear a newer toast that replaced it in the meantime.
      setToast((current) => (current?.id === id ? null : current));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
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
