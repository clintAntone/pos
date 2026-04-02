import React, { useState, useMemo, useEffect } from 'react';
import { Branch, Transaction, Expense, Attendance, Employee } from '../../../types';
import { DB_TABLES, DB_COLUMNS } from '../../../constants/db_schema';
import { UI_THEME } from '../../../constants/ui_designs';
import { supabase } from '../../../lib/supabase';
import { playSound } from '../../../lib/audio';
import { deleteFileByUrl } from '../../../lib/storage';
import { getEmployeeAllowance } from '../../../lib/payroll';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Modular Sub-components
import { SessionLogs } from './sales-today/SessionLogs';
import { StaffPerformance } from './sales-today/StaffPerformance';
import { VaultExpenses } from './sales-today/VaultExpenses';
import { SalesKPIStrip } from './sales-today/SalesKPIStrip';
import { QuickExpenseModal } from './sales-today/QuickExpenseModal';
import { ExpenseDetailModal } from './sales-today/ExpenseDetailModal';

interface SalesTodayProps {
  branch: Branch;
  transactions: Transaction[];
  expenses: Expense[];
  attendance: Attendance[];
  employees: Employee[];
  setActiveTab?: (id: any) => void;
  autoSyncStatus?: 'synced' | 'saving' | 'error';
  connStatus?: 'connecting' | 'connected' | 'error' | 'offline';
  pendingSyncCount?: number;
  todayStr?: string;
  hiddenStaffNames: Set<string>;
  setHiddenStaffNames: React.Dispatch<React.SetStateAction<Set<string>>>;
  isClosedMode?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

import { KPISkeleton, CardSkeleton } from '../../ui/Skeleton';

export const SalesTodaySection: React.FC<SalesTodayProps> = ({
                                                               branch, transactions, expenses, attendance, employees,
                                                               autoSyncStatus = 'synced', connStatus = 'connected', pendingSyncCount = 0,
                                                               todayStr: propTodayStr,
                                                               hiddenStaffNames, setHiddenStaffNames,
                                                               isClosedMode = false, onRefresh, loading = false
                                                             }) => {
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isSavingProvision, setIsSavingProvision] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showSynced, setShowSynced] = useState(false);
  const [showPDFConfirm, setShowPDFConfirm] = useState(false);

  useEffect(() => {
    if (autoSyncStatus === 'synced') {
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [autoSyncStatus]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const todayStr = useMemo(() => {
    if (propTodayStr) return propTodayStr;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }, [propTodayStr]);

  const txs = useMemo(() => transactions.filter(t => t.branchId === branch.id && t.timestamp.startsWith(todayStr)).sort((a,b) => (b.timestamp || '').localeCompare(a.timestamp || '')), [transactions, branch.id, todayStr]);
  const exps = useMemo(() => expenses.filter(e => e.branchId === branch.id && e.timestamp.startsWith(todayStr)).sort((a,b) => (b.timestamp || '').localeCompare(a.timestamp || '')), [expenses, branch.id, todayStr]);
  const dailyAttendance = useMemo(() => attendance.filter(a => a.branchId === branch.id && a.date === todayStr), [attendance, branch.id, todayStr]);

  const activeRoster = useMemo(() => {
    return employees.filter(e => {
      const isHomeBranch = e.branchId === branch.id;
      const isDesignatedManager = branch.manager?.toUpperCase() === e.name?.toUpperCase();
      return isHomeBranch || isDesignatedManager;
    });
  }, [employees, branch.id, branch.manager]);

  const metrics = useMemo(() => {
    const gross = txs.reduce((s, t) => s + (Number(t.total) || 0), 0);
    const baseStaffPay = txs.reduce((s, t) => s + (Number(t.primaryCommission) || 0) + (Number(t.secondaryCommission) || 0), 0);
    const operationalExp = exps.filter(e => e.category === 'OPERATIONAL').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const provisionExp = exps.filter(e => e.category === 'PROVISION').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const lateDeductions = dailyAttendance.reduce((s, a) => s + (Number(a.lateDeduction) || 0), 0);
    const otAdditions = dailyAttendance.reduce((s, a) => s + (Number(a.otPay) || 0), 0);
    const totalCashAdvances = dailyAttendance.reduce((s, a) => s + (Number(a.cashAdvance) || 0), 0);

    const summary: Record<string, any> = {};

    activeRoster.forEach(emp => {
      const n = (emp.name || '').toUpperCase();
      const attRecord = dailyAttendance.find(a => a.employeeId === emp.id);

      if (attRecord || txs.some(t => t.therapistName?.trim().toUpperCase() === n || t.bonesetterName?.trim().toUpperCase() === n)) {
        if (!hiddenStaffNames.has(n)) {
          summary[n] = {
            employeeId: emp.id,
            profile: emp.profile,
            count: 0,
            commission: 0,
            allowance: getEmployeeAllowance(emp, branch.id),
            attendance: attRecord || null,
            txs: []
          };
        }
      }
    });

    txs.forEach(t => {
      [t.therapistName, t.bonesetterName].forEach((name, idx) => {
        if (!name) return;
        const n = name.trim().toUpperCase();
        if (summary[n]) {
          if (idx === 0 || n !== t.therapistName?.trim().toUpperCase()) summary[n].count += 1;
          summary[n].commission += idx === 0 ? (Number(t.primaryCommission) || 0) : (Number(t.secondaryCommission) || 0);
        }
      });
    });

    const totalAllowances = Object.values(summary).reduce((sum, item: any) => sum + item.allowance, 0);
    const totalStaffLiability = baseStaffPay + otAdditions + totalAllowances - lateDeductions;
    const finalStaffPayTotal = totalStaffLiability - totalCashAdvances;
    const net = gross - (operationalExp + provisionExp) - totalStaffLiability;

    return {
      gross, operationalExp, provisionExp, totalStaffLiability, finalStaffPayTotal, lateDeductions, otAdditions, totalCashAdvances, totalAllowances, net, staffSummary: summary
    };
  }, [txs, dailyAttendance, exps, activeRoster, hiddenStaffNames, branch.id]);

  const handleHideStaff = (name: string) => {
    playSound('warning');
    setHiddenStaffNames(prev => { const n = new Set(prev); n.add(name.toUpperCase()); return n; });
  };

  const handleRestoreStaff = (name: string) => {
    playSound('success');
    setHiddenStaffNames(prev => { const n = new Set(prev); n.delete(name.toUpperCase()); return n; });
  };

  const handleAddDailyProvision = async () => {
    if (isSavingProvision || isClosedMode) return;
    setIsSavingProvision(true);
    const now = new Date();
    const timePart = now.toTimeString().split(' ')[0];
    const timestamp = `${todayStr}T${timePart}.000Z`;
    const provisionId = Math.random().toString(36).substr(2, 9);
    const amount = Number(branch.dailyProvisionAmount) || 800;
    try {
      await supabase.from(DB_TABLES.EXPENSES).insert({
        [DB_COLUMNS.ID]: provisionId, [DB_COLUMNS.BRANCH_ID]: branch.id,
        [DB_COLUMNS.TIMESTAMP]: timestamp, [DB_COLUMNS.NAME]: 'DAILY R&B PROVISION',
        [DB_COLUMNS.AMOUNT]: amount, [DB_COLUMNS.CATEGORY]: 'PROVISION'
      });
      playSound('success');
      onRefresh?.();
    } catch (err) { playSound('warning'); } finally { setIsSavingProvision(false); }
  };

  const handleDeleteExpenseTrigger = (id: string) => {
    const target = exps.find(e => e.id === id);
    if (target) {
      playSound('warning');
      setExpenseToDelete(target);
    }
  };

  const handleFinalDeleteExpense = async () => {
    if (!expenseToDelete || isDeleting || isClosedMode) return;
    const target = expenseToDelete;

    setIsDeleting(true);
    try {
      if (target.receiptImage) {
        await deleteFileByUrl(target.receiptImage, 'receipts');
      }

      const { error } = await supabase.from(DB_TABLES.EXPENSES).delete().eq(DB_COLUMNS.ID, target.id);
      if (error) throw error;

      await supabase.from(DB_TABLES.AUDIT_LOGS).insert({
        [DB_COLUMNS.BRANCH_ID]: branch.id,
        [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [DB_COLUMNS.ACTIVITY_TYPE]: 'DELETE',
        [DB_COLUMNS.ENTITY_TYPE]: 'EXPENSE',
        [DB_COLUMNS.ENTITY_ID]: target.id,
        [DB_COLUMNS.DESCRIPTION]: `Authorized ledger deletion: ${target.name} (₱${target.amount}) removed from ${target.category} registry.`,
        [DB_COLUMNS.AMOUNT]: target.amount,
        [DB_COLUMNS.PERFORMER_NAME]: branch.manager || 'AUTHORIZED MANAGER'
      });

      playSound('success');
      showToast('Record Scrubbed');
      setExpenseToDelete(null);
      onRefresh?.();
    } catch (err) {
      showToast('Scrub Protocol Fault', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const hiddenRosterStaff = useMemo(() => employees.filter(e => e.branchId === branch.id && hiddenStaffNames.has((e.name || '').toUpperCase())), [employees, branch.id, hiddenStaffNames]);

  const handleExportPDF = async (confirmed = false) => {
    if (!confirmed) {
      playSound('warning');
      setShowPDFConfirm(true);
      return;
    }

    setShowPDFConfirm(false);
    setIsExporting(true);
    playSound('click');

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const displayDate = new Date(todayStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

      // 1. Header
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text((branch.name || '').toUpperCase(), 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-400
      doc.text('DAILY OPERATIONAL LEDGER', 14, 26);

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(displayDate, pageWidth - 14, 20, { align: 'right' });

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 26, { align: 'right' });

      // 2. Financial Summary
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('FINANCIAL SUMMARY', 14, 40);

      autoTable(doc, {
        startY: 43,
        head: [['Metric', 'Amount']],
        body: [
          ['Gross Sales', `PHP ${metrics.gross.toLocaleString()}`],
          ['Operational Expenses', `PHP ${metrics.operationalExp.toLocaleString()}`],
          ['Staff Payroll', `PHP ${metrics.totalStaffLiability.toLocaleString()}`],
          ['Vault Reserve', `PHP ${metrics.provisionExp.toLocaleString()}`],
          ['Net ROI', `PHP ${metrics.net.toLocaleString()}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'right', fontStyle: 'bold' }
        },
        rowPageBreak: 'avoid'
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;

      // 3. Session Logs
      doc.setFontSize(11);
      doc.text('SESSION LOGS', 14, currentY);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Time', 'Client', 'Service', 'Total', 'Settlement', 'Providers', 'ROI']],
        body: txs.map(t => {
          const therapistComm = Number(t.primaryCommission) || 0;
          const bonesetterComm = Number(t.secondaryCommission) || 0;
          const sessionDeduction = Number(t.deduction) || 0;
          const netTotal = (Number(t.basePrice) - (Number(t.discount) || 0));
          const netRoi = (netTotal - therapistComm - bonesetterComm + sessionDeduction);

          let providers = '';
          if (t.therapistName) providers += `T: ${t.therapistName} (P${therapistComm})`;
          if (t.bonesetterName) providers += `${providers ? '\n' : ''}B: ${t.bonesetterName} (P${bonesetterComm})`;

          const settlement = `${t.paymentMethod || 'CASH'} (${t.paymentStatus || 'VERIFIED'})`;

          return [
            new Date(t.timestamp.replace(/(\+00:00|Z)$/, "")).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            (t.clientName || '').toUpperCase(),
            (t.serviceName || '').toUpperCase(),
            `PHP ${netTotal.toLocaleString()}`,
            settlement.toUpperCase(),
            providers,
            `PHP ${netRoi.toLocaleString()}`
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        styles: { fontSize: 7 },
        columnStyles: {
          3: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' }
        },
        rowPageBreak: 'avoid'
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Check for page overflow
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // 4. Staff Performance
      doc.setFontSize(11);
      doc.text('STAFF PERFORMANCE MATRIX', 14, currentY);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Employee', 'Sessions', 'Base Pay', 'Late', 'OT', 'Advance', 'Final Pay']],
        body: Object.entries(metrics.staffSummary).map(([name, data]: [string, any]) => {
          const late = Number(data.attendance?.lateDeduction || 0);
          const ot = Number(data.attendance?.otPay || 0);
          const adv = Number(data.attendance?.cashAdvance || 0);
          const finalPay = data.commission + data.allowance + ot - late;

          return [
            name.toUpperCase(),
            Number(data.count || 0),
            `PHP ${(data.commission + data.allowance).toLocaleString()}`,
            `-PHP ${late.toLocaleString()}`,
            `+PHP ${ot.toLocaleString()}`,
            `PHP ${adv.toLocaleString()}`,
            `PHP ${finalPay.toLocaleString()}`
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        styles: { fontSize: 8 },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' }
        },
        rowPageBreak: 'avoid'
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // 5. Vault & Expenses
      doc.setFontSize(11);
      doc.text('VAULT & OPERATIONAL OUTFLOWS', 14, currentY);

      const vaultBody = exps.filter(e => e.category === 'PROVISION').map(e => [
        (e.name || '').toUpperCase(),
        'VAULT CONTRIBUTION',
        `+PHP ${Number(e.amount || 0).toLocaleString()}`
      ]);

      const expenseBody = exps.filter(e => e.category === 'OPERATIONAL').map(e => [
        (e.name || '').toUpperCase(),
        'OPERATIONAL EXPENSE',
        `-PHP ${Number(e.amount || 0).toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Item', 'Category', 'Amount']],
        body: [...vaultBody, ...expenseBody],
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        styles: { fontSize: 8 },
        columnStyles: {
          2: { halign: 'right', fontStyle: 'bold' }
        },
        rowPageBreak: 'avoid'
      });

      doc.save(`DAILY_REPORT_${branch.name.replace(/\s+/g, '_')}_${todayStr}.pdf`);
      playSound('success');
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('Failed to generate PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto px-4">
        <KPISkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-32 max-w-7xl mx-auto relative">
        {/* Print Only Header */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{branch.name}</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Daily Operational Ledger</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold uppercase tracking-tight text-slate-900">{new Date(todayStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Generated: {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-row justify-between items-center no-print px-2 mb-2">
          {/* SYNC STATUS LEGEND */}
          <div className="flex-1">
            {(connStatus === 'offline' || autoSyncStatus === 'saving' || showSynced) && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-500 shadow-sm ${connStatus === 'offline' ? 'bg-rose-50 border-rose-100 shadow-rose-50' : 'bg-emerald-50 border-emerald-100 shadow-emerald-50'}`}>
                <div className="relative">
                  {connStatus === 'offline' ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]"></div>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
                  )}
                </div>
                <div className="w-px h-2.5 bg-slate-200"></div>
                <span className={`text-[8px] font-black uppercase tracking-widest tabular-nums ${connStatus === 'offline' ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {connStatus === 'offline' 
                    ? `OFFLINE: ${pendingSyncCount} PENDING RELAY` 
                    : autoSyncStatus === 'saving' 
                      ? 'SAVING...' 
                      : 'SYNCED'}
                </span>
              </div>
            )}
          </div>

          <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className={`flex items-center gap-1.5 px-4 py-2 bg-white text-slate-500 border border-slate-200 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95 shrink-0 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isExporting ? (
                <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
            ) : (
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2-0 01-2-2V5a2 2-0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2-0 01-2 2z" /></svg>
            )}
            {isExporting ? 'Exporting...' : 'Save PDF'}
          </button>
        </div>

        <div className="space-y-6 print:hidden">
          {toast && (
              <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full shadow-2xl animate-in slide-in-from-top-6 duration-300 font-black text-[11px] uppercase tracking-[0.1em] bg-slate-900 text-white border border-white/10 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`}></div>
                {toast.message}
              </div>
          )}

          {expenseToDelete && (
              <div className={UI_THEME.layout.modalWrapper}>
                <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-10 text-center border border-slate-100`}>
                  <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Scrub Record?</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                    AUTHORIZED DATA SCRUB: Permanently remove {expenseToDelete.name} (₱{expenseToDelete.amount.toLocaleString()}) from node registry?
                  </p>
                  <div className="flex flex-col gap-4 mt-10">
                    <button
                        onClick={handleFinalDeleteExpense}
                        disabled={isDeleting}
                        className="w-full bg-rose-600 text-white font-black py-5 rounded-2xl text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      {isDeleting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'Authorize Erasure'}
                    </button>
                    <button
                        onClick={() => setExpenseToDelete(null)}
                        disabled={isDeleting}
                        className="w-full text-slate-400 font-black py-4 rounded-xl text-[12px] uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
          )}

          {isAddExpenseModalOpen && (<QuickExpenseModal branch={branch} todayStr={todayStr} onClose={() => setIsAddExpenseModalOpen(false)} onRefresh={onRefresh} />)}
          {viewingExpense && (<ExpenseDetailModal expense={viewingExpense} onClose={() => setViewingExpense(null)} />)}

          {showPDFConfirm && (
            <div className={UI_THEME.layout.modalWrapper}>
              <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-10 text-center border border-slate-100`}>
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2-0 01-2-2V5a2 2-0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2-0 01-2 2z" /></svg>
                </div>
                <h4 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Export to PDF?</h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                  Generate and download the daily operational ledger for {branch.name}?
                </p>
                <div className="flex flex-col gap-4 mt-10">
                  <button
                    onClick={() => handleExportPDF(true)}
                    className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    Confirm Export
                  </button>
                  <button
                    onClick={() => setShowPDFConfirm(false)}
                    className="w-full text-slate-400 font-black py-4 rounded-xl text-[12px] uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <SalesKPIStrip
              gross={metrics.gross}
              operationalExp={metrics.operationalExp}
              finalStaffPayTotal={metrics.totalStaffLiability}
              provisionExp={metrics.provisionExp}
              net={metrics.net}
              totalAllowances={metrics.totalAllowances}
              otAdditions={metrics.otAdditions}
              lateDeductions={metrics.lateDeductions}
              totalCashAdvances={metrics.totalCashAdvances}
              connStatus={connStatus}
              pendingSyncCount={pendingSyncCount}
          />
          <SessionLogs transactions={txs} />
          <StaffPerformance
              branch={branch}
              staffSummary={metrics.staffSummary}
              hiddenRosterStaff={hiddenRosterStaff}
              handleHideStaff={handleHideStaff}
              handleRestoreStaff={handleRestoreStaff}
              onRefresh={onRefresh}
              todayStr={todayStr}
              transactions={txs}
          />
          <VaultExpenses
              vaultContributions={exps.filter(e => e.category === 'PROVISION')}
              operationalLogs={exps.filter(e => e.category === 'OPERATIONAL')}
              provisionTotal={metrics.provisionExp}
              operationalTotal={metrics.operationalExp}
              handleAddDailyProvision={handleAddDailyProvision}
              setIsAddExpenseModalOpen={setIsAddExpenseModalOpen}
              setViewingExpense={setViewingExpense}
              isClosedMode={isClosedMode}
              onDeleteExpense={handleDeleteExpenseTrigger}
          />
        </div>

        {/* PRINT ONLY TABLE VIEW */}
        <div className="hidden print:block space-y-8">
          {/* KPI SUMMARY TABLE */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Financial Summary</h4>
            <table className="w-full border-collapse border border-slate-200 text-[11px]">
              <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-4 py-2 text-left uppercase tracking-widest">Metric</th>
                <th className="border border-slate-200 px-4 py-2 text-right uppercase tracking-widest">Amount</th>
              </tr>
              </thead>
              <tbody>
              <tr>
                <td className="border border-slate-200 px-4 py-2 font-bold uppercase">Gross Sales</td>
                <td className="border border-slate-200 px-4 py-2 text-right font-bold tabular-nums">₱{metrics.gross.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-4 py-2 font-bold uppercase text-rose-600">Operational Expenses</td>
                <td className="border border-slate-200 px-4 py-2 text-right font-bold tabular-nums text-rose-600">₱{metrics.operationalExp.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-4 py-2 font-bold uppercase text-amber-600">Staff Payroll</td>
                <td className="border border-slate-200 px-4 py-2 text-right font-bold tabular-nums text-amber-600">₱{metrics.totalStaffLiability.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-4 py-2 font-bold uppercase text-indigo-600">Rent & Bills</td>
                <td className="border border-slate-200 px-4 py-2 text-right font-bold tabular-nums text-indigo-600">₱{metrics.provisionExp.toLocaleString()}</td>
              </tr>
              <tr className="bg-slate-900 text-white">
                <td className="border border-slate-900 px-4 py-2 font-black uppercase tracking-widest">Net ROI</td>
                <td className="border border-slate-900 px-4 py-2 text-right font-black tabular-nums">₱{metrics.net.toLocaleString()}</td>
              </tr>
              </tbody>
            </table>
          </div>

          {/* SESSION LOGS TABLE */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Session Logs</h4>
            <table className="w-full border-collapse border border-slate-200 text-[9px]">
              <thead>
              <tr className="bg-slate-50 font-bold uppercase tracking-widest">
                <th className="border border-slate-200 px-2 py-1.5 text-left">Time</th>
                <th className="border border-slate-200 px-2 py-1.5 text-left">Client</th>
                <th className="border border-slate-200 px-2 py-1.5 text-left">Service</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">Total</th>
                <th className="border border-slate-200 px-2 py-1.5 text-left">Settlement</th>
                <th className="border border-slate-200 px-2 py-1.5 text-left">Providers</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right">ROI</th>
              </tr>
              </thead>
              <tbody>
              {txs.map((t: any) => {
                const therapistComm = Number(t.primaryCommission) || 0;
                const bonesetterComm = Number(t.secondaryCommission) || 0;
                const sessionDeduction = Number(t.deduction) || 0;
                const netTotal = (Number(t.basePrice) - (Number(t.discount) || 0));
                const netRoi = (netTotal - therapistComm - bonesetterComm + sessionDeduction);
                return (
                    <tr key={t.id}>
                      <td className="border border-slate-200 px-2 py-1.5 tabular-nums">
                        {new Date(t.timestamp.replace(/(\+00:00|Z)$/, "")).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 font-bold uppercase">{t.clientName}</td>
                      <td className="border border-slate-200 px-2 py-1.5 uppercase leading-tight">{t.serviceName}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">₱{netTotal.toLocaleString()}</td>
                      <td className="border border-slate-200 px-2 py-1.5 uppercase text-[8px]">
                        {t.paymentMethod || 'CASH'} ({t.paymentStatus || 'VERIFIED'})
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 uppercase text-[8px]">
                        {t.therapistName && <div>T: {t.therapistName} (₱{therapistComm})</div>}
                        {t.bonesetterName && <div>B: {t.bonesetterName} (₱{bonesetterComm})</div>}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-bold tabular-nums">₱{netRoi.toLocaleString()}</td>
                    </tr>
                );
              })}
              </tbody>
            </table>
          </div>

          {/* STAFF PERFORMANCE TABLE */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Staff Performance Matrix</h4>
            <table className="w-full border-collapse border border-slate-200 text-[10px]">
              <thead>
              <tr className="bg-slate-50 font-bold uppercase tracking-widest">
                <th className="border border-slate-200 px-3 py-2 text-left">Employee</th>
                <th className="border border-slate-200 px-3 py-2 text-center">Sessions</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Base Pay</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Late</th>
                <th className="border border-slate-200 px-3 py-2 text-right">OT</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Advance</th>
                <th className="border border-slate-200 px-3 py-2 text-right font-black">Final Pay</th>
              </tr>
              </thead>
              <tbody>
              {Object.entries(metrics.staffSummary).map(([name, data]: [string, any]) => {
                const late = Number(data.attendance?.lateDeduction || 0);
                const ot = Number(data.attendance?.otPay || 0);
                const adv = Number(data.attendance?.cashAdvance || 0);
                const finalPay = data.commission + data.allowance + ot - late;
                return (
                    <tr key={name}>
                      <td className="border border-slate-200 px-3 py-2 font-bold uppercase">{name}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">{data.count}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">₱{(data.commission + data.allowance).toLocaleString()}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-rose-600">-₱{late.toLocaleString()}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-emerald-600">+₱{ot.toLocaleString()}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-indigo-600">₱{adv.toLocaleString()}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right font-black tabular-nums">₱{finalPay.toLocaleString()}</td>
                    </tr>
                );
              })}
              </tbody>
            </table>
          </div>

          {/* VAULT & EXPENSES TABLES */}
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vault Archive</h4>
              <table className="w-full border-collapse border border-slate-200 text-[9px]">
                <thead>
                <tr className="bg-slate-50 font-bold uppercase tracking-widest">
                  <th className="border border-slate-200 px-2 py-1.5 text-left">Item</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-right">Amount</th>
                </tr>
                </thead>
                <tbody>
                {exps.filter(e => e.category === 'PROVISION').map((e: any) => (
                    <tr key={e.id}>
                      <td className="border border-slate-200 px-2 py-1.5 font-bold uppercase">{e.name}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-bold tabular-nums text-emerald-600">+₱{Number(e.amount || 0).toLocaleString()}</td>
                    </tr>
                ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Operational Outflows</h4>
              <table className="w-full border-collapse border border-slate-200 text-[9px]">
                <thead>
                <tr className="bg-slate-50 font-bold uppercase tracking-widest">
                  <th className="border border-slate-200 px-2 py-1.5 text-left">Expense</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-right">Amount</th>
                </tr>
                </thead>
                <tbody>
                {exps.filter(e => e.category === 'OPERATIONAL').map((e: any) => (
                    <tr key={e.id}>
                      <td className="border border-slate-200 px-2 py-1.5 font-bold uppercase">{e.name}</td>
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-bold tabular-nums text-rose-600">₱{Number(e.amount || 0).toLocaleString()}</td>
                    </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
  );
};