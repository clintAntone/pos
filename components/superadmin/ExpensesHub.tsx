import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Branch, SalesReport, ExpenseCategory } from '../../types';
import { UI_THEME } from '../../constants/ui_designs';
import { playSound } from '../../lib/audio';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const CustomSelect: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  icon?: React.ReactNode;
}> = ({ label, value, options, onChange, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <label className={UI_THEME.text.label}>{label}</label>
      <button
        onClick={() => {
          playSound('click');
          setIsOpen(!isOpen);
        }}
        className={`w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 ${UI_THEME.radius.input} text-[11px] font-bold uppercase tracking-widest hover:bg-white hover:border-emerald-500 transition-all text-left shadow-inner`}
      >
        <span className="truncate flex items-center gap-2">
          {icon}
          {selectedOption.label}
        </span>
        <svg className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div className="absolute z-[100] top-[calc(100%+4px)] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                playSound('click');
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between ${
                value === option.value 
                ? 'bg-emerald-50 text-emerald-600' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {option.label}
              {value === option.value && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface ExpensesHubProps {
  branches: Branch[];
  salesReports: SalesReport[];
  realTimeExpenses?: any[];
  hideHeader?: boolean;
}

export const ExpensesHub: React.FC<ExpensesHubProps> = ({ branches, salesReports, realTimeExpenses = [], hideHeader = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return branchFilter !== 'all' || categoryFilter !== 'all' || startDate !== '' || endDate !== '';
  }, [branchFilter, categoryFilter, startDate, endDate]);

  const handlePrint = () => {
    setIsExporting(true);
    playSound('click');
    
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text('EXPENSES AUDIT LEDGER', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`PERIOD: ${startDate || 'ALL'} TO ${endDate || 'ALL'} | TOTAL: PHP ${totals.total.toLocaleString()}`, 14, 26);
      
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 20, { align: 'right' });

      autoTable(doc, {
        startY: 35,
        head: [['DATE', 'ITEM', 'AMOUNT', 'CATEGORY', 'RECEIPT']],
        body: filteredExpenses.map(exp => [
          exp.reportDate,
          exp.name.toUpperCase(),
          `PHP ${Number(exp.amount).toLocaleString()}`,
          exp.category.toUpperCase(),
          exp.receiptImage ? 'YES' : 'NO'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [5, 150, 105] }, // emerald-600
        styles: { fontSize: 7 }
      });

      doc.save(`EXPENSES_LEDGER_${new Date().toISOString().split('T')[0]}.pdf`);
      playSound('success');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const setDatePreset = (preset: 'today' | 'week' | 'month') => {
    playSound('click');
    const now = new Date();
    const start = new Date();
    
    if (preset === 'today') {
      const today = now.toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'week') {
      start.setDate(now.getDate() - now.getDay());
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      start.setDate(1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  const allExpenses = useMemo(() => {
    const expenses: any[] = [];
    
    // 1. Process Historical Reports
    salesReports.forEach(report => {
      const branch = branches.find(b => b.id === report.branchId);
      
      // Operational Expenses from reports
      (report.expenseData || []).forEach(exp => {
        expenses.push({
          ...exp,
          branchId: report.branchId,
          branchName: branch?.name || 'UNKNOWN NODE',
          reportDate: report.reportDate,
        });
      });

      // Vault Movements from reports (Provision & Settlement)
      (report.vaultData || []).forEach(v => {
        expenses.push({
          ...v,
          branchId: report.branchId,
          branchName: branch?.name || 'UNKNOWN NODE',
          reportDate: report.reportDate,
        });
      });
    });

    // 2. Process Real-time Expenses (avoiding duplicates from today's reports if any)
    // Usually today's reports aren't generated yet or are partial
    realTimeExpenses.forEach(exp => {
      const branch = branches.find(b => b.id === exp.branchId);
      // Check if already added (simple check by ID)
      if (!expenses.some(e => e.id === exp.id)) {
        expenses.push({
          ...exp,
          branchName: branch?.name || 'UNKNOWN NODE',
          reportDate: exp.timestamp.split('T')[0],
        });
      }
    });

    return expenses.sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
  }, [salesReports, branches, realTimeExpenses]);

  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(exp => {
      const matchesBranch = branchFilter === 'all' || exp.branchId === branchFilter;
      const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
      const matchesSearch = exp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           exp.branchName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStart = !startDate || exp.reportDate >= startDate;
      const matchesEnd = !endDate || exp.reportDate <= endDate;
      
      return matchesBranch && matchesCategory && matchesSearch && matchesStart && matchesEnd;
    });
  }, [allExpenses, branchFilter, categoryFilter, searchTerm, startDate, endDate]);

  const totals = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => {
      acc.total += curr.amount;
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, { total: 0 } as any);
  }, [filteredExpenses]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* HEADER + FILTERS SECTION */}
      {!hideHeader && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 no-print">
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center text-xl shadow-inner border border-white/10">
                📊
              </div>
              <div>
                <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Ledger</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Global Network Expenditure Audit</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
               <button 
                 onClick={handlePrint}
                 disabled={isExporting}
                 className="h-10 sm:h-11 rounded-[24px] bg-white border border-slate-200 px-4 sm:px-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
               >
                 {isExporting ? (
                   <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
                 ) : (
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                 )}
                 <span className="hidden sm:inline">
                   {isExporting ? 'Exporting...' : 'Export Ledger'}
                 </span>
               </button>
               <div className="bg-white px-4 py-2 rounded-[24px] border border-slate-200 shadow-sm hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Filtered</p>
                  <p className="text-xl font-black text-rose-600 tabular-nums">₱{totals.total.toLocaleString()}</p>
               </div>
            </div>
          </div>

          <div className="flex flex-row items-center gap-2 sm:gap-4 pt-6 border-t border-slate-100">
            <div className="relative flex-1 group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search expense or branch..."
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[24px] font-bold text-sm uppercase tracking-wider text-slate-900 outline-none focus:border-emerald-500 focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-sm placeholder:text-slate-300"
              />
            </div>

            <button
              onClick={() => { setIsFiltersExpanded(!isFiltersExpanded); playSound('click'); }}
              className={`flex items-center gap-2 px-6 py-4 rounded-[24px] border transition-all text-[10px] font-black uppercase tracking-widest shrink-0 ${isFiltersExpanded ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-500 hover:text-emerald-600'}`}
            >
              <svg className={`w-4 h-4 transition-transform duration-300 ${isFiltersExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M19 9l-7 7-7-7" /></svg>
              <span className="hidden sm:inline">{isFiltersExpanded ? 'Hide Filters' : 'Filters'}</span>
              {hasActiveFilters && !isFiltersExpanded && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
            </button>
          </div>

          {isFiltersExpanded && (
            <div className={`grid grid-cols-1 ${branches.length > 1 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 animate-in fade-in slide-in-from-top-2 duration-300 pt-2`}>
              {branches.length > 1 && (
                <CustomSelect 
                  label="Branch Node"
                  value={branchFilter}
                  onChange={setBranchFilter}
                  icon={<svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                  options={[
                    { value: 'all', label: 'All Branches' },
                    ...branches.map(b => ({ value: b.id, label: b.name }))
                  ]}
                />
              )}

              <CustomSelect 
                label="Category"
                value={categoryFilter}
                onChange={setCategoryFilter}
                icon={<svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
                options={[
                  { value: 'all', label: 'All Categories' },
                  { value: 'OPERATIONAL', label: 'Operational' },
                  { value: 'PROVISION', label: 'Provision' },
                  { value: 'SETTLEMENT', label: 'Settlement' }
                ]}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={UI_THEME.text.label}>From</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className={`${UI_THEME.styles.inputBase} ${UI_THEME.radius.input} text-xs`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={UI_THEME.text.label}>To</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className={`${UI_THEME.styles.inputBase} ${UI_THEME.radius.input} text-xs`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY CARDS - BENTO STYLE */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        {/* Main Total Card */}
        <div className={`md:col-span-2 bg-slate-900 p-6 ${UI_THEME.radius.card} shadow-xl relative overflow-hidden group flex flex-col justify-between min-h-[160px]`}>
          <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
          <div>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Consolidated Expenditure</p>
            <h3 className="text-3xl sm:text-4xl font-black text-white break-words leading-tight">
              ₱{totals.total.toLocaleString()}
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audit Period Active</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
        </div>

        {/* Operational Card */}
        <div className={`bg-white p-6 ${UI_THEME.radius.card} border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-rose-200 transition-colors`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational</p>
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
            </div>
            <p className="text-xl font-black text-slate-900 break-words">₱{(totals.OPERATIONAL || 0).toLocaleString()}</p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase mb-1.5">
              <span>Allocation</span>
              <span>{Math.round((totals.OPERATIONAL / totals.total) * 100 || 0)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-rose-500 h-full transition-all duration-1000" style={{ width: `${(totals.OPERATIONAL / totals.total) * 100 || 0}%` }}></div>
            </div>
          </div>
        </div>

        {/* Provision Card */}
        <div className={`bg-white p-6 ${UI_THEME.radius.card} border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-200 transition-colors`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Provision</p>
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            </div>
            <p className="text-xl font-black text-slate-900 break-words">₱{(totals.PROVISION || 0).toLocaleString()}</p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase mb-1.5">
              <span>Allocation</span>
              <span>{Math.round((totals.PROVISION / totals.total) * 100 || 0)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full transition-all duration-1000" style={{ width: `${(totals.PROVISION / totals.total) * 100 || 0}%` }}></div>
            </div>
          </div>
        </div>

        {/* Settlement Card - Spans 2 columns on medium screens to complete bento look */}
        <div className={`md:col-span-2 lg:col-span-1 bg-white p-6 ${UI_THEME.radius.card} border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-colors`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settlement</p>
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            </div>
            <p className="text-xl font-black text-slate-900 break-words">₱{(totals.SETTLEMENT || 0).toLocaleString()}</p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase mb-1.5">
              <span>Allocation</span>
              <span>{Math.round((totals.SETTLEMENT / totals.total) * 100 || 0)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(totals.SETTLEMENT / totals.total) * 100 || 0}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* LEDGER TABLE */}
      <div className={`bg-white ${UI_THEME.radius.card} border border-slate-200 shadow-sm overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch Node</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Item</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length > 0 ? filteredExpenses.map((exp, idx) => (
                <tr key={`${exp.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-[11px] font-bold text-slate-900 uppercase">{exp.reportDate}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[11px] font-bold text-slate-600 uppercase">{exp.branchName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{exp.name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                      exp.category === 'OPERATIONAL' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                      exp.category === 'PROVISION' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                      'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-black text-slate-900 tabular-nums">₱{exp.amount.toLocaleString()}</p>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No expenses found matching criteria</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
