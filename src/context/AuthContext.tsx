import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

export interface UserProfile {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  avatar_url: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_CACHE_KEY = 'seiki:authState';

interface CachedAuth {
  isAuthenticated: boolean;
  user: UserProfile | null;
}

/**
 * Supabase's own getSession() is async even when the token is already sitting
 * in localStorage, so every full page refresh forces at least one render of
 * the "Démarrage de Seiki CRM..." gate before it resolves. Caching the last
 * known auth result lets the protected UI render immediately on refresh,
 * while getSession() still runs in the background to catch a revoked/expired
 * session and correct the state.
 */
function loadCachedAuth(): CachedAuth | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedAuth) : null;
  } catch {
    return null;
  }
}

function persistAuth(next: CachedAuth): void {
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable/full — auth still works, just without the cached fast-path
  }
}

function clearCachedAuth(): void {
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    // ignore
  }
}

function toUserProfile(session: Session): UserProfile {
  const email = session.user.email ?? '';
  const meta = session.user.user_metadata ?? {};
  const firstName = (meta.first_name as string | undefined) ?? '';
  const lastName = (meta.last_name as string | undefined) ?? (meta.family_name as string | undefined) ?? '';
  const metaName = (meta.full_name as string | undefined) || [firstName, lastName].filter(Boolean).join(' ');

  return {
    id: session.user.id,
    full_name: metaName || email.split('@')[0] || 'Utilisateur',
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    email,
    avatar_url: (meta.avatar_url as string | undefined) ?? null,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cachedAuth = loadCachedAuth();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(cachedAuth?.isAuthenticated ?? false);
  const [user, setUser] = useState<UserProfile | null>(cachedAuth?.user ?? null);
  const [loading, setLoading] = useState<boolean>(!cachedAuth);

  const fetchUserProfile = async (session: Session): Promise<UserProfile> => {
    const fallbackProfile = toUserProfile(session);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, first_name, last_name, email, avatar_url')
        .or(`auth_id.eq.${session.user.id},email.eq.${fallbackProfile.email}`)
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          full_name: data.full_name || fallbackProfile.full_name,
          first_name: data.first_name || fallbackProfile.first_name,
          last_name: data.last_name || fallbackProfile.last_name,
          email: data.email || fallbackProfile.email,
          avatar_url: data.avatar_url || fallbackProfile.avatar_url,
        };
      }
    } catch (err) {
      console.error('Error fetching user profile from public.users:', err);
    }

    return fallbackProfile;
  };

  const loadUser = async (session: Session | null) => {
    if (!session) {
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
      clearCachedAuth();
      return;
    }
    setIsAuthenticated(true);
    const profile = await fetchUserProfile(session);
    setUser(profile);
    setLoading(false);
    persistAuth({ isAuthenticated: true, user: profile });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUser(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const logout = () => {
    supabase.auth.signOut();
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
