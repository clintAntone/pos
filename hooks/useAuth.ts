
import { useState, useEffect, useCallback } from 'react';
import { AuthState, UserRole } from '../types';
import { SESSION_TIMEOUT_MS } from '../constants';
import { playSound } from '../lib/audio';

const AUTH_STORAGE_KEY = 'hilot_core_session_v4';

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!saved) return { user: null };
      const parsed = JSON.parse(saved);
      if (!parsed.user || !parsed.user.lastActive) return { user: null };
      const now = Date.now();
      if (now - parsed.user.lastActive > SESSION_TIMEOUT_MS) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return { user: null };
      }
      // Ensure sessionStart exists for migrated sessions
      if (!parsed.user.sessionStart) {
        parsed.user.sessionStart = parsed.user.lastActive;
      }
      return parsed;
    } catch (err) {
      return { user: null };
    }
  });

  const [previousBranchId, setPreviousBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (auth.user) {
      const { loginPin, ...userWithoutPin } = auth.user;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: userWithoutPin }));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [auth]);

  const refreshSession = useCallback(() => {
    if (!auth.user) return;
    const now = Date.now();
    if (now - auth.user.lastActive > 60000) {
      setAuth(prev => {
        if (!prev.user) return prev;
        return { user: { ...prev.user, lastActive: now } };
      });
    }
  }, [auth.user]);

  useEffect(() => {
    if (!auth.user) return;
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => refreshSession();
    activityEvents.forEach(event => window.addEventListener(event, handleActivity));
    const interval = setInterval(() => {
      const now = Date.now();
      if (auth.user && now - auth.user.lastActive > SESSION_TIMEOUT_MS) {
        setAuth({ user: null });
        playSound('warning');
      }
    }, 60000);
    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, handleActivity));
      clearInterval(interval);
    };
  }, [auth.user, refreshSession]);

  const handleLogin = (role: UserRole, branchId?: string, pin?: string, employeeId?: string, username?: string) => {
    setPreviousBranchId(null);
    const now = Date.now();
    setAuth({ user: { role, branchId, employeeId, username, lastActive: now, sessionStart: now, loginPin: pin } });
  };

  const handleLogout = useCallback(() => {
    playSound('success');
    setAuth({ user: null });
    setPreviousBranchId(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.history.replaceState({ root: true }, '');
  }, []);

  const handleSwitchBranch = (branchId: string) => {
    if (auth.user?.branchId) {
      setPreviousBranchId(auth.user.branchId);
    }
    setAuth(prev => {
        if (!prev.user) return prev;
        const now = Date.now();
        return { user: { ...prev.user, branchId, lastActive: now, sessionStart: now, loginPin: undefined } };
    });
    window.scrollTo(0,0);
  };

  return {
    auth,
    setAuth,
    previousBranchId,
    setPreviousBranchId,
    handleLogin,
    handleLogout,
    handleSwitchBranch
  };
};
