import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Branch, Transaction, Expense, Employee, SalesReport, AuditLog, Attendance, AuthState, UserRole, Terminology } from '../types';
import { DB_TABLES, DB_COLUMNS } from '../constants/db_schema';
import { UI_THEME } from '../constants/ui_designs';
import { useBranchData } from './dashboard/hooks/useBranchData';
import { POSSection } from './dashboard/sections/POSSection';
import { ExpensesSection } from './dashboard/sections/ExpensesSection';
import { ExpensesManagerSection } from './dashboard/sections/ExpensesManagerSection';
import { MonthlyExpenseSection } from './dashboard/sections/MonthlyExpenseSection';
import { ExpensesHub } from './superadmin/ExpensesHub';
import { PayrollSection } from './dashboard/sections/PayrollSection';
import { SalesTodaySection } from './dashboard/sections/SalesTodaySection';
import { StaffDirectorySection } from './dashboard/sections/StaffDirectorySection';
import { ReportsMasterSection } from './dashboard/sections/ReportsMasterSection';
import { SettingsSection } from './dashboard/sections/SettingsSection';
import { HowToSection } from './dashboard/sections/HowToSection';
import { DeveloperSection } from './dashboard/sections/DeveloperSection';
import { BranchNavbar } from './navigation/BranchNavbar';
import { resumeAudioContext, playSound } from '../lib/audio';
import { supabase } from '../lib/supabase';
import { getEmployeeAllowance } from '../lib/payroll';

interface BranchManagerDashboardProps {
  user: Exclude<AuthState['user'], null>;
  branch: Branch;
  isRelief: boolean;
  branches: Branch[];
  transactions: Transaction[];
  expenses: Expense[];
  attendance: Attendance[];
  employees: Employee[];
  salesReports: SalesReport[];
  auditLogs: AuditLog[];
  autoRefreshTime: string;
  isPaymongoEnabled?: boolean;
  loading?: boolean;
  connStatus?: 'connecting' | 'connected' | 'error' | 'offline';
  pendingSyncCount?: number;
  onRefresh?: (quiet?: boolean) => void;
  onSwitchBranch?: (branchId: string) => void;
  onSyncStatusChange?: (isSyncing: boolean) => void;
  terminology: Terminology;
}

export type TabID = 'pos' | 'sales' | 'staff' | 'expenses_hub' | 'monthly_bills' | 'expense_reports' | 'salaries' | 'sales_reports' | 'settings' | 'how_to';

const BranchManagerDashboard: React.FC<BranchManagerDashboardProps> = (props) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [autoSyncStatus, setAutoSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const [showStatusEnforcer, setShowStatusEnforcer] = useState(!props.branch.isOpen);
  const [showToggleConfirm, setShowToggleConfirm] = useState(false);
  const [showClosingWarning, setShowClosingWarning] = useState(false);
  const [hasDismissedWarning, setHasDismissedWarning] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isSwitchingOpen, setIsSwitchingOpen] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const branchEmployees = useMemo(() => {
    return props.employees.filter(e => {
      const isHomeBranch = e.branchId === props.branch.id;
      const isDesignatedManager = props.branch.manager?.toUpperCase() === (e.name || '').toUpperCase();
      return isHomeBranch || isDesignatedManager;
    });
  }, [props.employees, props.branch.id, props.branch.manager]);

  const isSetupRequired = useMemo(() => {
    return !branchEmployees.some(e =>
        e.role.includes('THERAPIST') || e.role.includes('BONESETTER')
    );
  }, [branchEmployees]);

  const [activeTab, setActiveTab] = useState<TabID>('pos');

  const [hiddenStaffNames, setHiddenStaffNames] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`hidden_staff_${props.branch.id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const { yearlyCycles } = useBranchData(props.branch, props.transactions, props.expenses);

  const managedNodes = useMemo(() => {
    if (!props.branch.manager) return [];
    return props.branches.filter(b =>
        b.id !== props.branch.id &&
        b.manager?.toUpperCase() === props.branch.manager?.toUpperCase() &&
        b.isEnabled
    );
  }, [props.branches, props.branch.id, props.branch.manager]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isSwitchingOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsSwitchingOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isSwitchingOpen]);

  // Synchronize enforcer visibility with data
  useEffect(() => {
    if (props.branch.isOpen) {
      setShowStatusEnforcer(false);
    } else {
      setShowStatusEnforcer(true);
    }
  }, [props.branch.isOpen]);

  // MAINTENANCE SENTINEL
  useEffect(() => {
    const checkMaintenanceWindow = () => {
      if (!props.branch.isOpen) return;

      const now = new Date();
      const manilaToday = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(now);

      const manilaHHMM = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(now);

      const [currH, currM] = manilaHHMM.split(':').map(Number);
      const [refH, refM] = props.autoRefreshTime.split(':').map(Number);

      const isPastThreshold = (currH > refH) || (currH === refH && currM >= refM);
      const isStaleNode = props.branch.isOpenDate && props.branch.isOpenDate < manilaToday;

      if (isPastThreshold && isStaleNode) {
        props.onRefresh?.(true);
      }
    };

    const sentinelInterval = setInterval(checkMaintenanceWindow, 60000);
    return () => clearInterval(sentinelInterval);
  }, [props.branch.isOpen, props.branch.isOpenDate, props.autoRefreshTime, props.onRefresh]);

  useEffect(() => {
    const checkClosingTime = () => {
      if (!props.branch.isOpen || !props.branch.closingTime || hasDismissedWarning) return;

      const now = new Date();
      const [closeH, closeM] = props.branch.closingTime.split(':').map(Number);

      const closingDate = new Date(now);
      closingDate.setHours(closeH, closeM, 0, 0);

      const diffMs = closingDate.getTime() - now.getTime();
      const diffMins = diffMs / (1000 * 60);

      if (diffMins > 0 && diffMins <= 15) {
        setShowClosingWarning(true);
        playSound('warning');
      }
    };

    const timer = setInterval(() => {
      setCurrentTime(new Date());
      checkClosingTime();
    }, 1000);
    return () => clearInterval(timer);
  }, [props.branch.isOpen, props.branch.closingTime, hasDismissedWarning]);

  const changeTab = (tabId: TabID) => {
    resumeAudioContext();
    if (tabId !== activeTab) {
      if (tabId !== 'pos') {
        window.history.pushState({ tab: tabId }, '');
      }
      setActiveTab(tabId);
      if (['salaries', 'reports_master', 'sales'].includes(tabId)) {
        props.onRefresh?.(true);
      }
    }
  };

  const todayStr = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), [currentTime.getDate()]);

  const todayTxs = useMemo(() => props.transactions.filter(t => t.branchId === props.branch.id && t.timestamp.startsWith(todayStr)).sort((a,b) => (b.timestamp || '').localeCompare(a.timestamp || '')), [props.transactions, props.branch.id, todayStr]);
  const todayExps = useMemo(() => props.expenses.filter(e => e.branchId === props.branch.id && e.timestamp.startsWith(todayStr)).sort((a,b) => (b.timestamp || '').localeCompare(a.timestamp || '')), [props.expenses, props.branch.id, todayStr]);
  const todayAtt = useMemo(() => props.attendance.filter(a => a.branchId === props.branch.id && a.date === todayStr), [props.attendance, props.branch.id, todayStr]);

  const staffSummary = useMemo(() => {
    const summary: Record<string, any> = {};

    branchEmployees.forEach(emp => {
      const nameUpper = (emp.name || '').toUpperCase();
      const hasAttendance = todayAtt.some(a => a.employeeId === emp.id);
      const hasTransactions = todayTxs.some(t => t.therapistName?.toUpperCase() === nameUpper || t.bonesetterName?.toUpperCase() === nameUpper);

      const isActiveToday = hasAttendance || hasTransactions;

      if (isActiveToday && !hiddenStaffNames.has(nameUpper)) {
        summary[emp.id] = {
          employeeId: emp.id,
          name: nameUpper, // Keep for internal mapping
          count: 0,
          commission: 0,
          allowance: getEmployeeAllowance(emp, props.branch.id),
          attendance: null,
          txs: []
        };
      }
    });

    todayTxs.forEach(t => {
      [t.therapistName, t.bonesetterName].forEach((name, idx) => {
        if (!name) return;
        const n = name.trim().toUpperCase();
        const emp = branchEmployees.find(e => e.name.toUpperCase() === n);
        if (emp && summary[emp.id]) {
          if (idx === 0 || n !== t.therapistName?.trim().toUpperCase()) summary[emp.id].count += 1;
          summary[emp.id].commission += idx === 0 ? (Number(t.primaryCommission) || 0) : (Number(t.secondaryCommission) || 0);
        }
      });
    });

    todayAtt.forEach(att => {
      if (att.employeeId && summary[att.employeeId]) {
        summary[att.employeeId].attendance = att;
      } else {
        const sName = att.staffName.toUpperCase();
        const emp = branchEmployees.find(e => e.name.toUpperCase() === sName);
        if (emp && summary[emp.id]) summary[emp.id].attendance = att;
      }
    });

    return summary;
  }, [todayTxs, todayAtt, branchEmployees, hiddenStaffNames, props.branch.id]);

  const totals = useMemo(() => {
    const gross = todayTxs.reduce((s, t) => s + (Number(t.total) || 0), 0);
    const baseStaffPay = todayTxs.reduce((s, t) => s + (Number(t.primaryCommission) || 0) + (Number(t.secondaryCommission) || 0), 0);
    const operationalExp = todayExps.filter(e => e.category === 'OPERATIONAL').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const provisionExp = todayExps.filter(e => e.category === 'PROVISION').reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const totalAllowances = Object.values(staffSummary).reduce((sum: any, item: any) => sum + (Number(item.allowance) || 0), 0);

    const lateDeductions = todayAtt.reduce((s, a) => s + (Number(a.lateDeduction) || 0), 0);
    const otAdditions = todayAtt.reduce((s, a) => s + (Number(a.otPay) || 0), 0);
    const totalCashAdvances = todayAtt.reduce((s, a) => s + (Number(a.cashAdvance) || 0), 0);

    const totalStaffLiability = baseStaffPay + totalAllowances + otAdditions - lateDeductions;

    return {
      gross,
      totalStaffLiability,
      totalCashAdvances,
      operationalExp,
      provisionExp,
      net: gross - operationalExp - provisionExp - totalStaffLiability
    };
  }, [todayTxs, todayExps, todayAtt, staffSummary]);

  useEffect(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setAutoSyncStatus('saving');
    syncTimeoutRef.current = setTimeout(async () => {
      if (!navigator.onLine || props.loading) {
        if (props.loading) setAutoSyncStatus('saving');
        else setAutoSyncStatus('error');
        return;
      }
      try {
        const reportId = `${props.branch.id}_${todayStr.replace(/-/g, '')}`;

        const payload = {
          [DB_COLUMNS.ID]: reportId,
          [DB_COLUMNS.BRANCH_ID]: props.branch.id,
          [DB_COLUMNS.REPORT_DATE]: todayStr,
          [DB_COLUMNS.SUBMITTED_AT]: new Date().toISOString(),
          [DB_COLUMNS.GROSS_SALES]: totals.gross,
          [DB_COLUMNS.TOTAL_STAFF_PAY]: totals.totalStaffLiability,
          [DB_COLUMNS.TOTAL_EXPENSES]: totals.operationalExp,
          [DB_COLUMNS.TOTAL_VAULT_PROVISION]: totals.provisionExp,
          [DB_COLUMNS.NET_ROI]: totals.net,
          [DB_COLUMNS.SESSION_DATA]: todayTxs.map(t => ({
            ...t,
            settlement: t.paymentMethod?.toLowerCase() || 'cash'
          })),
          [DB_COLUMNS.STAFF_BREAKDOWN]: Object.values(staffSummary).map((data: any) => {
            const { name, ...rest } = data;
            return rest;
          }),
          [DB_COLUMNS.EXPENSE_DATA]: todayExps.filter(e => e.category === 'OPERATIONAL'),
          [DB_COLUMNS.VAULT_DATA]: todayExps.filter(e => e.category !== 'OPERATIONAL')
        };
        const { error } = await supabase.from(DB_TABLES.SALES_REPORTS).upsert(payload);
        if (error) throw error;
        setAutoSyncStatus('synced');
      } catch (err) { setAutoSyncStatus('error'); }
    }, 1500);
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [totals, todayTxs.length, todayExps.length, todayAtt.length, props.branch.id, todayStr, staffSummary]);

  const handleToggleBranchStatus = async () => {
    setIsOpening(true);
    if (props.onSyncStatusChange) props.onSyncStatusChange(true);
    playSound('click');
    const nextStatus = !props.branch.isOpen;
    try {
      const manilaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

      if (nextStatus === true) {
        const { error: purgeError } = await supabase
            .from(DB_TABLES.TRANSACTIONS)
            .delete()
            .eq(DB_COLUMNS.BRANCH_ID, props.branch.id)
            .lt(DB_COLUMNS.TIMESTAMP, `${manilaToday}T00:00:00.000Z`);

        if (purgeError) console.error('Registry Maintenance: Purge Failed', purgeError);
        else {
          await supabase.from(DB_TABLES.AUDIT_LOGS).insert({
            [DB_COLUMNS.BRANCH_ID]: props.branch.id,
            [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
            [DB_COLUMNS.ACTIVITY_TYPE]: 'DELETE',
            [DB_COLUMNS.ENTITY_TYPE]: 'TRANSACTION',
            [DB_COLUMNS.DESCRIPTION]: 'Automated Daily Registry Purge: Historical sessions migrated to Sales Report archive.',
            [DB_COLUMNS.PERFORMER_NAME]: 'SYSTEM CORE'
          });
        }
      }

      const updateData: any = {
        [DB_COLUMNS.IS_OPEN]: nextStatus,
        [DB_COLUMNS.IS_OPEN_DATE]: nextStatus ? manilaToday : props.branch.isOpenDate
      };

      const { error } = await supabase.from(DB_TABLES.BRANCHES).update(updateData).eq(DB_COLUMNS.ID, props.branch.id);
      if (error) throw error;

      playSound('success');
      setShowToggleConfirm(false);
      setShowStatusEnforcer(false);
      props.onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setIsOpening(false);
      if (props.onSyncStatusChange) props.onSyncStatusChange(false);
    }
  };

  const renderContent = () => {
    const isClosedMode = !props.branch.isOpen;
    switch (activeTab) {
      case 'pos': return <POSSection {...props} attendance={props.attendance} todayStr={todayStr} isClosedMode={isClosedMode} isPaymongoEnabled={props.isPaymongoEnabled} onSyncStatusChange={props.onSyncStatusChange} loading={props.loading} terminology={props.terminology} />;
      case 'sales': return <SalesTodaySection {...props} todayStr={todayStr} setActiveTab={setActiveTab as any} connStatus={props.connStatus} pendingSyncCount={props.pendingSyncCount} hiddenStaffNames={hiddenStaffNames} setHiddenStaffNames={setHiddenStaffNames} isClosedMode={isClosedMode} onRefresh={props.onRefresh} loading={props.loading} terminology={props.terminology} />;
      case 'staff': return <StaffDirectorySection branch={props.branch} branches={props.branches} employees={props.employees} attendance={props.attendance} transactions={props.transactions} isClosedMode={isClosedMode} onRefresh={props.onRefresh} isSetupRequired={isSetupRequired} onSyncStatusChange={props.onSyncStatusChange} terminology={props.terminology} />;
      case 'expenses_hub': return (
          <ExpensesManagerSection
              branch={props.branch}
              expenses={props.expenses}
              salesReports={props.salesReports}
              isClosedMode={isClosedMode}
              onRefresh={props.onRefresh}
              onSyncStatusChange={props.onSyncStatusChange}
              terminology={props.terminology}
          />
      );
      case 'monthly_bills': return (
          <MonthlyExpenseSection
              branch={props.branch}
              expenses={props.expenses}
              salesReports={props.salesReports}
              isClosedMode={isClosedMode}
              onRefresh={props.onRefresh}
              onSyncStatusChange={props.onSyncStatusChange}
              terminology={props.terminology}
          />
      );
      case 'expense_reports': return (
          <div className="max-w-7xl mx-auto px-2 sm:px-6 pb-20">
            <ExpensesHub
                branches={[props.branch]}
                salesReports={props.salesReports.filter(r => r.branchId === props.branch.id)}
                realTimeExpenses={props.expenses.filter(e => e.branchId === props.branch.id)}
                hideHeader={false}
            />
          </div>
      );
      case 'salaries': return <PayrollSection {...props} attendance={props.attendance} onRefresh={() => props.onRefresh?.(true)} terminology={props.terminology} />;
      case 'sales_reports': return <ReportsMasterSection branch={props.branch} salesReports={props.salesReports} branches={props.branches} employees={props.employees} terminology={props.terminology} />;
      case 'settings': return (
          <SettingsSection
              user={props.user}
              branch={props.branch}
              branches={props.branches}
              todayTxs={todayTxs}
              todayAtt={todayAtt}
              todayReportExists={props.salesReports.some(r => r.branchId === props.branch.id && r.reportDate === todayStr)}
              employees={props.employees}
              onRefresh={props.onRefresh}
              terminology={props.terminology}
          />
      );
      case 'how_to': return <HowToSection role={UserRole.BRANCH_MANAGER} terminology={props.terminology} />;
      default: return null;
    }
  };

  const branchCleanName = useMemo(() => {
    return props.branch.name.replace(/BRANCH - /g, '').toUpperCase();
  }, [props.branch.name]);

  return (
      <div className="pb-32 min-h-screen bg-slate-50">
        {showClosingWarning && (
            <div className={UI_THEME.layout.modalWrapper}>
              <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-10 text-center border-4 border-amber-500 shadow-[0_0_100px_rgba(245,158,11,0.3)] animate-premium-pulse`}>
                <div className="w-20 h-20 bg-amber-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-3">MANDATORY FINALIZATION</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-10">
                  This {props.terminology.branch.toLowerCase()} is scheduled to close at <span className="text-amber-600">{props.branch.closingTime}</span>.
                  Please verify Today's Ledger and log Rent & Bills before the automated registry purge.
                </p>
                <div className="flex flex-col gap-4">
                  <button
                      onClick={() => { setActiveTab('sales'); setShowClosingWarning(false); setHasDismissedWarning(true); playSound('click'); }}
                      className="w-full bg-slate-900 text-white font-black py-6 rounded-2xl text-[12px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
                  >
                    Verify Ledger Now
                  </button>
                  <button
                      onClick={() => { setShowClosingWarning(false); setHasDismissedWarning(true); playSound('click'); }}
                      className="w-full text-slate-400 font-bold py-4 rounded-xl text-[10px] uppercase tracking-widest"
                  >
                    Dismiss Warning
                  </button>
                </div>
              </div>
            </div>
        )}

        {showStatusEnforcer && (
            <div className={UI_THEME.layout.modalWrapper}>
              <div className={`${UI_THEME.layout.modalLarge} ${UI_THEME.radius.modal} p-10 text-center relative overflow-hidden border border-white/5`}>
                <div className="relative z-10 space-y-8">
                  <div className="w-20 h-20 bg-slate-900 rounded-[28px] flex items-center justify-center mx-auto text-white shadow-xl">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M3 21h18M3 7l9-4 9 4v14H3V7zm6 14v-7h6v7"/></svg>
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight uppercase leading-tight break-words">
                    {branchCleanName} IS CURRENTLY{" "}
                    <span className="text-red-600">
                      CLOSED
                    </span>
                  </h3>
                  <div className="flex flex-col gap-4">
                    <button
                        onClick={handleToggleBranchStatus}
                        disabled={isOpening}
                        className="w-full text-white font-bold py-6 px-2 rounded-[20px] text-[13px] uppercase tracking-[0.2em] shadow-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all"
                    >
                      {isOpening ? 'INITIALIZING...' : 'Initialize Daily Opening'}
                    </button>
                    <button onClick={() => { playSound('click'); setShowStatusEnforcer(false); }} className="w-full text-slate-400 font-bold py-4 text-[11px] uppercase tracking-widest">Proceed without opening</button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {showToggleConfirm && (
            <div className={UI_THEME.layout.modalWrapper}>
              <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-10 text-center border border-slate-100`}>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner ${props.branch.isOpen ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h4 className="text-2xl font-bold text-slate-900 mb-2 uppercase tracking-tighter">{props.branch.isOpen ? 'Close Terminal?' : 'Open Terminal?'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  {props.branch.isOpen ? 'Disabling POS operations for this node.' : 'Enabling POS operations and shift tracking.'}
                </p>
                <div className="flex flex-col gap-3 mt-10">
                  <button
                      onClick={handleToggleBranchStatus}
                      disabled={isOpening}
                      className={`w-full text-white font-bold py-5 rounded-2xl text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 ${props.branch.isOpen ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                  >
                    {isOpening ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : (props.branch.isOpen ? 'Confirm Closure' : 'Confirm Opening')}
                  </button>
                  <button onClick={() => setShowToggleConfirm(false)} className="w-full text-slate-400 font-bold py-4 rounded-xl text-[11px] uppercase tracking-widest">Cancel</button>
                </div>
              </div>
            </div>
        )}

        <div className="sticky top-[72px] sm:top-20 left-0 right-0 z-[60] no-print shadow-lg">
          <div className="bg-slate-800 text-white transition-all duration-500">
            <div className={`${UI_THEME.layout.maxContent} ${UI_THEME.layout.mainPadding} py-2 flex flex-row justify-between items-center gap-2`}>
              <div className="flex flex-row items-center gap-2 sm:gap-5 text-slate-500 overflow-hidden shrink-0">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span className="text-[10px] sm:text-[11px] font-bold font-mono tabular-nums tracking-tighter text-slate-100">
                      {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    {' • '}
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 shrink-0" ref={dropdownRef}>
                <button
                    onClick={() => { playSound('click'); setShowToggleConfirm(true); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all active:scale-[0.96] shadow-md ${props.branch.isOpen ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${props.branch.isOpen ? 'bg-emerald-400 shadow-emerald-400 animate-pulse' : 'bg-rose-50 shadow-rose-500'}`}></div>
                  <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-widest ${props.branch.isOpen ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {props.branch.isOpen ? 'Online' : 'Offline'}
                  </span>
                </button>

                {managedNodes.length > 0 && (
                    <div className="relative">
                      <button onClick={() => { setIsSwitchingOpen(!isSwitchingOpen); playSound('click'); }} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all text-[8px] sm:text-[9px] font-bold uppercase tracking-widest active:scale-[0.96] ${isSwitchingOpen ? 'bg-slate-700 border-white/20 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M3 21h18M3 7l9-4 9 4v14H3V7zm6 14v-7h6v7"/></svg>
                        <span className="hidden sm:inline">Switch</span>
                        <span className="bg-white/10 px-1 rounded-md ml-0.5">{managedNodes.length}</span>
                      </button>

                      {isSwitchingOpen && (
                          <div className="absolute top-full right-0 mt-2 w-60 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-1.5 z-[70]">
                            <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest px-3 py-1 mb-1">Managed Nodes</p>
                            {managedNodes.map(n => (
                                <button key={n.id} onClick={() => { if (props.onSwitchBranch) { playSound('click'); props.onSwitchBranch(n.id); } }} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all flex items-center justify-between group">
                                  <p className="text-[10px] font-bold text-white uppercase truncate pr-4">{n.name.replace(/BRANCH - /i, '')}</p>
                                  <svg className="w-3 h-3 text-slate-600 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="3" /></svg>
                                </button>
                            ))}
                          </div>
                      )}
                    </div>
                )}
              </div>
            </div>
          </div>

          <BranchNavbar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              enableShiftTracking={props.branch.enableShiftTracking || false}
              isRelief={props.isRelief}
              terminology={props.terminology}
          />
        </div>

        <div className={`${UI_THEME.layout.mainPadding} ${UI_THEME.layout.maxContent} py-4 md:py-8 animate-in fade-in duration-500`}>
          {renderContent()}
        </div>
      </div>
  );
};

export default BranchManagerDashboard;