import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Early Password bypass matching the prototype
  const SEIKI_PWD_EARLY = '5314120262030';

  useEffect(() => {
    // Check if authenticated in session storage (fallback)
    const isAuthSession = sessionStorage.getItem('seiki_auth') === '1';
    if (isAuthSession) {
      setIsAuthenticated(true);
      setUser({
        id: '11111111-1111-1111-1111-111111111111',
        full_name: 'Administrateur Seiki',
        email: 'admin@seiki.com',
        avatar_url: null
      });
    }
    setLoading(false);
  }, []);

  const login = async (password: string): Promise<boolean> => {
    if (password === SEIKI_PWD_EARLY) {
      sessionStorage.setItem('seiki_auth', '1');
      setIsAuthenticated(true);
      setUser({
        id: '11111111-1111-1111-1111-111111111111',
        full_name: 'Administrateur Seiki',
        email: 'admin@seiki.com',
        avatar_url: null
      });
      return true;
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem('seiki_auth');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
