import React, { useState, useMemo, useEffect } from 'react';
import { Branch, Transaction, Expense, Service, AuditLog, SalesReport, Employee, Attendance, UserRole } from '../../types';
import { UI_THEME } from '../../constants/ui_designs';
import { supabase } from '../../lib/supabase';
import { DB_TABLES, DB_COLUMNS } from '../../constants/db_schema';

// Modular Imports
import { ServiceCatalog, CatalogGroup } from './ServiceCatalog';
import { NetworkManager } from './NetworkManager';
import { BranchEditor } from './BranchEditor';
import { SalesHub } from './SalesHub';
import { GlobalServicesMatrix } from './Matrix';
import { SettingsHub } from './SettingsHub';
import { ArchiveHub } from './ArchiveHub';
import { AnalyticsHub } from './AnalyticsHub';
import { GlobalEmployeeManager } from './GlobalEmployeeManager';
import { GlobalAuditHub } from './GlobalAuditHub';
import { AttendanceHub } from './AttendanceHub';
import { MassBackfillHub } from './MassBackfillHub';
import { ExpensesHub } from './ExpensesHub';
import { HowToSection } from '../dashboard/sections/HowToSection';
import { SuperAdminNavbar } from '../navigation/SuperAdminNavbar';
import { playSound, resumeAudioContext } from '../../lib/audio';
import { toDateStr } from '@/src/utils/reportUtils';
import { useUpdateBranch, useDeleteBranch, useAddBranch, useAddAuditLog } from '../../hooks/useNetworkData';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  variant?: 'danger' | 'success' | 'warning';
  confirmText?: string;
  showCancel?: boolean;
}

interface SuperAdminDashboardProps {
  branches: Branch[];
  transactions: Transaction[];
  expenses: Expense[];
  employees: Employee[];
  attendance: Attendance[];
  auditLogs: AuditLog[];
  onlineUsers: Record<string, boolean>;
  salesReports: SalesReport[];
  onRefresh?: (quiet?: boolean) => void;
  onSyncStatusChange?: (isSyncing: boolean) => void;
}

type AdminTab = 'network' | 'services' | 'matrix' | 'sales_hub' | 'analytics' | 'employees' | 'archive' | 'settings' | 'audit' | 'how_to' | 'backfill' | 'expenses' | 'attendance';

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ branches, transactions, expenses, auditLogs, salesReports, employees, attendance, onRefresh, onSyncStatusChange }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('sales_hub');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [masterCatalogs, setMasterCatalogs] = useState<CatalogGroup[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const updateBranch = useUpdateBranch();
  const deleteBranch = useDeleteBranch();
  const addBranch = useAddBranch();
  const addAuditLog = useAddAuditLog();

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const { data, error } = await supabase.from(DB_TABLES.SERVICE_CATALOGS).select('*').order(DB_COLUMNS.NAME);
        if (data) {
          const normalized = data.map((d: any) => {
            const catId = d[DB_COLUMNS.ID];
            const catName = d[DB_COLUMNS.NAME];
            const services = (d[DB_COLUMNS.SERVICES] || []).map((s: any) => ({
              ...s,
              catalogId: s.catalogId || catId,
              catalogName: s.catalogName || catName
            }));
            return {
              id: catId,
              name: catName,
              services,
              branchIds: d[DB_COLUMNS.BRANCH_IDS] || []
            };
          });
          setMasterCatalogs(normalized);
        }
      } catch (err) {}
    };
    loadCatalogs();
  }, [activeTab]);

  const handleSaveBranch = async (updated: Branch) => {
    setIsSaving(true);
    if (onSyncStatusChange) onSyncStatusChange(true);
    try {
      const hasManager = updated.manager && updated.manager.trim() !== '';
      const finalIsPinChanged = hasManager ? updated.isPinChanged : false;

      await updateBranch.mutateAsync({
        id: updated.id,
        [DB_COLUMNS.NAME]: updated.name,
        [DB_COLUMNS.MANAGER]: updated.manager,
        [DB_COLUMNS.IS_PIN_CHANGED]: finalIsPinChanged,
        [DB_COLUMNS.IS_OPEN]: updated.isOpen,
        [DB_COLUMNS.WEEKLY_CUTOFF]: updated.weeklyCutoff.toString(),
        [DB_COLUMNS.CYCLE_START_DATE]: updated.cycleStartDate,
        [DB_COLUMNS.DAILY_PROVISION_AMOUNT]: updated.dailyProvisionAmount,
        [DB_COLUMNS.ENABLE_SHIFT_TRACKING]: updated.enableShiftTracking,
        [DB_COLUMNS.OPENING_TIME]: updated.openingTime,
        [DB_COLUMNS.CLOSING_TIME]: updated.closingTime
      });

      onRefresh?.(true);
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setIsSaving(false);
      if (onSyncStatusChange) onSyncStatusChange(false);
    }
  };

  const handleToggleBranch = async (id: string, currentlyEnabled: boolean) => {
    try {
      await updateBranch.mutateAsync({
        id,
        [DB_COLUMNS.IS_ENABLED]: !currentlyEnabled
      });

      const b = branches.find(br => br.id === id);
      await addAuditLog.mutateAsync({
        [DB_COLUMNS.BRANCH_ID]: id,
        [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [DB_COLUMNS.ACTIVITY_TYPE]: 'UPDATE',
        [DB_COLUMNS.ENTITY_TYPE]: 'BRANCH',
        [DB_COLUMNS.ENTITY_ID]: id,
        [DB_COLUMNS.DESCRIPTION]: `Terminal access ${currentlyEnabled ? 'SUSPENDED' : 'RESTORED'} for ${b?.name}`,
        [DB_COLUMNS.PERFORMER_NAME]: 'SYSTEM ADMIN'
      });

      onRefresh?.(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPin = async (branch: Branch) => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      await updateBranch.mutateAsync({
        id: branch.id,
        [DB_COLUMNS.PIN]: newPin,
        [DB_COLUMNS.IS_PIN_CHANGED]: false
      });

      await addAuditLog.mutateAsync({
        [DB_COLUMNS.BRANCH_ID]: branch.id,
        [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [DB_COLUMNS.ACTIVITY_TYPE]: 'UPDATE',
        [DB_COLUMNS.ENTITY_TYPE]: 'SECURITY',
        [DB_COLUMNS.ENTITY_ID]: branch.id,
        [DB_COLUMNS.DESCRIPTION]: `Access PIN reset by SuperAdmin for ${branch.name}`,
        [DB_COLUMNS.PERFORMER_NAME]: 'SYSTEM ADMIN'
      });

      onRefresh?.(true);
      return newPin;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleDeleteBranch = async (id: string) => {
    try {
      const b = branches.find(br => br.id === id);
      await deleteBranch.mutateAsync(id);

      await addAuditLog.mutateAsync({
        [DB_COLUMNS.BRANCH_ID]: null,
        [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [DB_COLUMNS.ACTIVITY_TYPE]: 'DELETE',
        [DB_COLUMNS.ENTITY_TYPE]: 'BRANCH',
        [DB_COLUMNS.ENTITY_ID]: id,
        [DB_COLUMNS.DESCRIPTION]: `Terminal node ERASED: ${b?.name}`,
        [DB_COLUMNS.PERFORMER_NAME]: 'SYSTEM ADMIN'
      });

      onRefresh?.(true);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleForceLogout = async (branchId: string) => {
    try {
      const { data: configData } = await supabase.from(DB_TABLES.SYSTEM_CONFIG).select('*').eq(DB_COLUMNS.KEY, 'force_logout_registry').single();
      let registry: Record<string, number> = {};
      if (configData) {
        try { registry = JSON.parse(configData.value); } catch {}
      }
      registry[branchId] = Date.now();

      const { error } = await supabase.from(DB_TABLES.SYSTEM_CONFIG).upsert({
        [DB_COLUMNS.KEY]: 'force_logout_registry',
        [DB_COLUMNS.VALUE]: JSON.stringify(registry)
      }, { onConflict: DB_COLUMNS.KEY });

      if (error) throw error;

      const b = branches.find(br => br.id === branchId);
      await addAuditLog.mutateAsync({
        [DB_COLUMNS.BRANCH_ID]: branchId,
        [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [DB_COLUMNS.ACTIVITY_TYPE]: 'UPDATE',
        [DB_COLUMNS.ENTITY_TYPE]: 'SECURITY',
        [DB_COLUMNS.ENTITY_ID]: branchId,
        [DB_COLUMNS.DESCRIPTION]: `Remote session termination triggered by SuperAdmin for ${b?.name}`,
        [DB_COLUMNS.PERFORMER_NAME]: 'SYSTEM ADMIN'
      });

      onRefresh?.(true);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || isSaving) return;
    setIsSaving(true);
    if (onSyncStatusChange) onSyncStatusChange(true);
    try {
      const id = Math.random().toString(36).substr(2, 9);
      const cleanName = newBranchName.trim().toUpperCase();
      const initialPin = Math.floor(100000 + Math.random() * 900000).toString();

      await addBranch.mutateAsync({
        [DB_COLUMNS.ID]: id,
        [DB_COLUMNS.NAME]: cleanName,
        [DB_COLUMNS.PIN]: initialPin,
        [DB_COLUMNS.IS_PIN_CHANGED]: false,
        [DB_COLUMNS.IS_ENABLED]: true,
        [DB_COLUMNS.CYCLE_START_DATE]: toDateStr(new Date()),
        [DB_COLUMNS.WEEKLY_CUTOFF]: '0'
      });

      await addAuditLog.mutateAsync({
        [DB_COLUMNS.BRANCH_ID]: id,
        [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [DB_COLUMNS.ACTIVITY_TYPE]: 'CREATE',
        [DB_COLUMNS.ENTITY_TYPE]: 'BRANCH',
        [DB_COLUMNS.ENTITY_ID]: id,
        [DB_COLUMNS.DESCRIPTION]: `New physical terminal node DEPLOYED: ${cleanName}`,
        [DB_COLUMNS.PERFORMER_NAME]: 'SYSTEM ADMIN'
      });

      setNewBranchName('');
      setShowAddModal(false);
      playSound('success');
      onRefresh?.(true);
    } catch (e) {
      console.error(e);
      setConfirmState({
        isOpen: true,
        title: 'REGISTRATION FAILED',
        message: 'Could not establish new terminal node. This may be due to a network interruption or duplicate identifier. Please verify connection and retry.',
        variant: 'danger',
        confirmText: 'Acknowledge Error',
        showCancel: false,
        onConfirm: () => setConfirmState(p => ({ ...p, isOpen: false }))
      });
    } finally {
      setIsSaving(false);
      if (onSyncStatusChange) onSyncStatusChange(false);
    }
  };

  const handleTabChange = (id: AdminTab) => {
    resumeAudioContext();
    setActiveTab(id);
    setEditingBranchId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'network': return <NetworkManager branches={branches} onAdd={() => setShowAddModal(true)} onEdit={setEditingBranchId} onToggle={handleToggleBranch} />;
      case 'services': return (
          <ServiceCatalog
              branches={branches}
              catalogs={masterCatalogs}
              onSave={async (cats) => {
                setMasterCatalogs(cats);
                playSound('success');
                if (onRefresh) await onRefresh(true);
              }}
          />
      );
      case 'matrix': return <GlobalServicesMatrix catalogs={masterCatalogs} />;
      case 'sales_hub': return <SalesHub branches={branches} salesReports={salesReports} employees={employees} onRefresh={onRefresh} />;
      case 'analytics': return <AnalyticsHub branches={branches} salesReports={salesReports} />;
      case 'employees': return <GlobalEmployeeManager branches={branches} employees={employees} onRefresh={() => onRefresh?.()} onSyncStatusChange={onSyncStatusChange} />;
      case 'archive': return <ArchiveHub branches={branches} salesReports={salesReports} employees={employees} />;
      case 'settings': return <SettingsHub onRefresh={onRefresh} />;
      case 'audit': return <GlobalAuditHub branches={branches} auditLogs={auditLogs} />;
      case 'attendance': return <AttendanceHub attendance={attendance} branches={branches} employees={employees} />;
      case 'expenses': return <ExpensesHub branches={branches} salesReports={salesReports} />;
      case 'backfill': return <MassBackfillHub branches={branches} employees={employees} salesReports={salesReports} onRefresh={() => onRefresh?.()} />;
      case 'how_to': return <HowToSection role={UserRole.SUPERADMIN} />;
      default: return null;
    }
  };

  const editingBranch = branches.find(b => b.id === editingBranchId);

  return (
      <div className="bg-slate-50 min-h-screen flex flex-col">
        {confirmState.isOpen && (
            <div className={UI_THEME.layout.modalWrapper}>
              <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-6 sm:p-10 text-center border border-slate-100`}>
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-8 shadow-xl ${confirmState.variant === 'danger' ? 'bg-rose-50 text-rose-500' : confirmState.variant === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className={UI_THEME.text.title}>{confirmState.title}</h3>
                <p className={`${UI_THEME.text.metadata} leading-relaxed mb-6 sm:mb-10`}>{confirmState.message}</p>
                <div className="flex flex-col gap-3">
                  <button
                      onClick={confirmState.onConfirm}
                      className={`w-full py-4 sm:py-6 ${UI_THEME.radius.pill} ${UI_THEME.text.metadata} shadow-xl ${UI_THEME.styles.buttonBase} ${confirmState.variant === 'danger' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-slate-900 hover:bg-emerald-600 text-white'}`}
                  >
                    {confirmState.confirmText || 'Confirm Authorization'}
                  </button>
                  {confirmState.showCancel !== false && (
                      <button onClick={() => setConfirmState(p => ({...p, isOpen: false}))} className={`w-full py-2 sm:py-4 text-slate-400 ${UI_THEME.text.metadata}`}>Cancel / Go Back</button>
                  )}
                </div>
              </div>
            </div>
        )}

        {showAddModal && (
            <div className={UI_THEME.layout.modalWrapper}>
              <form onSubmit={handleAddBranch} className={`${UI_THEME.layout.modalLarge} ${UI_THEME.radius.modal} p-6 sm:p-10 space-y-4 sm:space-y-8`}>
                <div className="text-center space-y-1 sm:space-y-2">
                  <h3 className={UI_THEME.text.title}>Register Terminal</h3>
                  <p className={UI_THEME.text.metadata}>Establish New Physical Node</p>
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <label className={UI_THEME.text.label}>Terminal Designation (Name)</label>
                  <input
                      autoFocus
                      required
                      value={newBranchName}
                      onChange={e => setNewBranchName(e.target.value.toUpperCase())}
                      placeholder="E.G. MANDALUYONG CENTRAL..."
                      className={`${UI_THEME.styles.inputBase} ${UI_THEME.radius.input} font-black text-sm sm:text-base uppercase`}
                  />
                </div>
                <div className="flex flex-col gap-3 pt-2 sm:pt-4">
                  <button type="submit" disabled={isSaving || !newBranchName.trim()} className={`w-full bg-slate-900 text-white font-black py-4 sm:py-6 ${UI_THEME.radius.pill} ${UI_THEME.text.metadata} shadow-xl hover:bg-emerald-600 ${UI_THEME.styles.buttonBase}`}>
                    {isSaving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'Register Node'}
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} className={`w-full py-2 sm:py-4 text-slate-400 ${UI_THEME.text.metadata}`}>Cancel</button>
                </div>
              </form>
            </div>
        )}

        {editingBranchId && editingBranch && (
            <BranchEditor
                branch={editingBranch}
                employees={employees}
                masterServices={masterCatalogs.flatMap(c => c.services)}
                transactions={transactions}
                salesReports={salesReports}
                attendance={attendance}
                onSave={handleSaveBranch}
                onToggle={handleToggleBranch}
                onResetPin={handleResetPin}
                onForceLogout={handleForceLogout}
                onDelete={handleDeleteBranch}
                onClose={() => setEditingBranchId(null)}
                isSaving={isSaving}
                setConfirmState={setConfirmState as any}
            />
        )}

        <SuperAdminNavbar
            activeTab={activeTab}
            onTabChange={handleTabChange}
        />

        <main className={`flex-1 ${UI_THEME.layout.mainPadding} ${UI_THEME.layout.maxContent} w-full pb-32 pt-4 md:pt-8`}>
          {renderContent()}
        </main>
      </div>
  );
};

export default SuperAdminDashboard;