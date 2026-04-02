
import React, { useState, useRef, useMemo } from 'react';
import { Expense } from '../../../../types';
import { playSound } from '../../../../lib/audio';

import { UI_THEME } from '../../../../constants/ui_designs';

interface VaultExpensesProps {
  vaultContributions: Expense[];
  operationalLogs: Expense[];
  provisionTotal: number;
  operationalTotal: number;
  handleAddDailyProvision: () => void;
  setIsAddExpenseModalOpen: (open: boolean) => void;
  setViewingExpense: (expense: Expense | null) => void;
  isClosedMode?: boolean;
  onDeleteExpense: (id: string) => void;
}

export const VaultExpenses: React.FC<VaultExpensesProps> = ({
                                                              vaultContributions,
                                                              operationalLogs,
                                                              provisionTotal,
                                                              operationalTotal,
                                                              handleAddDailyProvision,
                                                              setIsAddExpenseModalOpen,
                                                              setViewingExpense,
                                                              isClosedMode = false,
                                                              onDeleteExpense
                                                            }) => {
  const [revealedDeleteId, setRevealedDeleteId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = (id: string) => {
    if (isClosedMode) return;
    longPressTimer.current = setTimeout(() => {
      setRevealedDeleteId(id);
      playSound('click');
      longPressTimer.current = null;
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const renderExpenseItem = (e: Expense) => {
    const isRevealed = revealedDeleteId === e.id;
    const isProvision = e.category === 'PROVISION';

    return (
        <div
            key={e.id}
            className="relative"
            onTouchStart={() => startLongPress(e.id)}
            onTouchEnd={cancelLongPress}
            onMouseDown={() => startLongPress(e.id)}
            onMouseUp={cancelLongPress}
            onMouseLeave={() => { cancelLongPress(); setRevealedDeleteId(null); }}
        >
          <div
              onClick={() => { if (!isRevealed) { playSound('click'); setViewingExpense(e); } }}
              className={`bg-white p-4 rounded-[22px] border transition-all duration-300 cursor-pointer group active:scale-[0.98] flex items-center justify-between shadow-sm ${isRevealed ? 'border-rose-500 translate-x-[-4px]' : 'border-slate-100 hover:border-slate-300'}`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner border border-slate-100 transition-all duration-300 ${isProvision ? 'bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-slate-50 text-slate-300 group-hover:bg-rose-600 group-hover:text-white'}`}>
                {isProvision ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                )}
              </div>
              <div className="overflow-hidden">
                <p className={`text-[12px] font-bold uppercase truncate leading-none mb-1.5 transition-colors ${isRevealed ? 'text-rose-600' : 'text-slate-900'}`}>{e.name}</p>
                <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest leading-none tabular-nums">
                  {(() => {
                    // Treat the timestamp as local by removing UTC indicator
                    const date = new Date(e.timestamp.replace(/(\+00:00|Z)$/, ""));
                    return date.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });
                  })()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <p className={`text-sm font-bold tabular-nums transition-colors ${isRevealed ? 'text-rose-600' : 'text-slate-900'}`}>₱{e.amount.toLocaleString()}</p>

              {/* DESKTOP HOVER DELETE BUTTON */}
              <button
                  onClick={(evt) => { evt.stopPropagation(); onDeleteExpense(e.id); }}
                  className={`hidden lg:flex p-2 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 active:scale-90`}
                  title="Scrub record"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>

              {/* MOBILE REVEALED DELETE BUTTON */}
              {isRevealed && (
                  <button
                      onClick={(evt) => { evt.stopPropagation(); onDeleteExpense(e.id); }}
                      className="lg:hidden p-2.5 rounded-lg bg-rose-600 text-white shadow-lg animate-in zoom-in duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
              )}
            </div>
          </div>
        </div>
    );
  };

  return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full px-1 items-start">
        {/* VAULT SECTION (RESERVE POOL) */}
        <div className="flex flex-col w-full space-y-4">
          <div className="flex justify-between items-center px-4 h-10">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-pulse"></div>
              <div>
                <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest leading-none">Rent & Bills</h4>
                <p className="text-[7px] font-semibold text-slate-400 uppercase tracking-widest mt-1">Rent & Utility Audit</p>
              </div>
            </div>
            <div className="bg-slate-800 px-3 py-1.5 rounded-xl shadow-lg border border-white/5">
              <span className="text-[11px] font-bold text-emerald-400 tabular-nums">₱{provisionTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col w-full space-y-3">
            <div className="w-full min-h-[140px]">
              {vaultContributions.length > 0 ? (
                  <div className="space-y-2">
                    {vaultContributions.map(renderExpenseItem)}
                  </div>
              ) : (
                  <div className={`h-[140px] w-full text-center bg-slate-50/30 ${UI_THEME.radius.card} border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-3 opacity-20`}>
                    <div className="text-3xl grayscale">🏦</div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rent & Bills Pool</p>
                  </div>
              )}
            </div>

            <button
                onClick={handleAddDailyProvision}
                disabled={isClosedMode}
                className={`w-full bg-white border-2 border-dashed ${UI_THEME.radius.card} p-4 flex items-center justify-center gap-4 transition-all group active:scale-[0.98] shadow-sm no-print ${isClosedMode ? 'border-slate-100 opacity-60 grayscale cursor-not-allowed' : 'border-slate-200 hover:border-slate-900 hover:bg-slate-50'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-inner text-lg leading-none ${isClosedMode ? 'bg-slate-50 text-slate-200' : 'bg-slate-50 text-slate-300 group-hover:bg-slate-900 group-hover:text-white'}`}>
                {isClosedMode ? '🔒' : '+'}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isClosedMode ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-900'}`}>
                {isClosedMode ? 'Initialize Opening First' : 'Daily Deposit'}
            </span>
            </button>
          </div>
        </div>

        {/* OPERATIONAL SECTION (PETTY CASH) */}
        <div className="flex flex-col w-full space-y-4">
          <div className="flex justify-between items-center px-4 h-10">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse"></div>
              <div>
                <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest leading-none">Expense</h4>
                <p className="text-[7px] font-semibold text-slate-400 uppercase tracking-widest mt-1">Operational Outflows Today</p>
              </div>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-rose-600 tabular-nums">₱{operationalTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col w-full space-y-3">
            <div className="w-full min-h-[140px]">
              {operationalLogs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {operationalLogs.map(renderExpenseItem)}
                  </div>
              ) : (
                  <div className={`h-[140px] w-full text-center bg-slate-50/20 ${UI_THEME.radius.card} border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-3 grayscale opacity-10`}>
                    <div className="text-3xl">🧾</div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Expense</p>
                  </div>
              )}
            </div>

            <button
                onClick={() => setIsAddExpenseModalOpen(true)}
                disabled={isClosedMode}
                className={`w-full bg-white border-2 border-dashed ${UI_THEME.radius.card} p-4 flex items-center justify-center gap-4 transition-all group active:scale-[0.98] shadow-sm no-print ${isClosedMode ? 'border-slate-100 opacity-60 grayscale cursor-not-allowed' : 'border-slate-200 hover:border-rose-500 hover:bg-rose-50/10'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-inner text-lg leading-none ${isClosedMode ? 'bg-slate-50 text-slate-200' : 'bg-slate-50 text-slate-300 group-hover:bg-rose-600 group-hover:text-white'}`}>
                {isClosedMode ? '🔒' : '+'}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isClosedMode ? 'text-slate-300' : 'text-slate-400 group-hover:text-rose-700'}`}>
                {isClosedMode ? 'Open Branch to Record' : 'Record expense'}
            </span>
            </button>
          </div>
        </div>
      </div>
  );
};
