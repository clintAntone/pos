import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Service, Branch, ProviderRole, CommissionType } from '../../types';
import { DB_TABLES, DB_COLUMNS } from '../../constants/db_schema';
import { playSound, resumeAudioContext } from '../../lib/audio';
import { supabase } from '../../lib/supabase';
import { UI_THEME } from '../../constants/ui_designs';

export interface CatalogGroup {
  id: string;
  name: string;
  services: Service[];
  branchIds: string[];
}

interface ServiceCatalogProps {
  branches: Branch[];
  catalogs: CatalogGroup[];
  onSave: (catalogs: CatalogGroup[]) => Promise<void>;
  setConfirmState?: (state: any) => void;
}

const CardShell: React.FC<{ 
  children: React.ReactNode; 
  onClick?: () => void; 
  className?: string;
  isActive?: boolean;
}> = ({ children, onClick, className, isActive }) => (
  <button
    onClick={onClick}
    className={`
      w-full text-left flex flex-col transition-all duration-300 group relative overflow-hidden
      bg-white border shadow-sm active:scale-[0.98] p-4 sm:p-7 rounded-2xl sm:rounded-[40px]
      ${isActive ? 'border-emerald-500 ring-4 ring-emerald-50' : 'border-slate-100 hover:border-emerald-200 hover:shadow-md'}
      ${className}
    `}
  >
    {children}
  </button>
);

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({ branches, catalogs: initialCatalogs, onSave, setConfirmState }) => {
  const [localCatalogs, setLocalCatalogs] = useState<CatalogGroup[]>(initialCatalogs);
  const [activeCatalogId, setActiveCatalogId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceData, setEditingServiceData] = useState<Service | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');

  const activeCatalog = useMemo(() => localCatalogs.find(c => c.id === activeCatalogId), [localCatalogs, activeCatalogId]);

  useEffect(() => {
    setLocalCatalogs(JSON.parse(JSON.stringify(initialCatalogs || [])));
    setHasUnsavedChanges(false);
  }, [initialCatalogs]);

  useEffect(() => {
    if (editingServiceId) {
      if (editingServiceId === 'new') {
        setEditingServiceData({ 
          id: 'new', name: '', price: 0, duration: 60, 
          commissionType: 'fixed' as CommissionType, commissionValue: 0, 
          isDualProvider: false, primaryRole: 'THERAPIST' as ProviderRole 
        });
      } else {
        const srv = activeCatalog?.services.find(s => s.id === editingServiceId);
        if (srv) setEditingServiceData({ ...srv });
      }
    } else {
      setEditingServiceData(null);
    }
  }, [editingServiceId, activeCatalog]);

  const filteredBranches = useMemo(() => {
    const term = branchSearch.toLowerCase().trim();
    if (!term) return branches;
    return branches.filter(b => b.name.toLowerCase().includes(term));
  }, [branches, branchSearch]);

  const updateCatalog = (id: string, updates: Partial<CatalogGroup>) => {
    setLocalCatalogs(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    setHasUnsavedChanges(true);
  };

  const toggleBranchLink = (catalogId: string, branchId: string) => {
    setLocalCatalogs(prev => prev.map(c => {
      if (c.id === catalogId) {
        const ids = c.branchIds || [];
        const nextIds = ids.includes(branchId) 
          ? ids.filter(id => id !== branchId) 
          : [...ids, branchId];
        return { ...c, branchIds: nextIds };
      }
      return c;
    }));
    setHasUnsavedChanges(true);
    playSound('click');
  };

  const handleSaveService = () => {
      if (!activeCatalogId || !editingServiceData || !activeCatalog) return;
      
      const enrichedService = {
        ...editingServiceData,
        catalogId: activeCatalog.id,
        catalogName: activeCatalog.name
      };

      setLocalCatalogs(prev => prev.map(c => {
          if (c.id === activeCatalogId) {
              if (editingServiceId === 'new') {
                const newService = { ...enrichedService, id: Math.random().toString(36).substr(2, 9) };
                return { ...c, services: [...c.services, newService] };
              } else {
                return {
                  ...c,
                  services: c.services.map(s => s.id === editingServiceId ? enrichedService : s)
                };
              }
          }
          return c;
      }));
      
      setHasUnsavedChanges(true);
      setEditingServiceId(null);
      playSound('success');
  };

  const handleDeleteService = (serviceId: string) => {
    if (!activeCatalogId) return;
    setLocalCatalogs(prev => prev.map(c => {
      if (c.id === activeCatalogId) {
        return { ...c, services: c.services.filter(s => s.id !== serviceId) };
      }
      return c;
    }));
    setHasUnsavedChanges(true);
    playSound('warning');
  };

  const handleGlobalSave = async () => {
    setIsSaving(true);
    resumeAudioContext();
    try {
      // 1. Enforce catalog info on all services in local state before saving
      const enrichedCatalogs = localCatalogs.map(cat => ({
        ...cat,
        services: (cat.services || []).map(s => ({
          ...s,
          catalogId: cat.id,
          catalogName: cat.name
        }))
      }));

      // 2. Persist to SERVICE_CATALOGS table
      for (const cat of enrichedCatalogs) {
        await supabase.from(DB_TABLES.SERVICE_CATALOGS).upsert({
          [DB_COLUMNS.ID]: cat.id,
          [DB_COLUMNS.NAME]: cat.name,
          [DB_COLUMNS.SERVICES]: cat.services,
          [DB_COLUMNS.BRANCH_IDS]: cat.branchIds,
          [DB_COLUMNS.UPDATED_AT]: new Date().toISOString()
        });
      }

      // 3. Distribute to BRANCHES table with catalog info included
      const branchServiceMap: Record<string, Service[]> = {};
      branches.forEach(b => { branchServiceMap[b.id] = []; });

      enrichedCatalogs.forEach(catalog => {
        (catalog.branchIds || []).forEach(branchId => {
          if (branchServiceMap[branchId]) {
            branchServiceMap[branchId] = [
              ...branchServiceMap[branchId],
              ...(catalog.services || []).map(s => ({
                ...s,
                catalogId: catalog.id,
                catalogName: catalog.name
              }))
            ];
          }
        });
      });

      const updatePromises = Object.entries(branchServiceMap).map(([branchId, services]) => {
        return supabase.from(DB_TABLES.BRANCHES).update({ [DB_COLUMNS.SERVICES]: services }).eq(DB_COLUMNS.ID, branchId);
      });
      
      await Promise.all(updatePromises);
      setHasUnsavedChanges(false);
      playSound('success');
      if (onSave) await onSave(enrichedCatalogs);
    } catch (err) {
      console.error(err);
      playSound('warning');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCatalogDelete = () => {
    if (!activeCatalog) return;
    setConfirmState?.({
      isOpen: true,
      title: 'Erase Catalog Group?',
      message: `Authorize permanent erasure of "${activeCatalog.name}". Linked nodes will lose these units on next relay.`,
      variant: 'danger',
      onConfirm: () => {
        setLocalCatalogs(prev => prev.filter(c => c.id !== activeCatalogId));
        setHasUnsavedChanges(true);
        setActiveCatalogId(null);
        setConfirmState({ isOpen: false });
        playSound('warning');
      }
    });
  };

  const startNewCatalog = () => {
    const newCat = { id: Math.random().toString(36).substr(2, 9), name: 'NEW CATALOG', services: [], branchIds: [] };
    setLocalCatalogs([...localCatalogs, newCat]);
    setActiveCatalogId(newCat.id);
    setHasUnsavedChanges(true);
    playSound('click');
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in duration-300 pb-48 px-2">
      
      {!activeCatalogId && (
        <div className="space-y-10">
          <div className={`bg-white ${UI_THEME.layout.cardPadding} ${UI_THEME.radius.card} border border-slate-200 shadow-sm flex flex-row items-center justify-between gap-4 mx-4 no-print`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <div>
                <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tighter">Service Catalogs</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Master Distribution Control</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
            {localCatalogs.map(cat => (
              <CardShell key={cat.id} onClick={() => setActiveCatalogId(cat.id)}>
                <div className="flex flex-col h-full">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-900 text-emerald-400 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl shadow-xl mb-4 sm:mb-8 border border-white/5 transition-transform group-hover:scale-110">📂</div>
                  <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight pr-10 mb-2 leading-tight">{cat.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Unit Distribution Set</p>
                  
                  <div className="mt-auto border-t border-slate-50 pt-6 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                       <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tighter">{(cat.services || []).length} Services</span>
                     </div>
                     <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{(cat.branchIds || []).length} Nodes</span>
                  </div>
                </div>
              </CardShell>
            ))}

            <button 
              onClick={startNewCatalog}
              className="border-2 border-dashed border-slate-200 rounded-[32px] sm:rounded-[44px] p-8 sm:p-10 flex flex-col items-center justify-center gap-6 hover:border-emerald-500 hover:bg-emerald-50/20 transition-all group active:scale-95 bg-white/50"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center text-3xl text-slate-300 group-hover:text-emerald-600 shadow-sm border border-slate-100 transition-all group-hover:scale-110 group-hover:rotate-12">+</div>
              <div className="text-center space-y-1">
                <p className="text-base font-bold text-slate-400 uppercase tracking-tight group-hover:text-emerald-700">Add Core Catalog</p>
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">Initialize New Distribution</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {activeCatalog && (
        <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500 px-2 sm:px-4">
           {/* HEADER */}
           <div className={`bg-white ${UI_THEME.layout.cardPadding} ${UI_THEME.radius.card} border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print`}>
              <div className="flex items-center gap-4 w-full md:w-auto">
                  <button onClick={() => setActiveCatalogId(null)} className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all active:scale-90 border border-slate-100 shadow-inner shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                       <input 
                         autoFocus
                         className="text-[14px] font-black text-slate-900 uppercase tracking-tighter bg-slate-50 border-b border-emerald-500 outline-none w-full max-w-sm"
                         value={activeCatalog.name}
                         onChange={e => updateCatalog(activeCatalog.id, { name: e.target.value.toUpperCase() })}
                         onBlur={() => setIsRenaming(false)}
                         onKeyDown={e => e.key === 'Enter' && setIsRenaming(false)}
                       />
                    ) : (
                      <div className="flex items-center gap-2 overflow-hidden">
                        <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tighter truncate leading-none">{activeCatalog.name}</h3>
                        <button onClick={() => setIsRenaming(true)} className="p-1 text-slate-300 hover:text-slate-600 transition-colors shrink-0"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                      </div>
                    )}
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Catalog Configuration</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                 <button onClick={handleCatalogDelete} className="p-3 bg-rose-50 text-rose-500 rounded-xl border border-rose-100 hover:bg-rose-100 transition-all shadow-sm active:scale-95">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </button>
                 <button onClick={() => { setEditingServiceId('new'); playSound('click'); }} className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">Add Unit</button>
              </div>
           </div>

           <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
             {/* LEFT: SERVICES GRID */}
             <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full">
                {activeCatalog.services.length > 0 ? activeCatalog.services.map(srv => (
                  <div key={srv.id} className="bg-white p-4 sm:p-7 rounded-2xl sm:rounded-[40px] border border-slate-100 flex flex-col justify-between shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                     <div className="flex justify-between items-start mb-4 sm:mb-6">
                        <div className="min-w-0 pr-2">
                          <h4 className="font-bold text-slate-900 uppercase text-[14px] sm:text-base truncate tracking-tight mb-1">{srv.name}</h4>
                          <div className="flex items-center gap-2">
                             <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">{srv.duration}M</span>
                             <span className="w-1 h-1 rounded-full bg-slate-100"></span>
                             <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-widest whitespace-nowrap">₱{srv.price.toLocaleString()} Yield</span>
                          </div>
                        </div>
                        <div className="flex gap-1 sm:gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingServiceId(srv.id)} className="p-2 sm:p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-100 shadow-inner"><svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                          <button onClick={() => handleDeleteService(srv.id)} className="p-2 sm:p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100 shadow-inner"><svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                     </div>
                     <div className="pt-4 sm:pt-6 border-t border-slate-50 flex items-center justify-between gap-2 sm:gap-4">
                        <div className="space-y-1">
                          <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Lead Pay ({srv.primaryRole || 'THERAPIST'})</p>
                          <p className="text-xs sm:text-sm font-bold text-emerald-600 tabular-nums leading-none">{srv.commissionType === 'percentage' ? `${srv.commissionValue}%` : `₱${srv.commissionValue}`}</p>
                        </div>
                        {srv.isDualProvider && (
                          <div className="text-right space-y-1">
                            <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Support Pay (BONESETTER)</p>
                            <p className="text-xs sm:text-sm font-bold text-indigo-600 tabular-nums leading-none">{srv.secondaryCommissionType === 'percentage' ? `${srv.secondaryCommissionValue}%` : `₱${srv.secondaryCommissionValue}`}</p>
                          </div>
                        )}
                     </div>
                  </div>
                )) : (
                  <div className="col-span-full py-20 sm:py-32 text-center bg-white rounded-[32px] sm:rounded-[48px] border-4 border-dashed border-slate-50 opacity-40">
                     <p className="text-[12px] sm:text-sm font-bold uppercase tracking-[0.4em] text-slate-400">Empty Distribution Registry</p>
                  </div>
                )}
             </div>

             {/* RIGHT: BRANCH SUBSCRIPTION SIDEBAR */}
             <div className="w-full lg:w-96 shrink-0 space-y-6 sm:space-y-8 fixed bottom-0 left-0 right-0 lg:sticky lg:bottom-10 lg:self-end">
                <div className="bg-slate-900 rounded-3xl sm:rounded-[48px] p-5 sm:p-10 shadow-2xl relative overflow-hidden text-white border border-white/5">
                   <div className="absolute top-0 right-0 w-32 sm:w-40 h-32 sm:h-40 bg-emerald-500/10 blur-[90px] rounded-full translate-x-1/4 -translate-y-1/4"></div>
                   <div className="relative z-10 space-y-6 sm:space-y-8">
                      <div className="flex justify-between items-center h-10">
                         <div className="flex flex-col">
                           <h4 className="text-[10px] sm:text-[12px] font-bold uppercase tracking-[0.2em] text-emerald-400 leading-none">Subscribed Nodes</h4>
                           <p className="text-[7px] sm:text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1.5 sm:mt-2">Active Relay Registry</p>
                         </div>
                         <span className="bg-white/10 px-3 sm:px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold border border-white/5 shadow-inner shrink-0">{(activeCatalog.branchIds || []).length} Nodes</span>
                      </div>
                      
                      <div className="relative group">
                         <input 
                           value={branchSearch}
                           onChange={e => setBranchSearch(e.target.value)}
                           placeholder="Filter physical nodes..."
                           className="w-full bg-white/5 border border-white/10 rounded-[18px] sm:rounded-[22px] pl-12 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 text-[12px] sm:text-sm font-bold uppercase tracking-wide focus:border-emerald-500 outline-none transition-all placeholder:text-white/20 shadow-inner"
                         />
                         <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-emerald-500 transition-colors">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                         </div>
                      </div>

                      <div className="space-y-2 max-h-[500px] sm:max-h-[600px] overflow-y-auto no-scrollbar pr-1">
                         {filteredBranches.length > 0 ? filteredBranches.map(b => {
                           const isLinked = (activeCatalog.branchIds || []).includes(b.id);
                           return (
                             <button 
                               key={b.id}
                               onClick={() => toggleBranchLink(activeCatalog.id, b.id)}
                               className={`w-full flex items-center justify-between p-4 sm:p-5 rounded-[18px] sm:rounded-[22px] transition-all border group active:scale-[0.97] ${isLinked ? 'bg-emerald-600 border-emerald-500 text-white shadow-xl scale-[1.02]' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                             >
                               <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isLinked ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-500'}`}>🏢</div>
                                  <span className="font-bold uppercase text-[11px] sm:text-[12px] tracking-tight truncate leading-none">{b.name}</span>
                               </div>
                               {isLinked && <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-in zoom-in" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>}
                             </button>
                           );
                         }) : (
                           <div className="py-12 sm:py-20 text-center opacity-30">
                              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.4em]">No matching terminals</p>
                           </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* UNSAVED CHANGES FLOATING BAR */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-24 lg:bottom-12 left-4 right-4 sm:left-6 sm:right-6 z-[400] bg-white/95 backdrop-blur-md border border-amber-200 p-4 sm:p-5 rounded-[28px] sm:rounded-[36px] shadow-[0_30px_70px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom-12 flex items-center justify-center">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4 px-2 sm:px-6">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 text-amber-500 animate-pulse flex items-center justify-center border border-amber-200 shadow-inner text-lg sm:text-xl shrink-0">⚠️</div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold uppercase text-slate-900 tracking-tight leading-none">Modified Registry Parameters</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Commit to synchronize all branch node catalogs</p>
              </div>
              <div className="sm:hidden text-center">
                <p className="text-[10px] font-bold uppercase text-slate-900 leading-tight">Unsaved Registry Changes</p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
               <button onClick={() => { setLocalCatalogs(JSON.parse(JSON.stringify(initialCatalogs))); setHasUnsavedChanges(false); playSound('warning'); }} className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-[11px] uppercase text-slate-400 hover:text-rose-600 transition-colors">Discard</button>
               <button onClick={handleGlobalSave} disabled={isSaving} className="flex-1 sm:flex-none bg-emerald-600 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-[12px] uppercase tracking-widest shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2 sm:gap-4">
                  {isSaving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : '⚡'}
                  {isSaving ? 'Synching...' : 'Commit Relay'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* SERVICE EDITOR MODAL */}
      {editingServiceId && editingServiceData && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[40px] sm:rounded-[56px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh]">
            <div className="p-8 sm:p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
               <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 uppercase tracking-tight">{editingServiceId === 'new' ? 'Initialize Unit' : 'Calibrate Unit'}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Service Specification Hub</p>
               </div>
               <button onClick={() => setEditingServiceId(null)} className="p-4 bg-white rounded-2xl text-slate-400 hover:text-rose-600 transition-all active:scale-90 border border-slate-100 shadow-sm">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-8 no-scrollbar">
               <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Unit Designation</label>
                  <input 
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold uppercase tracking-wide focus:border-emerald-500 outline-none transition-all"
                    value={editingServiceData.name}
                    onChange={e => setEditingServiceData({ ...editingServiceData, name: e.target.value.toUpperCase() })}
                    placeholder="E.G. SIGNATURE MASSAGE..."
                  />
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Market Yield (₱)</label>
                     <input 
                       type="number"
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold tabular-nums focus:border-emerald-500 outline-none transition-all"
                       value={editingServiceData.price}
                       onChange={e => setEditingServiceData({ ...editingServiceData, price: Number(e.target.value) })}
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Duration (Mins)</label>
                     <input 
                       type="number"
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold tabular-nums focus:border-emerald-500 outline-none transition-all"
                       value={editingServiceData.duration}
                       onChange={e => setEditingServiceData({ ...editingServiceData, duration: Number(e.target.value) })}
                     />
                  </div>
               </div>

               <div className="space-y-6 pt-4 border-t border-slate-50">
                  <div className="flex items-center justify-between">
                     <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Lead Provider Configuration</h4>
                     <select 
                        className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest outline-none"
                        value={editingServiceData.primaryRole}
                        onChange={e => setEditingServiceData({ ...editingServiceData, primaryRole: e.target.value as ProviderRole })}
                     >
                        <option value="THERAPIST">THERAPIST</option>
                        <option value="BONESETTER">BONESETTER</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="TRAINEE">TRAINEE</option>
                     </select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pay Model</label>
                        <select 
                           className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold uppercase tracking-wide outline-none"
                           value={editingServiceData.commissionType}
                           onChange={e => setEditingServiceData({ ...editingServiceData, commissionType: e.target.value as CommissionType })}
                        >
                           <option value="fixed">FIXED (₱)</option>
                           <option value="percentage">PERCENTAGE (%)</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pay Value</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold tabular-nums focus:border-emerald-500 outline-none transition-all"
                          value={editingServiceData.commissionValue}
                          onChange={e => setEditingServiceData({ ...editingServiceData, commissionValue: Number(e.target.value) })}
                        />
                     </div>
                  </div>
               </div>

               <div className="pt-6 border-t border-slate-50 space-y-6">
                  <label className="flex items-center gap-4 cursor-pointer group">
                     <div className="relative">
                        <input 
                          type="checkbox"
                          className="sr-only"
                          checked={editingServiceData.isDualProvider}
                          onChange={e => setEditingServiceData({ ...editingServiceData, isDualProvider: e.target.checked })}
                        />
                        <div className={`w-14 h-8 rounded-full transition-colors duration-300 ${editingServiceData.isDualProvider ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${editingServiceData.isDualProvider ? 'translate-x-6' : ''}`}></div>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Dual Provider Relay</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Enable secondary support commission</span>
                     </div>
                  </label>

                  {editingServiceData.isDualProvider && (
                    <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Support Pay Model</label>
                          <select 
                             className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold uppercase tracking-wide outline-none"
                             value={editingServiceData.secondaryCommissionType || 'fixed'}
                             onChange={e => setEditingServiceData({ ...editingServiceData, secondaryCommissionType: e.target.value as CommissionType })}
                          >
                             <option value="fixed">FIXED (₱)</option>
                             <option value="percentage">PERCENTAGE (%)</option>
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Support Pay Value</label>
                          <input 
                            type="number"
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold tabular-nums focus:border-emerald-500 outline-none transition-all"
                            value={editingServiceData.secondaryCommissionValue || 0}
                            onChange={e => setEditingServiceData({ ...editingServiceData, secondaryCommissionValue: Number(e.target.value) })}
                          />
                       </div>
                    </div>
                  )}
               </div>
            </div>

            <div className="p-8 sm:p-10 bg-slate-50/50 border-t border-slate-50">
               <button 
                 onClick={handleSaveService}
                 className="w-full bg-slate-900 text-white py-6 rounded-[24px] sm:rounded-[32px] font-bold text-[12px] uppercase tracking-[0.3em] shadow-xl hover:bg-emerald-600 transition-all active:scale-95"
               >
                 Commit Specification
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};