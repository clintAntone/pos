import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { TabID } from '../BranchManagerDashboard';
import { playSound, resumeAudioContext } from '../../lib/audio';
import { UI_THEME } from '../../constants/ui_designs';
import { Terminology } from '../../types';

interface BranchNavbarProps {
  activeTab: TabID;
  onTabChange: (id: TabID) => void;
  enableShiftTracking: boolean;
  isRelief: boolean;
  terminology: Terminology;
}

const s={fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"},c="w-[19px] h-[19px]";
const Icons={
  pos:<svg className={c} viewBox="0 0 24 24" {...s}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="17" cy="15" r="1"/><circle cx="13" cy="15" r="1"/></svg>,
  sales:<svg className={c} viewBox="0 0 24 24" {...s}><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>,
  staff:<svg className={c} viewBox="0 0 24 24" {...s}><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>,
  shift:<svg className={c} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>,
  expenses:<svg className={c} viewBox="0 0 24 24" {...s}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9a3 3 0 000 6h6a3 3 0 010 6H7"/></svg>,
  expenses_ledger:<svg className={c} viewBox="0 0 24 24" {...s}><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  payroll:<svg className={c} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  archive:<svg className={c} viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="18" height="4"/><path d="M5 8v12h14V8"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  vault:<svg className={c} viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>,
  settings:<svg className={c} viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 00.3 2l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.8 1.8 0 00-2-.3 1.8 1.8 0 00-1 1.6V21a2 2 0 01-4 0v-.1a1.8 1.8 0 00-1-1.6 1.8 1.8 0 00-2 .3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.8 1.8 0 00.3-2 1.8 1.8 0 00-1.6-1H3a2 2 0 010-4h.1a1.8 1.8 0 001.6-1 1.8 1.8 0 00-.3-2l-.1-.1a2 2 0 012.8-2.8l.1.1a1.8 1.8 0 002 .3h.1a1.8 1.8 0 001-1.6V3a2 2 0 014 0v.1a1.8 1.8 0 001 1.6 1.8 1.8 0 002-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.8 1.8 0 00-.3 2v.1a1.8 1.8 0 001.6 1H21a2 2 0 010 4h-.1a1.8 1.8 0 00-1.6 1z"/></svg>,
  developer:<svg className={c} viewBox="0 0 24 24" {...s}><path d="M16 18l6-6-6-6M8 6l-6 6 6 6M12 4.5l-2 15"/></svg>,
  how_to:<svg className={c} viewBox="0 0 24 24" {...s}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  more:<svg className="w-6 h-6 sm:w-5 sm:h-5" viewBox="0 0 24 24" {...s}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
};

export const BranchNavbar: React.FC<BranchNavbarProps> = ({ activeTab, onTabChange, enableShiftTracking, isRelief, terminology }) => {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const masterTabRegistry = useMemo(() => {
    const tabs = [
      { id: 'pos', label: 'POS', icon: Icons.pos, desc: 'Session Registry', color: 'bg-emerald-50 text-emerald-600', group: 'Operations' },
      { id: 'sales', label: terminology.sales, icon: Icons.sales, desc: 'Daily Performance', color: 'bg-emerald-50 text-emerald-600', group: 'Operations' },
      { id: 'staff', label: terminology.staff, icon: Icons.staff, desc: 'Personnel Roster', color: 'bg-indigo-50 text-indigo-600', group: 'Personnel' },
      { id: 'expenses_hub', label: terminology.expense, icon: Icons.expenses, desc: 'Daily & Vault', color: 'bg-rose-50 text-rose-600', group: 'Finance' },
      { id: 'monthly_bills', label: 'Monthly Bills', icon: Icons.vault, desc: 'Settle Dues', color: 'bg-rose-50 text-rose-600', group: 'Finance' },
      { id: 'salaries', label: 'Payroll', icon: Icons.payroll, desc: 'Cycle Audit', color: 'bg-rose-50 text-rose-600', group: 'Finance' },
      { id: 'sales_reports', label: 'Sales Reports', icon: Icons.archive, desc: 'Historical Data', color: 'bg-indigo-50 text-indigo-600', group: 'Reports' },
      { id: 'expense_reports', label: 'Expense Reports', icon: Icons.expenses_ledger, desc: 'Financial History', color: 'bg-indigo-50 text-indigo-600', group: 'Reports' },
      { id: 'how_to', label: 'How-To', icon: Icons.how_to, desc: 'Manual', color: 'bg-slate-100 text-slate-600', group: 'System' },
      { id: 'settings', label: 'Settings', icon: Icons.settings, desc: 'Node Config', color: 'bg-rose-50 text-rose-600', group: 'System' },
    ];

    if (enableShiftTracking) {
      tabs.splice(2, 0, { id: 'shift', label: 'Shift', icon: Icons.shift, desc: 'Operations Log', color: 'bg-emerald-50 text-emerald-600', group: 'Operations' });
    }

    if (isRelief) {
      return tabs.filter(t => t.id !== 'settings');
    }
    return tabs;
  }, [enableShiftTracking, isRelief, terminology]);

  const tabGroups = useMemo(() => {
    const groups: { name: string, tabs: typeof masterTabRegistry }[] = [];
    masterTabRegistry.forEach(tab => {
      let group = groups.find(g => g.name === tab.group);
      if (!group) {
        group = { name: tab.group, tabs: [] };
        groups.push(group);
      }
      group.tabs.push(tab);
    });
    return groups;
  }, [masterTabRegistry]);

  const capacity = Math.max(1, Math.floor((windowWidth - 40) / 120));

  const { visibleTabs, overflowTabs } = useMemo(() => {
    // On mobile, we show a limited number of tabs and a "More" button if needed
    if (windowWidth < 640) {
      if (masterTabRegistry.length <= 5) {
        return { visibleTabs: masterTabRegistry, overflowTabs: [] };
      }
      return {
        visibleTabs: masterTabRegistry.slice(0, 3),
        overflowTabs: masterTabRegistry.slice(3)
      };
    }

    if (masterTabRegistry.length <= capacity) {
      return { visibleTabs: masterTabRegistry, overflowTabs: [] };
    }

    const limit = Math.max(1, capacity - 1);
    return {
      visibleTabs: masterTabRegistry.slice(0, limit),
      overflowTabs: masterTabRegistry.slice(limit)
    };
  }, [masterTabRegistry, windowWidth, capacity]);

  const isMoreActive = useMemo(() => {
    const visibleIds = new Set(visibleTabs.map(t => t.id));
    return !visibleIds.has(activeTab);
  }, [visibleTabs, activeTab]);

  const handleTabClick = (id: string) => {
    resumeAudioContext();
    playSound('click');
    onTabChange(id as TabID);
    setShowMoreModal(false);
  };

  return (
      <>
        <nav className="bg-slate-800 border-b border-white/5 hidden sm:block w-full overflow-x-auto no-scrollbar shadow-lg no-print">
          <div className={`${UI_THEME.layout.maxContent} ${UI_THEME.layout.mainPadding} flex justify-start items-end h-20 min-w-max pb-2`}>
            {tabGroups.map((group, gIdx) => (
                <div key={group.name} className={`flex flex-col ${gIdx !== 0 ? 'border-l border-white/5 ml-4 pl-4' : ''}`}>
                  <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2 px-4 opacity-50">{group.name}</span>
                  <div className="flex items-stretch h-10">
                    {group.tabs.map(tab => {
                      const isActive = activeTab === tab.id;
                      return (
                          <button
                              key={tab.id}
                              onClick={() => handleTabClick(tab.id)}
                              className={`relative flex items-center gap-2.5 px-5 font-semibold text-[10px] lg:text-[11px] uppercase transition-colors duration-200 shrink-0 group rounded-xl ${isActive ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                          >
                            <div className={`transition-all duration-300 ${isActive ? 'scale-110 text-emerald-400' : 'group-hover:text-emerald-300'}`}>{tab.icon}</div>
                            <span className={`tracking-widest whitespace-nowrap transition-opacity duration-300 opacity-80 group-hover:opacity-100 ${isActive ? 'opacity-100' : ''}`}>
                        {tab.label}
                      </span>
                            {isActive && <div className="absolute -bottom-2 left-4 right-4 h-[2px] bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>}
                          </button>
                      );
                    })}
                  </div>
                </div>
            ))}
          </div>
        </nav>

        {/* MOBILE NAV - REFINED WITH MORE BUTTON */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] sm:hidden no-print w-full px-4">
          <div className="bg-slate-800/95 backdrop-blur-2xl px-2 py-3 rounded-[32px] shadow-[0_15px_45px_-5px_rgba(0,0,0,0.5)] ring-1 ring-white/10 border border-white/5 flex items-center justify-around transition-all duration-500">
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                  <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative shrink-0 min-w-[64px] ${isActive ? 'scale-110' : 'opacity-40 hover:opacity-100'}`}
                  >
                    <div className={`transition-all duration-300 ${isActive ? 'text-emerald-400' : 'text-white'}`}>{tab.icon}</div>
                    <span className={`text-[8px] font-bold uppercase tracking-tight ${isActive ? 'text-white' : 'text-slate-300'}`}>{tab.label}</span>
                    {isActive && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]"></div>}
                  </button>
              );
            })}

            {overflowTabs.length > 0 && (
                <button
                    onClick={() => { resumeAudioContext(); playSound('click'); setShowMoreModal(true); }}
                    className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative shrink-0 min-w-[64px] ${isMoreActive ? 'scale-110' : 'opacity-40 hover:opacity-100'}`}
                >
                  <div className={`transition-all duration-300 ${isMoreActive ? 'text-emerald-400' : 'text-white'}`}>{Icons.more}</div>
                  <span className={`text-[8px] font-bold uppercase tracking-tight ${isMoreActive ? 'text-white' : 'text-slate-300'}`}>More</span>
                  {isMoreActive && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]"></div>}
                </button>
            )}
          </div>
        </div>

        {mounted && showMoreModal && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-6 bg-slate-900/40 backdrop-blur-md no-print animate-in fade-in duration-300">
              <div className={`bg-white ${UI_THEME.radius.modal} w-[96vw] sm:w-[92vw] sm:max-w-4xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] relative animate-in zoom-in-95 duration-200 max-h-[96vh] sm:max-h-full overflow-y-auto no-scrollbar border border-slate-200 flex flex-col`}>

                <div className="sticky top-0 bg-white/95 backdrop-blur-md z-30 flex justify-between items-center py-4 px-5 sm:py-8 sm:px-12 border-b border-slate-100 shrink-0">
                  <div className="space-y-0.5 sm:space-y-1">
                    <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tighter text-slate-900">More options</h3>
                    <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 opacity-80">Extended {terminology.branch} Operations</p>
                  </div>
                  <button
                      onClick={() => { playSound('click'); setShowMoreModal(false); }}
                      className="p-2 sm:p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all border border-slate-200 shadow-sm active:scale-90"
                  >
                    <svg className="w-5 h-5 sm:w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="p-4 sm:p-12 sm:pt-8 space-y-10">
                  {tabGroups.map(group => (
                      <div key={group.name} className="space-y-5">
                        <div className="flex items-center gap-4 px-2">
                          <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em] whitespace-nowrap">{group.name}</h5>
                          <div className="h-px flex-1 bg-slate-100"></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-4">
                          {group.tabs.map(item => (
                              <button
                                  key={item.id}
                                  onClick={() => handleTabClick(item.id)}
                                  style={{ transform: 'translateZ(0)' }}
                                  className={`p-4 sm:p-6 ${UI_THEME.radius.card} border text-left flex flex-col justify-between transition-all duration-300 group relative overflow-hidden min-h-[110px] sm:min-h-[140px] sm:col-span-2 transform-gpu ${activeTab === item.id ? 'border-emerald-500 bg-emerald-50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 bg-slate-50/50'}`}
                              >
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg mb-3 sm:mb-4 shrink-0 transition-transform duration-300 group-hover:scale-110 ${item.color}`}>
                                  {item.icon}
                                </div>
                                <div>
                                  <h4 className="text-[11px] sm:text-[13px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1.5 group-hover:text-emerald-600 transition-colors duration-200">{item.label}</h4>
                                  <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-500 transition-colors">{item.desc}</p>
                                </div>
                                {activeTab === item.id && (
                                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                                )}
                              </button>
                          ))}
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            </div>,
            document.body
        )}
      </>
  );
};