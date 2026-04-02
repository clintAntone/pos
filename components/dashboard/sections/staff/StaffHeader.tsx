import React from 'react';
import { UI_THEME } from '../../../../constants/ui_designs';

interface StaffHeaderProps {
  branchName: string;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onAddStaff: () => void;
  onExportPDF: () => void;
  showFilters: boolean;
  setShowFilters: (val: boolean) => void;
  isExporting: boolean;
  hasActiveFilters: boolean;
}

export const StaffHeader: React.FC<StaffHeaderProps> = ({
                                                          branchName,
                                                          searchTerm,
                                                          onSearchChange,
                                                          onAddStaff,
                                                          onExportPDF,
                                                          showFilters,
                                                          setShowFilters,
                                                          isExporting,
                                                          hasActiveFilters
                                                        }) => {
  return (
      <div className={`bg-white p-4 sm:p-6 md:p-8 ${UI_THEME.radius.card} shadow-sm border border-slate-100 flex flex-col gap-4 sm:gap-6 md:gap-8`}>
        {/* IDENTITY ROW + ACTION BUTTON */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-900 text-white rounded-2xl sm:rounded-3xl flex items-center justify-center text-xl sm:text-2xl shadow-xl border border-white/5 shrink-0">🏢</div>
            <div className="space-y-0.5 sm:space-y-1 overflow-hidden">
              <h2 className="text-lg sm:text-2xl font-bold text-slate-900 uppercase tracking-tighter leading-none truncate">{branchName}</h2>
              <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.4em] truncate">Personnel Directory</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
                onClick={onExportPDF}
                disabled={isExporting}
                className={`h-10 sm:h-14 px-4 sm:px-6 rounded-xl sm:rounded-[24px] bg-slate-50 text-slate-400 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all active:scale-95 ${isExporting ? 'opacity-50' : ''}`}
                title="Export PDF"
            >
              {isExporting ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
              ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              )}
              <span className="hidden lg:inline">Export</span>
            </button>

            <button
                onClick={onAddStaff}
                className="h-10 sm:h-14 px-4 sm:px-10 bg-slate-900 text-white rounded-xl sm:rounded-[24px] font-bold text-[10px] sm:text-[11px] uppercase tracking-widest shadow-xl hover:bg-emerald-600 transition-all active:scale-95 shrink-0 whitespace-nowrap flex items-center justify-center gap-2"
            >
              <span className="text-lg sm:hidden">+</span>
              <span className="hidden sm:inline">Add Staff</span>
            </button>
          </div>
        </div>

        {/* SEARCH + FILTER ROW */}
        <div className="flex flex-row items-center gap-2 sm:gap-4">
          <div className="relative group flex-1">
            <input
                value={searchTerm}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Filter roster..."
                className="w-full pl-10 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-5 bg-slate-50 border-2 border-transparent rounded-xl sm:rounded-[24px] font-bold text-[11px] sm:text-[12px] uppercase tracking-widest outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner placeholder:text-slate-300"
            />
            <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors">
              <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>

          <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 sm:h-14 px-4 sm:px-8 rounded-xl sm:rounded-[24px] border-2 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${showFilters ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-600 border-slate-100 hover:border-emerald-500 hover:text-emerald-600'}`}
          >
            <svg className={`w-4 h-4 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M19 9l-7 7-7-7" /></svg>
            <span className="hidden sm:inline">{showFilters ? 'Hide Filters' : 'Filters'}</span>
            {hasActiveFilters && !showFilters && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
          </button>
        </div>
      </div>
  );
};
