import React, { useState } from 'react';
import { Branch, Expense, SalesReport, Terminology } from '../../../types';
import { ExpensesSection } from './ExpensesSection';
import { MonthlyExpenseSection } from './MonthlyExpenseSection';
import { ExpensesHub } from '../../superadmin/ExpensesHub';
import { UI_THEME } from '../../../constants/ui_designs';
import { playSound } from '../../../lib/audio';

interface ExpensesManagerSectionProps {
  branch: Branch;
  expenses: Expense[];
  salesReports: SalesReport[];
  isClosedMode?: boolean;
  onRefresh?: () => void;
  onSyncStatusChange?: (isSyncing: boolean) => void;
  terminology: Terminology;
}

type SubTab = 'daily' | 'provision';

export const ExpensesManagerSection: React.FC<ExpensesManagerSectionProps> = (props) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('daily');
  const [searchTerm, setSearchTerm] = useState('');

  const handleTabChange = (tab: SubTab) => {
    playSound('click');
    setActiveSubTab(tab);
  };

  return (
      <div className={`space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-12 w-full`}>
        {/* UNIFORM HEADER SECTION */}
        <div className={`bg-white p-4 sm:p-6 md:p-8 ${UI_THEME.radius.card} shadow-sm border border-slate-100 flex flex-col gap-4 sm:gap-6 md:gap-8`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-900 text-white rounded-2xl sm:rounded-3xl flex items-center justify-center text-xl sm:text-2xl shadow-xl border border-white/5 shrink-0">💸</div>
              <div className="space-y-0.5 sm:space-y-1 overflow-hidden">
                <h2 className="text-lg sm:text-2xl font-bold text-slate-900 uppercase tracking-tighter leading-none truncate">{props.branch.name.replace('BRANCH - ', '')}</h2>
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.4em] truncate">Expense Management Hub</p>
              </div>
            </div>
          </div>

          <div className="relative group">
            <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search expense records..."
                className="w-full pl-10 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-5 bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-[24px] font-bold text-[11px] sm:text-[12px] uppercase tracking-widest outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner placeholder:text-slate-300"
            />
            <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors">
              <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
        </div>

        {/* SUB-NAVIGATION */}
        <div className="px-2 sm:px-0 overflow-x-auto no-scrollbar">
          <div className="grid grid-cols-2 sm:flex sm:flex-nowrap p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-[24px] border border-slate-200/50 shadow-inner gap-1">
            <button
                onClick={() => handleTabChange('daily')}
                className={`px-4 sm:px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 ${
                    activeSubTab === 'daily'
                        ? 'bg-white text-slate-900 shadow-md scale-[1.02]'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              <span className="text-[9px] sm:text-[10px]">Daily expenses</span>
            </button>
            <button
                onClick={() => handleTabChange('provision')}
                className={`px-4 sm:px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap flex items-center justify-center gap-2 ${
                    activeSubTab === 'provision'
                        ? 'bg-white text-slate-900 shadow-md scale-[1.02]'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              <span className="text-[9px] sm:text-[10px]">Rent & Bills</span>
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="transition-all duration-300">
          {activeSubTab === 'daily' && (
              <ExpensesSection
                  branch={props.branch}
                  expenses={props.expenses}
                  isClosedMode={props.isClosedMode}
                  onRefresh={props.onRefresh}
                  onSyncStatusChange={props.onSyncStatusChange}
                  terminology={props.terminology}
                  fixedCategory="OPERATIONAL"
                  externalSearchTerm={searchTerm}
              />
          )}
          {activeSubTab === 'provision' && (
              <ExpensesSection
                  branch={props.branch}
                  expenses={props.expenses}
                  isClosedMode={props.isClosedMode}
                  onRefresh={props.onRefresh}
                  onSyncStatusChange={props.onSyncStatusChange}
                  terminology={props.terminology}
                  fixedCategory="PROVISION"
                  externalSearchTerm={searchTerm}
              />
          )}
        </div>
      </div>
  );
};
