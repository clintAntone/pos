import React, { useState, useMemo, useRef } from 'react';
import { Branch, Attendance, Employee, Transaction } from '../../../../types';
import { DB_TABLES, DB_COLUMNS } from '../../../../constants/db_schema';
import { supabase } from '../../../../lib/supabase';
import { playSound } from '../../../../lib/audio';

import { UI_THEME } from '../../../../constants/ui_designs';

interface StaffPerformanceProps {
  branch: Branch;
  staffSummary: Record<string, any>;
  hiddenRosterStaff: Employee[];
  handleHideStaff: (name: string) => void;
  handleRestoreStaff: (name: string) => void;
  onRefresh?: () => void;
  todayStr: string;
  transactions: Transaction[];
}

export const StaffPerformance: React.FC<StaffPerformanceProps> = ({
                                                                    branch,
                                                                    staffSummary,
                                                                    hiddenRosterStaff,
                                                                    handleHideStaff,
                                                                    handleRestoreStaff,
                                                                    onRefresh,
                                                                    todayStr,
                                                                    transactions
                                                                  }) => {
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [showAddStaffSelector, setShowAddStaffSelector] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [revealedDeleteId, setRevealedDeleteId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [attendanceForm, setAttendanceForm] = useState({
    lateDeduction: 0,
    otPay: 0,
    cashAdvance: 0,
    allowance: 0
  });

  // CRITICAL: Check lateness using Manila Time comparison to avoid browser timezone drift
  const isLate = (clockInStr?: string) => {
    if (!clockInStr || !branch.openingTime) return false;

    const clockInDate = new Date(clockInStr);
    const manilaClockIn = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(clockInDate);

    const [clockH, clockM] = manilaClockIn.split(':').map(Number);
    const [openH, openM] = branch.openingTime.split(':').map(Number);

    const totalClockMins = clockH * 60 + clockM;
    const totalOpenMins = openH * 60 + openM;

    // LATE means clocking in > 10 minutes after opening hour
    return totalClockMins > (totalOpenMins + 10);
  };

  const sortedStaff = useMemo(() => {
    return Object.entries(staffSummary)
        .map(([name, data]) => {
          const staffData = data as any;
          const late = Number(staffData.attendance?.lateDeduction || 0);
          const ot = Number(staffData.attendance?.otPay || 0);
          // FIX: Advance is settled weekly, so it should NOT affect the Daily Performance display
          const finalPay = staffData.commission + staffData.allowance + ot - late;
          return { name, ...staffData, finalPay };
        })
        .sort((a, b) => b.finalPay - a.finalPay);
  }, [staffSummary]);

  const estimatedImpact = useMemo(() => {
    return (attendanceForm.otPay || 0) - (attendanceForm.lateDeduction || 0);
  }, [attendanceForm]);

  const handleUpdateAttendance = async () => {
    if (!selectedStaff || isSyncing) return;
    setIsSyncing(true);
    const summaryData = staffSummary[selectedStaff];
    const existingAtt = summaryData.attendance;

    const timestamp = new Date().toISOString();

    try {
      const payload = {
        [DB_COLUMNS.LATE_DEDUCTION]: attendanceForm.lateDeduction,
        [DB_COLUMNS.OT_PAY]: attendanceForm.otPay,
        [DB_COLUMNS.CASH_ADVANCE]: attendanceForm.cashAdvance
      };

      if (existingAtt) {
        const { error } = await supabase.from(DB_TABLES.ATTENDANCE).update(payload).eq(DB_COLUMNS.ID, existingAtt.id);
        if (error) throw error;
      } else {
        const newId = Math.random().toString(36).substr(2, 9);
        const { error } = await supabase.from(DB_TABLES.ATTENDANCE).insert({
          [DB_COLUMNS.ID]: newId,
          [DB_COLUMNS.BRANCH_ID]: branch.id,
          [DB_COLUMNS.EMPLOYEE_ID]: summaryData.employeeId,
          [DB_COLUMNS.STAFF_NAME]: selectedStaff,
          [DB_COLUMNS.DATE]: todayStr,
          [DB_COLUMNS.CLOCK_IN]: timestamp,
          [DB_COLUMNS.STATUS]: 'REGULAR',
          ...payload
        });
        if (error) throw error;
      }

      playSound('success');
      setSelectedStaff(null);
      onRefresh?.();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const startLongPress = (name: string, count: number) => {
    if (count > 0) return;
    longPressTimer.current = setTimeout(() => {
      setRevealedDeleteId(name);
      playSound('click');
      longPressTimer.current = null;
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const selectedStaffData = selectedStaff ? staffSummary[selectedStaff] : null;
  const staffClockIn = selectedStaffData?.attendance?.clockIn;
  const staffIsCurrentlyLate = isLate(staffClockIn);

  // VALIDATION: Staff only eligible for OT if they have a session that ended AFTER closing time (Manila Time)
  const staffHasOTSession = useMemo(() => {
    if (!selectedStaff || !branch.closingTime) return false;
    const [closeH, closeM] = branch.closingTime.split(':').map(Number);
    const totalCloseMins = closeH * 60 + closeM;

    return transactions.some(t => {
      const isThisStaff = t.therapistName?.toUpperCase() === selectedStaff.toUpperCase() ||
          t.bonesetterName?.toUpperCase() === selectedStaff.toUpperCase();
      if (!isThisStaff) return false;

      const txDate = new Date(t.timestamp);
      const manilaTx = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(txDate);

      const [txH, txM] = manilaTx.split(':').map(Number);
      const totalTxMins = txH * 60 + txM;

      return totalTxMins > totalCloseMins;
    });
  }, [selectedStaff, branch.closingTime, transactions]);

  // Rule: Must have a late session AND must not have been late clocking in
  const canAddOT = !staffIsCurrentlyLate && staffHasOTSession;

  return (
      <div className="space-y-4">
        {showAddStaffSelector && (
            <div className="fixed inset-0 z-[2000] bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4">
              <div className={`bg-white ${UI_THEME.radius.card} w-full max-w-lg shadow-2xl flex flex-col animate-in zoom-in duration-300 overflow-hidden max-h-[85vh] border border-slate-100`}>
                <div className="px-6 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Archived Roster</h4>
                  <button onClick={() => setShowAddStaffSelector(false)} className="p-2 text-slate-300 hover:text-slate-900 transition-all"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-2 no-scrollbar">
                  {hiddenRosterStaff.length > 0 ? hiddenRosterStaff.map(emp => (
                      <button key={emp.id} onClick={() => { handleRestoreStaff(emp.name); setShowAddStaffSelector(false); }} className="w-full p-4 rounded-[20px] border border-slate-100 bg-white hover:border-emerald-500 hover:bg-emerald-50/20 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-3"><span className="font-bold text-slate-700 uppercase text-[12px] tracking-tight">{emp.name}</span></div>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                      </button>
                  )) : (<div className="py-20 text-center font-bold uppercase text-[10px]">No hidden profiles</div>)}
                </div>
              </div>
            </div>
        )}

        {selectedStaff && (
            <div className="fixed inset-0 z-[2000] bg-slate-950/40 backdrop-blur-xl flex items-start sm:items-center justify-center p-4 overflow-y-auto no-scrollbar">
              <div className="bg-white rounded-[32px] sm:rounded-[44px] w-full max-w-xl shadow-2xl flex flex-col animate-in zoom-in duration-300 overflow-hidden my-auto max-h-[95vh] sm:max-h-[90vh] border border-slate-100">
                <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-lg">👤</div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tighter leading-none">{selectedStaff}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Adjustment Hub</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedStaff(null)} className="p-2 text-slate-300 hover:text-slate-900 active:scale-90 transition-colors">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 no-scrollbar">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cash Advance (₱)</label>
                        <span className="text-[8px] font-bold text-slate-300 bg-slate-50 px-2 py-0.5 rounded uppercase tracking-widest">Weekly Settlement</span>
                      </div>
                      <div className="relative group">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-300 group-focus-within:text-indigo-600">₱</span>
                        <input
                            type="number"
                            value={attendanceForm.cashAdvance || ''}
                            onChange={e => setAttendanceForm({...attendanceForm, cashAdvance: Number(e.target.value)})}
                            className="w-full p-5 pl-12 bg-slate-50 border-2 border-transparent rounded-[22px] font-bold text-xl text-indigo-900 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner tabular-nums"
                            placeholder="0"
                        />
                      </div>
                      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight ml-1">Advances are recorded for weekly audit and do not impact today's performance display.</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Late Deduction
                          (₱)</label>
                        {!staffIsCurrentlyLate && <span
                            className="text-[8px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest">On Time</span>}
                      </div>
                      <div className="relative group">
                    <span
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-300 group-focus-within:text-rose-600">₱</span>
                        <input
                            type="number"
                            value={attendanceForm.lateDeduction || ''}
                            onChange={e => setAttendanceForm({...attendanceForm, lateDeduction: Number(e.target.value)})}
                            className="w-full p-5 pl-12 bg-slate-50 border-2 border-transparent rounded-[22px] font-bold text-xl text-rose-600 outline-none focus:border-rose-500 focus:bg-white transition-all shadow-inner tabular-nums"
                            placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OT Pay Addition (₱)</label>

                      </div>
                      <div className="relative group">
                    <span
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-300 group-focus-within:text-emerald-600">₱</span>
                        <input
                            type="number"
                            value={attendanceForm.otPay || ''}
                            onChange={e => setAttendanceForm({...attendanceForm, otPay: Number(e.target.value)})}
                            className="w-full p-5 pl-12 bg-slate-50 border-2 border-transparent rounded-[22px] font-bold text-xl text-emerald-600 outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner tabular-nums"
                            placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-[32px] border border-slate-100 flex items-center justify-between bg-slate-50/50 shadow-inner">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Take-Home Impact (Daily)</p>
                      <p className={`text-2xl font-bold tracking-tighter leading-none ${estimatedImpact < 0 ? 'text-rose-600' : estimatedImpact > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {estimatedImpact < 0 ? '−' : estimatedImpact > 0 ? '+' : ''}₱{Math.abs(estimatedImpact).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-lg">📊</div>
                  </div>
                </div>

                <div className="p-6 sm:p-10 bg-slate-50 border-t border-slate-100">
                  <button
                      onClick={handleUpdateAttendance}
                      disabled={isSyncing}
                      className="w-full bg-slate-900 text-white font-bold py-6 rounded-[22px] uppercase tracking-[0.25em] text-[12px] shadow-xl hover:bg-emerald-600 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSyncing ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'Commit Adjustments'}
                  </button>
                </div>
              </div>
            </div>
        )}

        <div className="flex items-center justify-between px-4">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em]">Personnel Performance Matrix</h4>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Live Audit</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-1">
          {sortedStaff.map((data) => {
            const name = data.name;
            const late = Number(data.attendance?.lateDeduction || 0);
            const ot = Number(data.attendance?.otPay || 0);
            const adv = Number(data.attendance?.cashAdvance || 0);
            const finalPay = data.finalPay;

            const clockInTime = data.attendance?.clockIn;
            const showLateRibbon = isLate(clockInTime);

            const showOTRibbon = ot > 0;

            return (
                <div
                    key={name}
                    className={`bg-white p-5 ${UI_THEME.radius.card} border border-slate-100 flex flex-col transition-all duration-300 hover:shadow-xl hover:border-emerald-200 group relative overflow-hidden active:scale-[0.99] cursor-default`}
                    onTouchStart={(e) => startLongPress(name, data.count)}
                    onTouchEnd={cancelLongPress}
                    onMouseDown={(e) => startLongPress(name, data.count)}
                    onMouseUp={cancelLongPress}
                >
                  <div className="absolute top-0 left-0 right-0 flex justify-between px-4 pt-3 z-20 pointer-events-none">
                    {showLateRibbon && (
                        <div className="bg-rose-600 text-white text-[7px] font-bold uppercase px-2 py-0.5 rounded-full shadow-lg animate-bounce">Late</div>
                    )}
                    {showOTRibbon && (
                        <div className="bg-emerald-600 text-white text-[7px] font-bold uppercase px-2 py-0.5 rounded-full shadow-lg ml-auto animate-pulse">OT Active</div>
                    )}
                  </div>

                  {data.count === 0 && (
                      <button onClick={(e) => { e.stopPropagation(); handleHideStaff(name); }} className={`absolute top-4 right-4 w-8 h-8 rounded-full bg-white shadow-xl border border-slate-100 text-rose-500 z-[70] transition-all duration-300 ${revealedDeleteId === name ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  )}

                  <div className="flex flex-col gap-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3 overflow-hidden min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-inner shrink-0 transition-all duration-500 overflow-hidden ${data.attendance ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
                          {data.profile ? (
                              <img src={data.profile} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                              data.attendance ? '👤' : '💤'
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 uppercase text-[14px] tracking-tight truncate leading-none mb-1 group-hover:text-emerald-700 transition-colors">{name}</h3>
                        </div>
                      </div>

                      <div className="text-right min-w-0">
                        <p className={`font-bold text-slate-900 tracking-tighter leading-none tabular-nums truncate ${
                            finalPay.toLocaleString().length > 9 ? 'text-lg' :
                                finalPay.toLocaleString().length > 7 ? 'text-xl' :
                                    'text-[26px]'
                        }`}>₱{finalPay.toLocaleString()}</p>
                        <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Take Home</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Service Track</span>
                        <span className="text-[9px] font-bold text-slate-900">{data.count} units</span>
                      </div>
                      <div className="flex gap-1.5 h-1.5 px-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div
                                key={i}
                                className={`flex-1 rounded-full transition-all duration-700 ${i < data.count ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-slate-100'}`}
                            ></div>
                        ))}
                        {data.count > 10 && <div className="text-[7px] font-bold text-emerald-600 self-center">+</div>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100/50">
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Allowance</p>
                        <p className="text-[11px] font-bold text-slate-600 tabular-nums">₱{data.allowance.toLocaleString()}</p>
                      </div>
                      <div className={`p-3 rounded-2xl border transition-all ${adv > 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50/80 border-slate-100/50'}`}>
                        <p className={`text-[7px] font-bold uppercase tracking-widest mb-0.5 ${adv > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>Advances</p>
                        <p className={`text-[11px] font-bold tabular-nums ${adv > 0 ? 'text-indigo-700' : 'text-slate-300'}`}>
                          {adv > 0 ? `−₱${adv.toLocaleString()}` : '₱0'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex gap-1.5">
                        {late > 0 && <span className="text-[8px] font-bold uppercase px-2 py-1 rounded-lg border bg-rose-50 text-rose-700 border-rose-100">−₱{late} Late</span>}
                        {ot > 0 && <span className="text-[8px] font-bold uppercase px-2 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-100">+₱{ot} OT</span>}
                      </div>
                      <button
                          onClick={() => {
                            setSelectedStaff(name);
                            setAttendanceForm({ lateDeduction: late, otPay: ot, cashAdvance: adv, allowance: data.allowance });
                          }}
                          className="w-10 h-10 bg-slate-900 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg active:scale-90 flex items-center justify-center group-hover:scale-110 no-print"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
            );
          })}

          <button
              onClick={() => setShowAddStaffSelector(true)}
              className={`border-2 border-dashed border-slate-200 ${UI_THEME.radius.card} p-6 flex flex-col items-center justify-center gap-4 hover:border-emerald-500 hover:bg-emerald-50/10 transition-all min-h-[260px] group active:scale-[0.98] no-print`}
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 text-2xl shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-emerald-700">Restore Profiles</p>
              <p className="text-[8px] font-semibold text-slate-300 uppercase tracking-tight">Access Hidden Registry</p>
            </div>
          </button>
        </div>
      </div>
  );
};