import React, { useState, useEffect, useMemo } from 'react';
import { UserRole, Branch, Employee } from '../types';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/audio';
import { DB_TABLES, DB_COLUMNS } from '../constants/db_schema';
import { hashPin } from '../lib/crypto';

// Modular Imports
import { NodeSelector } from './login/NodeSelector';
import { AuthForm } from './login/AuthForm';
import { RecoveryForm } from './login/RecoveryForm';

interface LoginProps {
    onLogin: (role: UserRole, branchId?: string, pin?: string, employeeId?: string, username?: string) => void;
    branches: Branch[];
    employees: Employee[];
    onlineUsers: Record<string, boolean>;
    logo?: string | null;
    version?: string | null;
    appName?: string;
    connectionError?: any;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 30000;

const Login: React.FC<LoginProps> = ({ onLogin, branches, employees, logo, version, appName, connectionError }) => {
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [shake, setShake] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [isReliefMode, setIsReliefMode] = useState(false);
    const [recoveryUsername, setRecoveryUsername] = useState('');

    useEffect(() => {
        if (error) {
            setShake(true);
            const timer = setTimeout(() => setShake(false), 500);
            return () => clearTimeout(timer);
        }
    }, [error]);

    useEffect(() => {
        if (lockoutUntil) {
            const now = Date.now();
            if (now >= lockoutUntil) {
                setLockoutUntil(null);
                setAttempts(0);
            } else {
                const timer = setTimeout(() => {
                    setLockoutUntil(null);
                    setAttempts(0);
                }, lockoutUntil - now);
                return () => clearTimeout(timer);
            }
        }
    }, [lockoutUntil]);

    const filteredBranches = useMemo(() => {
        const enabled = branches.filter(b => b.isEnabled);
        const sanitizedSearch = searchTerm.replace(/[<>]/g, '').toLowerCase();
        if (!sanitizedSearch) return enabled;
        return enabled.filter(b => b.name.toLowerCase().includes(sanitizedSearch));
    }, [branches, searchTerm]);

    const selectedBranch = useMemo(() =>
            selectedBranchId === 'admin'
                ? { name: 'SUPERADMIN', id: 'admin', isPinChanged: true } as any
                : branches.find(b => b.id === selectedBranchId)
        , [selectedBranchId, branches]);

    const tempManagerIdentity = useMemo(() => {
        if (!selectedBranch || !selectedBranch.tempManager) return null;
        const cleanTempName = selectedBranch.tempManager.toUpperCase().trim();
        return employees.find(e => e.name?.toUpperCase().trim() === cleanTempName);
    }, [selectedBranch, employees]);

    const handleRemoteResetSignal = async () => {
        if (isAuthenticating || !recoveryUsername.trim() || !selectedBranchId) return;
        setIsAuthenticating(true);
        setError('');
        setSuccess('');
        try {
            const { data, error: fetchError } = await supabase
                .from(DB_TABLES.EMPLOYEES)
                .select('id, name, branch_id')
                .eq(DB_COLUMNS.USERNAME, recoveryUsername.trim().toLowerCase())
                .single();

            if (fetchError || !data || data.branch_id !== selectedBranchId) {
                handleFailure('Identity Not Found');
            } else {
                const { error: updateError } = await supabase
                    .from(DB_TABLES.EMPLOYEES)
                    .update({ [DB_COLUMNS.REQUEST_RESET]: true })
                    .eq(DB_COLUMNS.ID, data.id);
                if (updateError) throw updateError;

                setSuccess('Reset Request Sent to Admin');
                playSound('success');
                setTimeout(() => { setIsRecoveryMode(false); setSuccess(''); setRecoveryUsername(''); }, 3000);
            }
        } catch (err) {
            setError('Signal Broadcast Failed');
            playSound('warning');
        } finally {
            setIsAuthenticating(false);
        }
    };

    const checkAndLogin = async (e?: React.MouseEvent | React.FormEvent, providedUsername?: string) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const finalUsername = (providedUsername || username).trim().toLowerCase();

        if (isAuthenticating || !selectedBranchId || pin.length < 6) return;
        if (!isReliefMode && selectedBranchId !== 'admin' && selectedBranch?.isPinChanged && !finalUsername) {
            setError('Username Required');
            return;
        }

        if (lockoutUntil && Date.now() < lockoutUntil) {
            const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
            setError(`Lockout: ${remaining}s`);
            playSound('warning');
            return;
        }

        setError('');
        setIsAuthenticating(true);
        const startTime = Date.now();

        try {
            if (selectedBranchId === 'admin') {
                const { data: configs, error: configError } = await supabase
                    .from('system_config')
                    .select('*')
                    .in('key', ['master_admin_pin', 'master_admin_pin_salt']);

                if (configError || !configs) {
                    handleFailure('Config Fault');
                    return;
                }

                const storedPinHash = configs.find(c => c.key === 'master_admin_pin')?.value;
                const storedSalt = configs.find(c => c.key === 'master_admin_pin_salt')?.value;

                let isValid = false;
                if (storedSalt) {
                    const computedHash = await hashPin(pin, storedSalt);
                    isValid = computedHash === storedPinHash;
                } else {
                    isValid = pin === storedPinHash;
                }

                if (!isValid) {
                    handleFailure('Access Denied');
                } else {
                    onLogin(UserRole.SUPERADMIN, undefined, pin);
                }
            } else {
                const branch = branches.find(b => b.id === selectedBranchId);
                if (!branch) {
                    handleFailure('Branch Lost');
                } else if (!branch.isEnabled) {
                    handleFailure('Access Revoked');
                    setSelectedBranchId(null);
                } else {
                    if (!branch.isPinChanged) {
                        if (branch.pin === pin) {
                            onLogin(UserRole.BRANCH_MANAGER, branch.id, pin);
                        } else {
                            handleFailure('Invalid Setup Key');
                        }
                    } else {
                        let empData: any = null;
                        if (isReliefMode && tempManagerIdentity) {
                            empData = tempManagerIdentity;
                        } else {
                            const { data, error: empError } = await supabase
                                .from(DB_TABLES.EMPLOYEES)
                                .select('*')
                                .eq(DB_COLUMNS.USERNAME, finalUsername)
                                .single();
                            if (!empError) empData = data;
                        }

                        if (!empData) {
                            handleFailure('Identity Rejected');
                        } else {
                            const isActive = empData.isActive !== undefined ? empData.isActive : empData.is_active;
                            if (!isActive) {
                                handleFailure('Account Suspended');
                                return;
                            }

                            let isValid = false;
                            const dbLoginPin = empData.loginPin !== undefined ? empData.loginPin : empData.login_pin;
                            const dbPinSalt = empData.pinSalt !== undefined ? empData.pinSalt : empData.pin_salt;

                            if (dbLoginPin) {
                                if (dbPinSalt) {
                                    const computedHash = await hashPin(pin, dbPinSalt);
                                    isValid = computedHash === dbLoginPin;
                                } else {
                                    isValid = pin === dbLoginPin;
                                }
                            } else if (isReliefMode) {
                                // RELIEF AUTHENTICATION: If relief manager has NO PIN yet,
                                // they must use the Branch's Setup PIN to authorize their first-time setup.
                                isValid = pin === branch.pin;
                            }

                            if (!isValid) {
                                handleFailure('Identity Rejected');
                                return;
                            }

                            const dbName = (empData.name || '').toUpperCase().trim();
                            const branchManagerName = (branch.manager || '').toUpperCase().trim();
                            const branchTempManagerName = (branch.tempManager || '').toUpperCase().trim();

                            const isAuthorizedHead = dbName !== '' && dbName === branchManagerName;
                            const isAuthorizedRelief = dbName !== '' && dbName === branchTempManagerName;

                            // FALLBACK: If name string mismatch but employee is assigned to this branch as home and is a manager
                            const isManagerRole = (empData.role || '').includes('MANAGER');
                            const isHomeBranch = empData.branchId === branch.id;
                            const isAuthorizedFallback = isHomeBranch && isManagerRole;

                            if (isAuthorizedHead || isAuthorizedRelief || isAuthorizedFallback) {
                                onLogin(UserRole.BRANCH_MANAGER, branch.id, pin, empData.id, empData.username || empData.name);
                            } else {
                                handleFailure('Unauthorized Terminal Access');
                            }
                        }
                    }
                }
            }
        } catch (err) {
            setError('Sync Failed');
        } finally {
            const duration = Date.now() - startTime;
            const wait = Math.max(0, 800 - duration);
            setTimeout(() => setIsAuthenticating(false), wait);
        }
    };

    const handleFailure = (msg: string) => {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin('');
        setError(msg);
        playSound('warning');

        if (newAttempts >= MAX_ATTEMPTS) {
            setLockoutUntil(Date.now() + LOCKOUT_TIME);
            setError(`Lockout: ${LOCKOUT_TIME / 1000}s`);
        }
    };

    if (!selectedBranchId) {
        return (
            <NodeSelector
                branches={filteredBranches}
                searchTerm={searchTerm}
                onSearch={setSearchTerm}
                onSelect={setSelectedBranchId}
                logo={logo || null}
                version={version || null}
                appName={appName}
                connectionError={connectionError}
            />
        );
    }

    const isSetupMode = selectedBranchId !== 'admin' && !selectedBranch?.isPinChanged;

    return (
        <div className={`min-h-screen w-full bg-[#0F172A] flex items-center justify-center p-4 relative overflow-hidden`}>
            {/* Neural Background Orbs */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full animate-float-slow"></div>
                <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[150px] rounded-full animate-float-slow" style={{ animationDelay: '-5s', animationDirection: 'reverse' }}></div>
                <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-emerald-400/5 blur-[100px] rounded-full animate-float-slow" style={{ animationDelay: '-12s' }}></div>
            </div>

            <div className={`w-full max-w-md bg-white/95 backdrop-blur-md rounded-[48px] shadow-2xl p-8 sm:p-10 relative z-10 animate-in zoom-in duration-300 ${shake ? 'animate-shake' : ''} ${isAuthenticating ? 'opacity-80' : ''} border border-white/20`}>
                <button
                    onClick={() => { setSelectedBranchId(null); setPin(''); setError(''); setIsReliefMode(false); setIsRecoveryMode(false); playSound('click'); }}
                    className="absolute top-8 left-8 text-slate-300 hover:text-slate-900 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="text-center mb-10">
                    <div className={`w-[18vw] h-[18vw] max-w-[100px] max-h-[100px] min-w-[64px] min-h-[64px] rounded-[22px] flex items-center justify-center mx-auto mb-6 shadow-xl ${selectedBranchId === 'admin' ? 'bg-slate-900' : 'bg-emerald-600'}`}>
                        {logo && selectedBranchId !== 'admin' ? (
                            <img
                                src={logo}
                                alt="Logo"
                                className="w-[12vw] h-[12vw] max-w-[60px] max-h-[60px] min-w-[40px] min-h-[40px] object-contain"
                                style={{ animation: 'spin-stop-flip 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
                            />
                        ) : (
                            <span className="text-2xl sm:text-3xl">{selectedBranchId === 'admin' ? '🔐' : '🏢'}</span>
                        )}
                    </div>
                    <h2 className="text-[7vw] sm:text-2xl font-bold text-slate-900 uppercase tracking-tighter leading-tight px-2">
                        {selectedBranch?.name}
                    </h2>
                    <p className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.3em] mt-3">Handshake Required</p>
                </div>

                {isRecoveryMode ? (
                    <RecoveryForm
                        recoveryUsername={recoveryUsername}
                        setRecoveryUsername={setRecoveryUsername}
                        onReset={handleRemoteResetSignal}
                        onCancel={() => setIsRecoveryMode(false)}
                        isAuthenticating={isAuthenticating}
                        successMsg={success}
                    />
                ) : (
                    <form onSubmit={checkAndLogin} className="space-y-8">
                        <AuthForm
                            username={username}
                            setUsername={setUsername}
                            pin={pin}
                            setPin={setPin}
                            isReliefMode={isReliefMode}
                            isSetupMode={isSetupMode}
                            isAdmin={selectedBranchId === 'admin'}
                            tempManagerIdentity={tempManagerIdentity}
                            isAuthenticating={isAuthenticating}
                            lockoutUntil={lockoutUntil}
                        />

                        {error && (
                            <div
                                className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-center animate-in slide-in-from-top-2">
                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <button
                                onClick={(e) => checkAndLogin(e)}
                                disabled={isAuthenticating || pin.length < 6 || !!lockoutUntil}
                                className="w-full bg-slate-900 text-white font-bold py-6 rounded-[28px] shadow-2xl active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-[11px] disabled:opacity-30 flex items-center justify-center gap-3"
                            >
                                {isAuthenticating ? <div
                                    className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'Login'}
                            </button>

                            {!isSetupMode && selectedBranchId !== 'admin' && (
                                <div className="flex flex-col gap-2 pt-2">
                                    <button
                                        onClick={() => {
                                            setIsReliefMode(!isReliefMode);
                                            setError('');
                                            setPin('');
                                            playSound('click');
                                        }}
                                        className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors py-2"
                                    >
                                        {isReliefMode ? 'Switch to Manager' : 'Relief Manager Access'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsRecoveryMode(true);
                                            setError('');
                                            setPin('');
                                            playSound('click');
                                        }}
                                        className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors py-1"
                                    >
                                        Forgot Credentials?
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;