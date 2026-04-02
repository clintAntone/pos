
import React, { useRef, useEffect, useState } from 'react';
import { UI_THEME } from '../../../../constants/ui_designs';
import { playSound } from '../../../../lib/audio';
import { parseDate } from '@/src/utils/reportUtils';

interface CustomSelectProps {
  id: string;
  label: string;
  value: string;
  options: { val: string; label: string }[];
  onSelect: (val: string) => void;
  activeId: string | null;
  setActive: (id: string | null) => void;
  icon: React.ReactNode;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ id, label, value, options, onSelect, activeId, setActive, icon }) => {
  const isOpen = activeId === id;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActive(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, setActive]);

  return (
      <div className="relative flex-1" ref={containerRef}>
        <button
            onClick={() => { playSound('click'); setActive(isOpen ? null : id); }}
            className={`w-full flex items-center justify-between pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 ${UI_THEME.radius.card} transition-all duration-300 relative group/btn min-h-[72px] ${isOpen ? 'border-emerald-500 bg-white shadow-lg ring-4 ring-emerald-500/5' : 'hover:border-slate-300 shadow-sm'}`}
        >
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isOpen ? 'text-emerald-500' : 'text-slate-400'}`}>
            {icon}
          </div>
          <div className="flex flex-col items-start min-w-0 pr-3 gap-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">{label}</p>
            <p className="font-bold text-[14px] text-slate-900 uppercase tracking-tight truncate w-full leading-none">{value}</p>
          </div>
          <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M19 9l-7 7-7-7" /></svg>
        </button>

        {isOpen && (
            <div className={`absolute z-[110] top-[calc(100%+8px)] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[340px] overflow-y-auto no-scrollbar ring-1 ring-slate-900/5 p-2`}>
              {options.map((opt) => {
                const isSelected = value === opt.label || (value === 'Every Year' && opt.val === 'all') || (value === 'Entire Season' && opt.val === 'all');
                return (
                    <button
                        key={opt.val}
                        onClick={() => { onSelect(opt.val); setActive(null); playSound('click'); }}
                        className={`w-full text-left px-5 py-4 text-xs font-bold uppercase tracking-wider transition-all rounded-xl mb-1 last:mb-0 flex items-center justify-between ${isSelected ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      {opt.label}
                      {isSelected && <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7"/></svg>}
                    </button>
                );
              })}
            </div>
        )}
      </div>
  );
};

interface ReportFiltersProps {
  view: string;
  setView: (val: any) => void;
  activeDropdown: string | null;
  setActiveDropdown: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
                                                              view, setView,
                                                              activeDropdown, setActiveDropdown,
                                                              searchQuery, setSearchQuery,
                                                              startDate, setStartDate,
                                                              endDate, setEndDate
                                                            }) => {
  const [showFilters, setShowFilters] = useState(false);
  const isFiltered = searchQuery || startDate || endDate;

  return (
      <div className={`bg-white ${UI_THEME.layout.cardPadding} ${UI_THEME.radius.card} shadow-sm border border-slate-200 space-y-6 no-print`}>
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tighter">Report Analytics</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Configure Data Parameters</p>
            </div>
          </div>
        </div>

        {/* SEARCH + FILTER TOGGLE ROW */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1 group">
            <div
                className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors">
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                   strokeWidth="2.5">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input
                type="text"
                placeholder="SEARCH REPORTS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 md:pl-14 pr-4 md:pr-6 py-3.5 md:py-4 bg-slate-50 border border-slate-200 rounded-[24px] text-[11px] md:text-[13px] font-bold uppercase tracking-widest focus:bg-white focus:border-emerald-500 focus:ring-8 focus:ring-emerald-500/5 transition-all outline-none shadow-inner placeholder:text-slate-300"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[24px] border border-slate-200 shadow-inner">
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2-0 002-2V7a2 2-0 00-2-2H5a2 2-0 00-2-2V12a2 2-0 002 2z"/>
                </svg>
              </div>
              <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); playSound('click'); }}
                  className="pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-tight focus:border-emerald-500 outline-none cursor-pointer shadow-sm min-h-[40px] appearance-none"
              />
            </div>
            <div className="text-slate-300 font-black text-[10px]">TO</div>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2-0 002-2V7a2 2-0 00-2-2H5a2 2-0 00-2-2V12a2 2-0 002 2z"/>
                </svg>
              </div>
              <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); playSound('click'); }}
                  className="pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-tight focus:border-emerald-500 outline-none cursor-pointer shadow-sm min-h-[40px] appearance-none"
              />
            </div>
          </div>

          <button
              onClick={() => { setShowFilters(!showFilters); playSound('click'); }}
              className={`flex items-center gap-2 px-4 py-2.5 md:py-4 rounded-[24px] border transition-all text-[10px] font-black uppercase tracking-widest shrink-0 ${showFilters ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-500 hover:text-emerald-600'}`}
          >
            <svg className={`w-4 h-4 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M19 9l-7 7-7-7" /></svg>
            <span className="hidden sm:inline">{showFilters ? 'Hide Views' : 'View Options'}</span>
          </button>
        </div>

        {showFilters && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col lg:flex-row items-stretch gap-4 md:gap-6">
                <div className="relative flex-1">
                  <div
                      className="w-full bg-slate-100 p-1 rounded-[20px] md:rounded-[24px] flex items-center shadow-inner border border-slate-200/80 h-full">
                    {['daily', 'weekly', 'monthly'].map(v => (
                        <button
                            key={v}
                            onClick={() => {
                              setView(v);
                              playSound('click');
                            }}
                            className={`flex-1 px-4 py-2.5 md:px-6 md:py-4 rounded-[16px] md:rounded-[20px] text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${view === v ? 'bg-white text-slate-900 shadow-lg scale-[1.02] border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {v}
                        </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
  );
};
