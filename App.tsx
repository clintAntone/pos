import React, { Suspense, lazy, useState, useMemo, useEffect } from 'react';
import { UserRole } from './types';
import { UI_THEME } from './constants/ui_designs';
import Login from './components/Login';
import ProfileSetup from './components/PinChange';
import { useAuth } from './hooks/useAuth';
import { useGlobalData } from './hooks/useGlobalData';
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay';
import { supabase } from './lib/supabase';

// Dynamic Imports
const SuperAdminDashboard = lazy(() => import('./components/superadmin/SuperAdminDashboard'));
const BranchManagerDashboard = lazy(() => import('./components/BranchManagerDashboard'));

const App: React.FC = () => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isSupabaseConfigured = !!supabase;

  // Modular Auth Hub First
  const {
    auth, previousBranchId,
    handleLogin, handleLogout, handleSwitchBranch
  } = useAuth();

  // Pass actual auth state to Data Hub
  const {
    branches, transactions, expenses,
    attendance, employees, shiftLogs, salesReports, auditLogs,
    systemLogo, systemVersion, dynamicAppName, autoRefreshTime, fontFamily, isPaymongoEnabled, terminology, updateTerminology, loading, error, globalSync, setGlobalSync, forceLogoutRegistry, refreshDatabase
  } = useGlobalData(auth);

  // Derive identity from synchronized data
  const currentEmployee = useMemo(() =>
          auth.user?.employeeId ? employees.find(e => e.id === auth.user?.employeeId) : null
      , [auth.user?.employeeId, employees]);

  const currentBranch = useMemo(() =>
          auth.user?.branchId ? branches.find(b => b.id === auth.user?.branchId) : null
      , [auth.user?.branchId, branches]);

  // FORCE LOGOUT WATCHER: Monitor branch-level and global session invalidation
  useEffect(() => {
    if (auth.user) {
      const globalForceTime = forceLogoutRegistry['GLOBAL'] || 0;
      const branchForceTime = auth.user.branchId ? (forceLogoutRegistry[auth.user.branchId] || 0) : 0;

      const latestForceTime = Math.max(globalForceTime, branchForceTime);

      if (latestForceTime > auth.user.sessionStart) {
        console.log("⚠️ Security: Remote session termination triggered by SuperAdmin.");
        handleLogout();
      }
    }
  }, [auth.user, forceLogoutRegistry, handleLogout]);

  // BRANDING SYNC: Update browser tab title and favicon from system configuration
  useEffect(() => {
    if (dynamicAppName) {
      document.title = dynamicAppName;
    }
  }, [dynamicAppName]);

  // MOBILE BACK BUTTON BOOTSTRAP: Ensure we have a root state to return to
  useEffect(() => {
    if (window.history.state === null) {
      window.history.replaceState({ root: true }, '');
    }
  }, []);

  // HANDLE LOGOUT MODAL BACK BUTTON: Sync modal state with browser history
  useEffect(() => {
    if (showLogoutConfirm) {
      window.history.pushState({ modal: 'logout' }, '');
      const handlePopState = () => setShowLogoutConfirm(false);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showLogoutConfirm]);

  useEffect(() => {
    if (systemLogo) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = systemLogo;
      } else {
        // Fallback create if not exists
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = systemLogo;
        document.head.appendChild(link);
      }
    }
  }, [systemLogo]);

  // FONT SYNC: Apply global font family from system configuration
  useEffect(() => {
    if (fontFamily) {
      document.body.style.fontFamily = `'${fontFamily}', sans-serif`;

      // Also update tailwind config dynamically if possible, but body style is usually enough for inheritance
      // If we want to be thorough, we can inject a style tag
      const styleId = 'dynamic-font-style';
      let styleTag = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `
        body, button, input, select, textarea {
          font-family: '${fontFamily}', sans-serif !important;
        }
      `;
    }
  }, [fontFamily]);

  // SECURITY FIX: Explicitly reset UI state on identity change
  useEffect(() => {
    if (auth.user) {
      setShowLogoutConfirm(false);
    }
  }, [auth.user?.branchId, auth.user?.employeeId, auth.user?.role]);

  // WEBTONATIVE BACK BUTTON SYNC: Handle hardware back button behavior
  useEffect(() => {
    const handleBack = () => {
      // 1. If logout confirmation is visible, we let the popstate listener handle it
      // by calling history.back(), or we can handle it directly.
      // Since we added a popstate listener for showLogoutConfirm, calling back() is enough.

      // 2. If user is NOT logged in (Login Page), close the app
      if (!auth.user) {
        console.log("📱 WebToNative: Attempting to close app from Login page.");
        if ((window as any).webToNative?.closeApp) {
          (window as any).webToNative.closeApp();
        } else {
          console.warn("WebToNative bridge not found. App closure simulated.");
        }
        return;
      }

      // 3. If logged in, navigate back in history
      // This will trigger popstate listeners in sub-components (like BranchManagerDashboard tabs)
      // or the logout modal listener we just added.
      console.log("📱 WebToNative: Navigating back in history.");
      window.history.back();
    };

    // Register the hook for WebToNative
    (window as any).onBackPressed = handleBack;

    return () => {
      (window as any).onBackPressed = null;
    };
  }, [auth.user, showLogoutConfirm]);

  const handleCancelPinChange = () => {
    if (previousBranchId) {
      handleSwitchBranch(previousBranchId);
    } else {
      handleLogout();
    }
  };

  // Safe Logout Trigger: Prevents ghost clicks from 'Authorize' button tap-through
  const triggerLogoutConfirm = (e: React.MouseEvent) => {
    setShowLogoutConfirm(true);
  };

  const isRelief = useMemo(() => {
    if (!auth.user || auth.user.role === UserRole.SUPERADMIN || !currentBranch) return false;
    const sessionEmpName = currentEmployee?.name || '';
    return currentBranch.tempManager?.toUpperCase() === sessionEmpName.toUpperCase();
  }, [auth.user, currentBranch, currentEmployee]);

  const identityDisplay = useMemo(() => {
    if (!auth.user || auth.user.role === UserRole.SUPERADMIN) return 'SYSTEM ADMIN';
    if (!currentBranch) return 'NODE OPERATOR';

    const username = auth.user.username || 'NODE OPERATOR';
    const branchName = currentBranch?.name?.replace(/BRANCH - /i, '') || 'ACTIVE';

    return `${username.toUpperCase()} (MANAGER) @ ${branchName.toUpperCase()}`;
  }, [auth.user, currentBranch]);

  if (!isSupabaseConfigured) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-rose-100 p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Configuration Error</h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Supabase credentials are missing or invalid. Please check your environment variables in the settings.
              </p>
            </div>
            <div className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 text-left space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Required Variables:</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-[11px] font-mono text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  VITE_SUPABASE_URL
                </li>
                <li className="flex items-center gap-2 text-[11px] font-mono text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  VITE_SUPABASE_ANON_KEY
                </li>
              </ul>
            </div>
            <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest leading-relaxed">
              The application cannot initialize core systems without these credentials.
            </p>
          </div>
        </div>
    );
  }

  if (!auth.user) {
    if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 animate-pulse">Initializing Core...</p>
            </div>
          </div>
      );
    }
    return <Login onLogin={handleLogin} branches={branches} employees={employees} onlineUsers={{}} logo={systemLogo} version={systemVersion} appName={dynamicAppName} connectionError={error} />;
  }

  if (auth.user.role === UserRole.BRANCH_MANAGER) {
    if (!currentBranch || (auth.user.employeeId && !currentEmployee)) {
      const isReliefManager = auth.user.role === UserRole.BRANCH_MANAGER && employees.length > 0 && !currentEmployee;

      return (
          <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 z-[9999] overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#1e293b,transparent)] animate-pulse"></div>
            </div>

            <div className="w-full max-w-md space-y-10 relative z-10 text-center">
              <div className="relative inline-block group">
                <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-2xl group-hover:bg-emerald-500/30 transition-all duration-1000 animate-pulse"></div>
                <div className="w-24 h-24 bg-slate-900 rounded-[32px] flex items-center justify-center text-4xl shadow-2xl border border-white/10 relative transform hover:rotate-12 transition-transform duration-500">
                  {loading ? '🔐' : error ? '⚠️' : '👤'}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                  {loading ? 'SYNCING SECURE IDENTITY...' : error ? 'COMMUNICATION FAILURE' : 'IDENTITY VERIFICATION'}
                </h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] leading-relaxed">
                  {loading ? 'Establishing encrypted link with global registry' : error ? 'The secure channel was interrupted' : 'Validating credentials against branch node'}
                </p>
              </div>

              {/* Progress / Status */}
              <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 space-y-6 backdrop-blur-md">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">Registry Status</span>
                    <span className={loading ? "text-emerald-400 animate-pulse" : error ? "text-rose-400" : "text-emerald-400"}>
                    {loading ? "SYNCHRONIZING..." : error ? "OFFLINE" : "VERIFIED"}
                  </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${error ? 'bg-rose-500 w-full' : loading ? 'bg-emerald-500 w-2/3 animate-pulse' : 'bg-emerald-500 w-full'}`}></div>
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className={`w-1.5 h-1.5 rounded-full ${branches.length > 0 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                    Branch Registry: {branches.length > 0 ? 'LOADED' : 'WAITING...'}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className={`w-1.5 h-1.5 rounded-full ${employees.length > 0 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                    Personnel Data: {employees.length > 0 ? 'LOADED' : 'WAITING...'}
                  </div>
                  {isReliefManager && (
                      <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest leading-relaxed">
                          RELIEF MANAGER DETECTED: Your home branch profile is being mapped to this terminal.
                        </p>
                      </div>
                  )}
                  {error && (
                      <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                        <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-relaxed">
                          ERROR: {error instanceof Error ? error.message : 'Unknown connection error'}
                        </p>
                      </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                    onClick={() => refreshDatabase?.(true)}
                    disabled={loading}
                    className="w-full h-16 bg-white text-slate-950 font-black text-[11px] uppercase tracking-widest rounded-[24px] shadow-2xl hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                >
                  {loading ? 'SYNCING...' : 'RETRY SECURE SYNC'}
                </button>

                <button
                    onClick={handleLogout}
                    className="w-full py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                >
                  ABORT & LOGOUT
                </button>
              </div>
            </div>
          </div>
      );
    }
    if (!currentBranch.isPinChanged || (currentEmployee && (!currentEmployee.loginPin || currentEmployee.requestReset))) {
      return <ProfileSetup branch={currentBranch} employee={currentEmployee || undefined} providedPin={auth.user.loginPin} onSetupComplete={refreshDatabase as any} onCancel={handleCancelPinChange} />;
    }
  }

  return (
      <div className="min-h-screen w-full flex flex-col bg-slate-50">
        <GlobalLoadingOverlay isVisible={globalSync} />

        {showLogoutConfirm && (
            <div className={UI_THEME.layout.modalWrapper}>
              <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-10 text-center border border-slate-100 shadow-2xl animate-in zoom-in-95`}>
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </div>
                <h4 className="text-2xl font-bold text-slate-900 mb-2 uppercase tracking-tighter">Exit Terminal?</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Terminating encrypted connection.</p>
                <div className="flex flex-col gap-4 mt-10">
                  <button onClick={handleLogout} className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Confirm Logout</button>
                  <button onClick={() => window.history.back()} className="w-full text-slate-400 font-bold py-4 rounded-xl text-[12px] uppercase tracking-widest">Cancel</button>
                </div>
              </div>
            </div>
        )}

        <header className="sticky top-0 left-0 right-0 z-[1000] h-[72px] sm:h-20 bg-emerald-700 text-white shadow-lg no-print w-full">
          <div className={`${UI_THEME.layout.maxContent} ${UI_THEME.layout.mainPadding} h-full flex items-center justify-between`}>
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
              {systemLogo && <img src={systemLogo} alt="Logo" className="w-9 h-9 sm:w-11 sm:h-11 object-contain rounded-xl bg-white/10 p-1.5 shrink-0" decoding="async" loading="eager" />}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="font-bold text-[15px] sm:text-[20px] tracking-tighter uppercase leading-none truncate">{dynamicAppName}</h1>
                  {systemVersion && <span className="bg-white/20 px-1.5 py-0.5 rounded-[4px] text-[7px] font-bold uppercase tracking-tighter self-center hidden md:inline-block">v{systemVersion}</span>}
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-300 uppercase tracking-widest truncate leading-relaxed mt-0.5 sm:mt-1 opacity-90">{identityDisplay}</span>
              </div>
            </div>
            <button
                onClick={triggerLogoutConfirm}
                className="bg-white/10 px-4 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[11px] font-bold uppercase tracking-widest border border-white/10 active:scale-[0.96] transition-all hover:bg-white hover:text-emerald-700 shadow-sm whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 w-full flex flex-col relative">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin"></div></div>}>
            {auth.user?.role === UserRole.SUPERADMIN ? (
                <SuperAdminDashboard branches={branches} transactions={transactions} expenses={expenses} employees={employees} attendance={attendance} auditLogs={auditLogs} onlineUsers={{}} salesReports={salesReports} terminology={terminology} onUpdateTerminology={updateTerminology} onRefresh={refreshDatabase} onSyncStatusChange={setGlobalSync} />
            ) : (
                auth.user && currentBranch && <BranchManagerDashboard user={auth.user} branch={currentBranch} isRelief={isRelief} branches={branches} transactions={transactions} expenses={expenses} attendance={attendance} employees={employees} salesReports={salesReports} auditLogs={auditLogs} autoRefreshTime={autoRefreshTime} isPaymongoEnabled={isPaymongoEnabled} terminology={terminology} onRefresh={refreshDatabase} onSwitchBranch={handleSwitchBranch} onSyncStatusChange={setGlobalSync} loading={loading} />
            )}
          </Suspense>
        </main>
      </div>
  );
};

export default App;