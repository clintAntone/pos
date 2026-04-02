import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Branch, SalesReport } from '../../types';
import { UI_THEME } from '../../constants/ui_designs';
import { playSound, resumeAudioContext } from '../../lib/audio';

interface AnalyticsHubProps {
  branches: Branch[];
  salesReports: SalesReport[];
}

type Mode = 'heatmap' | 'comparison';

const CustomBranchDropdown: React.FC<{
  label: string;
  value: string;
  options: Branch[];
  onSelect: (id: string) => void;
  placeholder: string;
  excludeId?: string;
  colorTheme: 'indigo' | 'emerald';
}> = ({ label, value, options, onSelect, placeholder, excludeId, colorTheme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedBranch = options.find(b => b.id === value);
  const themeClasses = colorTheme === 'indigo' ? 'border-indigo-500 ring-indigo-500/5 text-indigo-600' : 'border-emerald-500 ring-emerald-500/5 text-emerald-600';
  
  return (
    <div className="relative flex-1" ref={containerRef}>
      <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{label}</p>
      <button 
        onClick={() => { playSound('click'); setIsOpen(!isOpen); }}
        className={`w-full flex items-center justify-between px-5 py-4 bg-white rounded-[24px] border transition-all duration-300 ${isOpen ? `${themeClasses} shadow-lg ring-4` : 'border-slate-100 hover:border-slate-300 shadow-sm'}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
           <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 transition-all ${selectedBranch ? (colorTheme === 'indigo' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white') : 'bg-slate-50 text-slate-300'}`}>
              {selectedBranch ? '🏢' : '🔘'}
           </div>
           <span className={`font-medium text-[10px] uppercase tracking-widest truncate ${selectedBranch ? 'text-slate-900' : 'text-slate-300'}`}>
             {selectedBranch ? selectedBranch.name.replace(/BRANCH - /i, '') : placeholder}
           </span>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
           <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[120] top-[calc(100%+8px)] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-1.5 ring-1 ring-slate-900/5">
          <div className="max-h-[240px] overflow-y-auto no-scrollbar">
            {options.map(b => (
              <button 
                key={b.id}
                disabled={b.id === excludeId}
                onClick={() => { onSelect(b.id); setIsOpen(false); playSound('click'); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all mb-1 last:mb-0 flex items-center justify-between ${value === b.id ? (colorTheme === 'indigo' ? 'bg-indigo-600 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md') : b.id === excludeId ? 'opacity-20 grayscale cursor-not-allowed' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <span className="truncate">{b.name.replace(/BRANCH - /i, '')}</span>
                {value === b.id && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7"/></svg>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const AnalyticsHub: React.FC<AnalyticsHubProps> = ({ branches, salesReports }) => {
  const [mode, setMode] = useState<Mode>('heatmap');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [branchA, setBranchA] = useState<string>('');
  const [branchB, setBranchB] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);

  const activeBranches = useMemo(() => branches.filter(b => b.isEnabled), [branches]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const now = new Date().getFullYear();
    years.add(now);
    salesReports.forEach(r => {
      const d = new Date(r.reportDate);
      if (!isNaN(d.getTime())) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [salesReports]);

  const daysInMonth = useMemo(() => new Date(selectedYear, selectedMonth + 1, 0).getDate(), [selectedYear, selectedMonth]);
  const startDay = useMemo(() => new Date(selectedYear, selectedMonth, 1).getDay(), [selectedYear, selectedMonth]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setIsScopeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dailyStats = useMemo(() => {
    const stats: Record<string, { gross: number; net: number; count: number }> = {};
    const filteredReports = salesReports.filter(r => selectedBranchId === 'all' ? true : r.branchId === selectedBranchId);

    filteredReports.forEach(r => {
      const date = r.reportDate;
      if (!stats[date]) stats[date] = { gross: 0, net: 0, count: 0 };
      stats[date].gross += r.grossSales;
      stats[date].net += r.netRoi;
      stats[date].count += 1;
    });
    return stats;
  }, [salesReports, selectedBranchId]);

  const comparisonData = useMemo(() => {
    if (!branchA || !branchB) return null;
    const aReports = salesReports.filter(r => r.branchId === branchA);
    const bReports = salesReports.filter(r => r.branchId === branchB);

    const sum = (reports: SalesReport[]) => reports.reduce((acc, curr) => ({
      gross: acc.gross + curr.grossSales,
      net: acc.net + curr.netRoi,
      pay: acc.pay + curr.totalStaffPay,
      exp: acc.exp + curr.totalExpenses,
      days: acc.days + 1
    }), { gross: 0, net: 0, pay: 0, exp: 0, days: 0 });

    return {
      a: { name: branches.find(b => b.id === branchA)?.name.replace(/BRANCH - /i, '') || 'A', stats: sum(aReports) },
      b: { name: branches.find(b => b.id === branchB)?.name.replace(/BRANCH - /i, '') || 'B', stats: sum(bReports) }
    };
  }, [branchA, branchB, salesReports, branches]);

  const getHeatmapColor = (net: number, gross: number, isActive: boolean) => {
    if (gross === 0) return isActive ? 'bg-slate-200 border-slate-300' : 'bg-slate-50 text-slate-300 border-slate-100';
    if (net < 0) return isActive ? 'bg-rose-500 text-white border-rose-600' : 'bg-rose-100 text-rose-700 border-rose-200';
    if (net < 2000) return isActive ? 'bg-emerald-400 text-white border-emerald-500' : 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (net < 5000) return isActive ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-emerald-200 text-emerald-800 border-emerald-300';
    return isActive ? 'bg-emerald-700 text-white border-emerald-800 shadow-lg' : 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
  };

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handleDayTap = (dateStr: string) => {
    resumeAudioContext();
    playSound('click');
    setActiveDay(activeDay === dateStr ? null : dateStr);
  };

  const selectedBranchName = useMemo(() => {
    if (selectedBranchId === 'all') return 'Full Network';
    return activeBranches.find(b => b.id === selectedBranchId)?.name || 'Unknown Node';
  }, [selectedBranchId, activeBranches]);

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500 pb-32">
      {/* HUB HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-medium text-slate-900 uppercase tracking-tighter">Intelligence Hub</h2>
          <p className="text-[8px] md:text-[10px] font-normal text-slate-400 uppercase tracking-[0.3em]">Network Analytical Ledger</p>
        </div>
        <div className="bg-slate-100 p-1 rounded-xl md:rounded-2xl flex items-center shadow-inner border border-slate-200/50">
          <button 
            onClick={() => { setMode('heatmap'); playSound('click'); }}
            className={`flex-1 md:w-32 py-2.5 md:py-3 px-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-medium uppercase tracking-widest transition-all ${mode === 'heatmap' ? 'bg-white text-slate-900 shadow-md border border-slate-200 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Heatmap
          </button>
          <button 
            onClick={() => { setMode('comparison'); playSound('click'); }}
            className={`flex-1 md:w-32 py-2.5 md:py-3 px-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-medium uppercase tracking-widest transition-all ${mode === 'comparison' ? 'bg-white text-slate-900 shadow-md border border-slate-200 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Vs Mode
          </button>
        </div>
      </div>

      {mode === 'heatmap' ? (
        <div className="space-y-4 md:space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="max-w-5xl mx-auto w-full">
            {/* FULL WIDTH CALENDAR */}
            <div className="bg-white p-4 md:p-10 rounded-[32px] md:rounded-[48px] border border-slate-100 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-10 px-2 gap-4">
                <div className="flex items-center gap-2 md:gap-4">
                   <select 
                     value={selectedMonth} 
                     onChange={(e) => setSelectedMonth(Number(e.target.value))}
                     className="text-lg md:text-xl font-medium text-slate-900 uppercase tracking-tight bg-transparent outline-none cursor-pointer hover:text-emerald-600"
                   >
                     {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                   </select>
                   <span className="text-xl font-medium text-slate-200">/</span>
                   <select 
                     value={selectedYear} 
                     onChange={(e) => setSelectedYear(Number(e.target.value))}
                     className="text-lg md:text-xl font-medium text-slate-400 uppercase tracking-tight bg-transparent outline-none cursor-pointer"
                   >
                     {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                   </select>
                </div>
                
                <div className="relative w-full sm:w-64" ref={scopeRef}>
                   <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Archive Scope</p>
                   <button 
                     onClick={() => { playSound('click'); setIsScopeOpen(!isScopeOpen); }}
                     className={`w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 rounded-[24px] border transition-all duration-300 ${isScopeOpen ? 'bg-white border-emerald-500 shadow-lg ring-4 ring-emerald-500/5' : 'border-slate-100 hover:border-slate-300 shadow-inner'}`}
                   >
                     <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-base shrink-0">🏢</span>
                        <span className="font-medium text-slate-900 text-[10px] uppercase tracking-widest truncate">
                          {selectedBranchName}
                        </span>
                     </div>
                     <svg className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isScopeOpen ? 'rotate-180 text-emerald-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path d="M19 9l-7 7-7-7" />
                     </svg>
                   </button>

                   {isScopeOpen && (
                     <div className="absolute z-[110] top-[calc(100%+8px)] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-1.5 ring-1 ring-slate-900/5">
                        <div className="max-h-[280px] overflow-y-auto no-scrollbar">
                           <button 
                             onClick={() => { setSelectedBranchId('all'); setIsScopeOpen(false); playSound('click'); }}
                             className={`w-full text-left px-5 py-3.5 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all mb-1 ${selectedBranchId === 'all' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                           >
                             Full Network Consolidated
                           </button>
                           <div className="h-px bg-slate-50 my-1 mx-2" />
                           {activeBranches.map(b => (
                             <button 
                               key={b.id}
                               onClick={() => { setSelectedBranchId(b.id); setIsScopeOpen(false); playSound('click'); }}
                               className={`w-full text-left px-5 py-3.5 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all mb-1 last:mb-0 flex items-center justify-between ${selectedBranchId === b.id ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                             >
                               <span className="truncate">{b.name}</span>
                               {selectedBranchId === b.id && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7"/></svg>}
                             </button>
                           ))}
                        </div>
                     </div>
                   )}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5 md:gap-4">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={`${d}-${i}`} className="text-center py-2 text-[9px] md:text-[11px] font-medium text-slate-300 uppercase tracking-widest">{d}</div>
                ))}
                {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} className="aspect-square"></div>)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const data = dailyStats[dateStr];
                  const isActive = activeDay === dateStr;
                  const colorClass = getHeatmapColor(data?.net || 0, data?.gross || 0, isActive);

                  return (
                    <button 
                      key={day} 
                      onClick={() => handleDayTap(dateStr)}
                      className={`aspect-square rounded-xl md:rounded-[32px] border transition-all duration-300 flex flex-col items-center justify-center gap-0.5 group relative overflow-hidden active:scale-90 ${colorClass}`}
                    >
                      <span className={`text-[10px] md:text-sm font-medium ${isActive ? 'scale-125' : ''}`}>{day}</span>
                      {data && (
                        <div className="text-center px-1 hidden md:block">
                          <span className="text-[9px] font-normal block opacity-80 leading-none mt-1">₱{(data.net / 1000).toFixed(1)}k</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Day Details Card (Universal Bottom Detail) */}
              {activeDay && dailyStats[activeDay] && (
                 <div className="mt-8 p-6 md:p-8 bg-slate-900 rounded-[32px] md:rounded-[40px] text-white animate-in slide-in-from-top-4 duration-500 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
                    <div className="flex justify-between items-center mb-6 relative z-10">
                       <div className="space-y-1">
                          <p className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">Audit Context: {activeDay}</p>
                          <h4 className="text-lg md:text-xl font-medium uppercase tracking-tight">{new Date(activeDay).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</h4>
                       </div>
                       <span className={`px-4 py-1.5 rounded-full text-[9px] font-medium uppercase tracking-widest shadow-sm ${dailyStats[activeDay].net >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                          {dailyStats[activeDay].net >= 0 ? 'Profitable Yield' : 'Operational Loss'}
                       </span>
                    </div>
                    <div className="grid grid-cols-2 gap-8 relative z-10">
                       <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                          <p className="text-[9px] font-normal text-slate-500 uppercase tracking-widest mb-2">Total Gross Yield</p>
                          <p className="text-2xl md:text-3xl font-medium tabular-nums">₱{dailyStats[activeDay].gross.toLocaleString()}</p>
                       </div>
                       <div className={`p-5 rounded-2xl border ${dailyStats[activeDay].net >= 0 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
                          <p className="text-[9px] font-normal text-slate-500 uppercase tracking-widest mb-2">Network Net ROI</p>
                          <p className={`text-2xl md:text-3xl font-medium tabular-nums ${dailyStats[activeDay].net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ₱{dailyStats[activeDay].net.toLocaleString()}
                          </p>
                       </div>
                    </div>
                 </div>
              )}

              <div className="mt-10 pt-8 border-t border-slate-50 flex flex-wrap justify-center gap-4 md:gap-8">
                <div className="flex items-center gap-2.5">
                   <div className="w-3 h-3 rounded-lg bg-rose-100 border border-rose-200"></div>
                   <span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest whitespace-nowrap">Loss Day</span>
                </div>
                <div className="flex items-center gap-2.5">
                   <div className="w-3 h-3 rounded-lg bg-emerald-50 border border-emerald-100"></div>
                   <span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest whitespace-nowrap">Low Yield</span>
                </div>
                <div className="flex items-center gap-2.5">
                   <div className="w-3 h-3 rounded-lg bg-emerald-200 border border-emerald-300"></div>
                   <span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest whitespace-nowrap">Moderate</span>
                </div>
                <div className="flex items-center gap-2.5">
                   <div className="w-3 h-3 rounded-lg bg-emerald-600"></div>
                   <span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest whitespace-nowrap">High Profit</span>
                </div>
              </div>
            </div>

            <div className="mt-8 bg-slate-50 p-6 rounded-[32px] border border-slate-200 italic text-slate-400 text-[10px] md:text-[11px] leading-relaxed uppercase font-normal text-center tracking-widest">
               "Heatmap colors represent network retention intensity. Due to branches having staggered cycle start dates, calendar month totals are for visual trend identification only."
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           {/* REFINED VS MODE DROPDOWNS */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
              <CustomBranchDropdown 
                label="Node Alpha" 
                placeholder="Select Terminal A..." 
                value={branchA} 
                options={activeBranches} 
                onSelect={setBranchA} 
                excludeId={branchB} 
                colorTheme="indigo"
              />
              <CustomBranchDropdown 
                label="Node Beta" 
                placeholder="Select Terminal B..." 
                value={branchB} 
                options={activeBranches} 
                onSelect={setBranchB} 
                excludeId={branchA} 
                colorTheme="emerald"
              />
           </div>

           {comparisonData ? (
             <div className="bg-white rounded-[32px] md:rounded-[56px] border border-slate-100 shadow-xl overflow-hidden animate-in zoom-in-95 duration-500 max-w-5xl mx-auto w-full">
                {/* HEADERS - SIDE BY SIDE ON MOBILE */}
                <div className="flex divide-x divide-white/10 relative">
                   <div className="flex-1 p-5 md:p-8 text-center bg-indigo-600 text-white">
                      <p className="text-[7px] md:text-[8px] font-medium uppercase tracking-widest mb-1 opacity-60">Terminal A</p>
                      <h4 className="text-[11px] md:text-base font-medium truncate px-2">{comparisonData.a.name}</h4>
                   </div>
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                      <div className="w-8 h-8 md:w-12 md:h-12 bg-slate-900 rounded-lg md:rounded-2xl flex items-center justify-center text-white font-medium text-[9px] md:text-[10px] shadow-xl border-2 border-white">VS</div>
                   </div>
                   <div className="flex-1 p-5 md:p-8 text-center bg-emerald-600 text-white">
                      <p className="text-[7px] md:text-[8px] font-medium uppercase tracking-widest mb-1 opacity-60">Terminal B</p>
                      <h4 className="text-[11px] md:text-base font-medium truncate px-2">{comparisonData.b.name}</h4>
                   </div>
                </div>

                <div className="p-5 md:p-10 space-y-6 md:space-y-12">
                   {[
                     { label: 'Gross Yield', key: 'gross', prefix: '₱' },
                     { label: 'Staff Payroll', key: 'pay', prefix: '₱' },
                     { label: 'Operational Cost', key: 'exp', prefix: '₱' },
                     { label: 'Net ROI', key: 'net', prefix: '₱' },
                     { label: 'Active Days', key: 'days', prefix: '' }
                   ].map(metric => {
                      const valA = (comparisonData.a.stats as any)[metric.key];
                      const valB = (comparisonData.b.stats as any)[metric.key];
                      const isAWin = metric.key === 'exp' || metric.key === 'pay' ? valA < valB : valA > valB;
                      const isBWin = metric.key === 'exp' || metric.key === 'pay' ? valB < valA : valB > valA;

                      return (
                        <div key={metric.key} className="space-y-2 md:space-y-4">
                           <div className="flex justify-between items-center px-1">
                              <span className="text-[8px] md:text-[10px] font-medium text-slate-300 uppercase tracking-[0.2em]">{metric.label}</span>
                              <div className="flex gap-2">
                                 {isAWin && <span className="bg-indigo-50 text-indigo-700 text-[6px] md:text-[7px] font-medium uppercase px-2 py-0.5 rounded-full">A LEADS</span>}
                                 {isBWin && <span className="bg-emerald-50 text-emerald-700 text-[6px] md:text-[7px] font-medium uppercase px-2 py-0.5 rounded-full">B LEADS</span>}
                              </div>
                           </div>
                           <div className="flex items-stretch gap-1 md:gap-4 h-14 md:h-20">
                              <div className={`flex-1 flex items-center justify-center rounded-xl md:rounded-[24px] border-2 transition-all ${isAWin ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                 <p className={`text-sm md:text-xl font-medium tabular-nums text-center ${isAWin ? 'text-indigo-900' : 'text-slate-400'}`}>{metric.prefix}{valA.toLocaleString()}</p>
                              </div>
                              <div className="w-px bg-slate-100 my-2 hidden md:block"></div>
                              <div className={`flex-1 flex items-center justify-center rounded-xl md:rounded-[24px] border-2 transition-all ${isBWin ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                 <p className={`text-sm md:text-xl font-medium tabular-nums text-center ${isBWin ? 'text-emerald-900' : 'text-slate-400'}`}>{metric.prefix}{valB.toLocaleString()}</p>
                              </div>
                           </div>
                        </div>
                      );
                   })}
                </div>

                <div className="p-6 md:p-10 bg-slate-900 text-center">
                   <p className="text-[8px] md:text-[10px] font-normal text-slate-500 uppercase tracking-[0.4em] animate-pulse">Competitive Analysis Data Synchronized</p>
                </div>
             </div>
           ) : (
             <div className="py-24 md:py-40 text-center bg-white rounded-[32px] md:rounded-[56px] border-4 border-dashed border-slate-50 opacity-20 flex flex-col items-center gap-4 md:gap-6 max-w-4xl mx-auto w-full">
                <div className="text-5xl md:text-7xl">⚔️</div>
                <p className="text-[10px] md:text-[12px] font-normal uppercase tracking-[0.4em] px-8">Select Two Terminal Nodes to Initiate Analysis</p>
             </div>
           )}
        </div>
      )}
    </div>
  );
};