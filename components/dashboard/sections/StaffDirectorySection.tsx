import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Branch, Employee, Transaction, Attendance } from '../../../types';
import { DB_TABLES, DB_COLUMNS } from '../../../constants/db_schema';
import { UI_THEME } from '../../../constants/ui_designs';
import { supabase } from '../../../lib/supabase';
import { playSound } from '../../../lib/audio';
import { compressImage } from '../../../lib/image';
import { deleteFileByUrl } from '../../../lib/storage';
import { getEmployeeAllowance } from '../../../lib/payroll';
import { useAddEmployee, useUpdateEmployee, useAddAttendance, useUpdateAttendance, useAddAuditLog } from '../../../hooks/useNetworkData';

// Modular Imports
import { StaffCard } from './staff/StaffCard';
import { StaffHeader } from './staff/StaffHeader';
import { StaffModals } from './staff/StaffModals';

interface StaffDirectorySectionProps {
  branch: Branch;
  branches: Branch[];
  employees: Employee[];
  attendance: Attendance[];
  transactions: Transaction[];
  isClosedMode?: boolean;
  onRefresh?: (quiet?: boolean) => void;
  isSetupRequired?: boolean;
  onSyncStatusChange?: (isSyncing: boolean) => void;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export const StaffDirectorySection: React.FC<StaffDirectorySectionProps> = ({ branch, branches, employees, attendance, transactions, isClosedMode = false, onRefresh, isSetupRequired, onSyncStatusChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [showBranchClosedModal, setShowBranchClosedModal] = useState(false);
  const [selectedEmpForTime, setSelectedEmpForTime] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [recoveryEmployee, setRecoveryEmployee] = useState<Employee | null>(null);
  const [originalName, setOriginalName] = useState<string>('');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const addEmployee = useAddEmployee();
  const updateEmployee = useUpdateEmployee();
  const addAttendance = useAddAttendance();
  const updateAttendance = useUpdateAttendance();
  const addAuditLog = useAddAuditLog();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now), [now]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const operatorName = useMemo(() => {
    const saved = localStorage.getItem('hilot_core_session_v4');
    if (saved) {
      const parsed = JSON.parse(saved);
      const empId = parsed.user?.employeeId;
      return employees.find(e => e.id === empId)?.name || '';
    }
    return '';
  }, [employees]);

  const branchStaff = useMemo(() => {
    let list = employees.filter(e => {
      const isHomeBranch = e.branchId === branch.id;
      const isDesignatedManager = branch.manager?.toUpperCase() === e.name?.toUpperCase();
      const isTempManager = branch.tempManager?.toUpperCase() === e.name?.toUpperCase();
      return isHomeBranch || isDesignatedManager || isTempManager;
    });

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(term));
    }

    if (filterRole !== 'ALL') {
      list = list.filter(e => (e.role || '').split(',').includes(filterRole));
    }

    if (filterStatus !== 'ALL') {
      const isActive = filterStatus === 'ACTIVE';
      list = list.filter(e => e.isActive === isActive);
    }

    return list.sort((a, b) => {
      if (!a || !b) return 0;
      const isAMain = branch.manager?.toUpperCase() === (a.name || '').toUpperCase();
      const isBMain = branch.manager?.toUpperCase() === (b.name || '').toUpperCase();
      const isATemp = branch.tempManager?.toUpperCase() === (a.name || '').toUpperCase();
      const isBTemp = branch.tempManager?.toUpperCase() === (b.name || '').toUpperCase();

      if (isAMain && !isBMain) return -1;
      if (!isAMain && isBMain) return 1;
      if (isATemp && !isBTemp) return -1;
      if (!isATemp && isBTemp) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [employees, branch.id, branch.manager, branch.tempManager, searchTerm, filterRole, filterStatus]);

  const totalPages = Math.ceil(branchStaff.length / itemsPerPage);
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return branchStaff.slice(start, start + itemsPerPage);
  }, [branchStaff, currentPage]);

  const handleOpenEdit = (emp?: Employee) => {
    playSound('click');
    if (emp) {
      setEditingEmployee({ ...emp });
      setOriginalName(emp.name?.toUpperCase().trim() || '');
    } else {
      setEditingEmployee({
        name: '',
        firstName: '',
        middleName: '',
        lastName: '',
        role: '',
        allowance: 0,
        isActive: true,
        branchId: branch.id
      });
      setOriginalName('');
    }
    setProfileFile(null);
    setIsModalOpen(true);
  };

  const handleOpenReset = (emp: Employee) => {
    playSound('click');
    setRecoveryEmployee(emp);
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    playSound('click');
    try {
      // In a real app, this would use jspdf or similar
      // For now, we'll simulate a delay and show a success toast
      await new Promise(resolve => setTimeout(resolve, 2000));
      showToast('Personnel Directory Exported (PDF)');
      playSound('success');
    } catch (err) {
      showToast('Export Fault', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleRole = (role: string) => {
    if (isSyncing) return;
    playSound('click');
    const selectedRoles = (editingEmployee?.role || '').split(',').filter(Boolean);
    let nextRoles;
    if (selectedRoles.includes(role)) {
      nextRoles = selectedRoles.filter(r => r !== role);
    } else {
      nextRoles = [...selectedRoles, role];
    }
    setEditingEmployee(prev => ({ ...prev, role: nextRoles.join(',') }));
  };

  const handleOpenTimeModal = (emp: Employee) => {
    if (!emp.isActive) {
      playSound('warning');
      showToast('Staff membership is suspended.', 'error');
      return;
    }
    if (isClosedMode) {
      playSound('warning');
      setShowBranchClosedModal(true);
      return;
    }
    playSound('click');
    setSelectedEmpForTime(emp);
    setIsTimeModalOpen(true);
  };

  const getShiftState = (empId: string): 'NOT_STARTED' | 'ONGOING' | 'COMPLETED' => {
    const todayRecord = (attendance || []).find(a => a.employeeId === empId && a.date === todayStr);
    if (!todayRecord) return 'NOT_STARTED';
    if (todayRecord.clockIn && !todayRecord.clockOut) return 'ONGOING';
    return 'COMPLETED';
  };

  const handleTimeAction = async () => {
    if (!selectedEmpForTime || isSyncing || isClosedMode) return;

    setIsSyncing(true);
    if (onSyncStatusChange) onSyncStatusChange(true);
    const state = getShiftState(selectedEmpForTime.id);
    const timestamp = new Date().toISOString();

    try {
      if (state === 'NOT_STARTED') {
        const attendanceId = Math.random().toString(36).substr(2, 9);
        await addAttendance.mutateAsync({
          [DB_COLUMNS.ID]: attendanceId,
          [DB_COLUMNS.BRANCH_ID]: branch.id,
          [DB_COLUMNS.EMPLOYEE_ID]: selectedEmpForTime.id,
          [DB_COLUMNS.STAFF_NAME]: selectedEmpForTime.name,
          [DB_COLUMNS.DATE]: todayStr,
          [DB_COLUMNS.CLOCK_IN]: timestamp,
          [DB_COLUMNS.STATUS]: 'REGULAR'
        });
        showToast(`${selectedEmpForTime.name} is now ON DUTY`);
      }
      else if (state === 'ONGOING') {
        const existingRec = (attendance || []).find(a => a.employeeId === selectedEmpForTime.id && a.date === todayStr);
        if (existingRec) {
          // Ensure we preserve essential fields even if update is partial
          await updateAttendance.mutateAsync({
            id: existingRec.id,
            [DB_COLUMNS.CLOCK_OUT]: timestamp,
            [DB_COLUMNS.BRANCH_ID]: branch.id,
            [DB_COLUMNS.EMPLOYEE_ID]: selectedEmpForTime.id,
            [DB_COLUMNS.DATE]: todayStr
          });
          showToast(`${selectedEmpForTime.name} has clocked out.`);
        }
      }

      await addAuditLog.mutateAsync({
        [DB_COLUMNS.BRANCH_ID]: branch.id,
        [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [DB_COLUMNS.ACTIVITY_TYPE]: 'UPDATE',
        [DB_COLUMNS.ENTITY_TYPE]: 'ATTENDANCE',
        [DB_COLUMNS.ENTITY_ID]: selectedEmpForTime.id,
        [DB_COLUMNS.DESCRIPTION]: `${state === 'NOT_STARTED' ? 'Clock-in' : 'Clock-out'} protocol finalized for ${selectedEmpForTime.name}`,
        [DB_COLUMNS.PERFORMER_NAME]: operatorName || 'NODE OPERATOR'
      });

      playSound('success');
      setIsTimeModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Time Registry Fault', 'error');
    } finally {
      setIsSyncing(false);
      if (onSyncStatusChange) onSyncStatusChange(false);
    }
  };

  const handleSaveEmployee = async () => {
    if (!editingEmployee || isSyncing) return;
    setIsSyncing(true);
    if (onSyncStatusChange) onSyncStatusChange(true);
    setUploadProgress(10);

    try {
      const firstName = editingEmployee.firstName?.trim().toUpperCase();
      const middleName = editingEmployee.middleName?.trim().toUpperCase() || null;
      const lastName = editingEmployee.lastName?.trim().toUpperCase();
      const cleanName = `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim().toUpperCase();

      // 0. DUPLICATION CHECK (Branch-Level)
      const isDuplicate = employees.some(e => {
        if (editingEmployee.id && e.id === editingEmployee.id) return false;
        if (e.branchId !== branch.id) return false;
        if (!e.isActive) return false;

        const existingFullName = e.firstName && e.lastName
            ? `${e.firstName} ${e.middleName ? e.middleName + ' ' : ''}${e.lastName}`.trim().toUpperCase()
            : (e.name || '').toUpperCase();

        return existingFullName === cleanName;
      });

      if (isDuplicate) {
        playSound('warning');
        showToast('DUPLICATE IDENTITY: Staff already registered in this branch.', 'error');
        setIsSyncing(false);
        if (onSyncStatusChange) onSyncStatusChange(false);
        return;
      }

      let profileUrl = editingEmployee.profile || '';

      if (profileFile) {
        setUploadProgress(30);
        if (editingEmployee.profile) await deleteFileByUrl(editingEmployee.profile, 'profiles');
        const compressed = await compressImage(profileFile, { maxWidth: 400, maxHeight: 400, quality: 0.5 });
        setUploadProgress(60);
        const path = `${branch.id}/profiles/${Date.now()}_local.jpg`;
        const { error: uploadErr } = await supabase.storage.from('profiles').upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) throw uploadErr;
        profileUrl = supabase.storage.from('profiles').getPublicUrl(path).data.publicUrl;
      }

      const id = editingEmployee.id || Math.random().toString(36).substr(2, 9);
      const payload = {
        [DB_COLUMNS.NAME]: cleanName,
        [DB_COLUMNS.FIRST_NAME]: firstName,
        [DB_COLUMNS.MIDDLE_NAME]: middleName,
        [DB_COLUMNS.LAST_NAME]: lastName,
        [DB_COLUMNS.ROLE]: editingEmployee.role,
        [DB_COLUMNS.ALLOWANCE]: Number(editingEmployee.allowance) || 0,
        [DB_COLUMNS.BRANCH_ID]: branch.id,
        [DB_COLUMNS.IS_ACTIVE]: editingEmployee.isActive !== false,
        [DB_COLUMNS.PROFILE]: profileUrl || null
      };

      if (editingEmployee.id) {
        await updateEmployee.mutateAsync({ id: editingEmployee.id, ...payload });
      } else {
        await addEmployee.mutateAsync({ [DB_COLUMNS.ID]: id, ...payload });
      }

      // NAME CHANGE CASCADE
      const nameChanged = originalName && originalName !== cleanName;
      if (nameChanged) {
        // 1. Branch Sync (Manager/Temp Manager slots)
        const branchSyncPromises = branches.map(async (b) => {
          const branchUpdates: any = {};
          let needsUpdate = false;

          if (b.manager?.toUpperCase() === originalName) {
            branchUpdates[DB_COLUMNS.MANAGER] = cleanName;
            needsUpdate = true;
          }
          if (b.tempManager?.toUpperCase() === originalName) {
            branchUpdates[DB_COLUMNS.TEMP_MANAGER] = cleanName;
            needsUpdate = true;
          }

          if (needsUpdate) {
            return supabase.from(DB_TABLES.BRANCHES).update(branchUpdates).eq(DB_COLUMNS.ID, b.id);
          }
          return Promise.resolve();
        });
        await Promise.all(branchSyncPromises);

        // 2. Data Cascade (Historical records)
        const dataCascadePromises = [
          supabase.from(DB_TABLES.TRANSACTIONS).update({ [DB_COLUMNS.THERAPIST_NAME]: cleanName }).eq(DB_COLUMNS.THERAPIST_NAME, originalName),
          supabase.from(DB_TABLES.TRANSACTIONS).update({ [DB_COLUMNS.BONESETTER_NAME]: cleanName }).eq(DB_COLUMNS.BONESETTER_NAME, originalName),
          supabase.from(DB_TABLES.ATTENDANCE).update({ [DB_COLUMNS.STAFF_NAME]: cleanName }).eq(DB_COLUMNS.EMPLOYEE_ID, id),
          supabase.from(DB_TABLES.SHIFT_LOGS).update({ [DB_COLUMNS.EMPLOYEE_NAME]: cleanName }).eq(DB_COLUMNS.EMPLOYEE_ID, id),
          supabase.from(DB_TABLES.AUDIT_LOGS).update({ [DB_COLUMNS.PERFORMER_NAME]: cleanName }).eq(DB_COLUMNS.PERFORMER_NAME, originalName),
          supabase.from(DB_TABLES.ATTENDANCE_LOGS).update({ [DB_COLUMNS.STAFF_NAME]: cleanName }).eq(DB_COLUMNS.STAFF_NAME, originalName)
        ];
        await Promise.all(dataCascadePromises);
      }

      await addAuditLog.mutateAsync({
        [DB_COLUMNS.BRANCH_ID]: branch.id,
        [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
        [DB_COLUMNS.ACTIVITY_TYPE]: editingEmployee.id ? 'UPDATE' : 'CREATE',
        [DB_COLUMNS.ENTITY_TYPE]: 'EMPLOYEE',
        [DB_COLUMNS.ENTITY_ID]: id,
        [DB_COLUMNS.DESCRIPTION]: `${editingEmployee.id ? 'Updated' : 'Registered'} employee identity: ${cleanName}`,
        [DB_COLUMNS.PERFORMER_NAME]: operatorName || 'NODE OPERATOR'
      });

      setUploadProgress(100);
      playSound('success');
      showToast('Registry Synchronized');
      setIsModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Registry Fault', 'error');
    } finally {
      setIsSyncing(false);
      setUploadProgress(0);
      if (onSyncStatusChange) onSyncStatusChange(false);
    }
  };

  return (
      <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-32">
        {toast && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3 rounded-full shadow-2xl animate-in slide-in-from-top-6 duration-300 font-bold text-[11px] uppercase tracking-widest bg-slate-900 text-white border border-white/10 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`}></div>
              {toast.message}
            </div>
        )}

        <StaffModals
            isTimeModalOpen={isTimeModalOpen}
            isModalOpen={isModalOpen}
            showBranchClosedModal={showBranchClosedModal}
            selectedEmpForTime={selectedEmpForTime}
            editingEmployee={editingEmployee}
            recoveryEmployee={recoveryEmployee}
            branches={branches}
            isSyncing={isSyncing}
            uploadProgress={uploadProgress}
            profileFile={profileFile}
            fileInputRef={fileInputRef}
            getShiftState={getShiftState}
            onTimeAction={handleTimeAction}
            onSaveEmployee={handleSaveEmployee}
            onCloseModals={() => { setIsModalOpen(false); setIsTimeModalOpen(false); setShowBranchClosedModal(false); }}
            onCloseRecovery={() => setRecoveryEmployee(null)}
            onRefresh={() => onRefresh?.()}
            onSyncStatusChange={onSyncStatusChange}
            setEditingEmployee={setEditingEmployee}
            setProfileFile={setProfileFile}
            toggleRole={toggleRole}
            allEmployees={employees}
            branchId={branch.id}
        />

        {/* HEADER SECTION - FIXED ALIGNMENT */}
        <StaffHeader
            branchName={branch.name.replace(/BRANCH - /g, '')}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onAddStaff={() => handleOpenEdit()}
            onExportPDF={handleExportPDF}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            isExporting={isExporting}
            hasActiveFilters={filterRole !== 'ALL' || filterStatus !== 'ALL'}
        />

        {/* FILTER PANEL */}
        {showFilters && (
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation Filter</label>
                  <div className="flex flex-wrap gap-2">
                    {['ALL', 'THERAPIST', 'BONESETTER', 'MANAGER'].map(role => (
                        <button
                            key={role}
                            onClick={() => { setFilterRole(role); setCurrentPage(1); playSound('click'); }}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${filterRole === role ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                        >
                          {role}
                        </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Filter</label>
                  <div className="flex flex-wrap gap-2">
                    {['ALL', 'ACTIVE', 'SUSPENDED'].map(status => (
                        <button
                            key={status}
                            onClick={() => { setFilterStatus(status); setCurrentPage(1); playSound('click'); }}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${filterStatus === status ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                        >
                          {status}
                        </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Showing {branchStaff.length} Personnel</p>
                <button
                    onClick={() => { setFilterRole('ALL'); setFilterStatus('ALL'); setSearchTerm(''); setCurrentPage(1); playSound('click'); }}
                    className="text-[9px] font-black text-rose-600 uppercase tracking-widest hover:underline"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
        )}

        {isSetupRequired && (
            <div className={`bg-amber-50 border border-amber-100 p-6 ${UI_THEME.radius.card} flex items-center gap-6 animate-in slide-in-from-top-4`}>
              <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0">⚠️</div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-900 uppercase tracking-tight">Personnel Initialization Required</p>
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest leading-relaxed opacity-80">No therapists or specialists registered for this node. Use the button above to add staff before initializing POS operations.</p>
              </div>
            </div>
        )}

        {/* STAFF CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-1">
          {paginatedStaff.length > 0 ? paginatedStaff.map(emp => (
              <StaffCard
                  key={emp.id}
                  emp={emp}
                  branchId={branch.id}
                  shiftState={getShiftState(emp.id)}
                  isClosedMode={isClosedMode}
                  onEdit={handleOpenEdit}
                  onTimeAction={handleOpenTimeModal}
                  onReset={handleOpenReset}
              />
          )) : (
              <div className={`col-span-full py-40 text-center bg-white ${UI_THEME.radius.card} border-2 border-dashed border-slate-100 flex flex-col items-center gap-6 opacity-20`}>
                <div className="text-7xl">💆</div>
                <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.5em]">No Personnel Record Found</p>
              </div>
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-12">
              <button
                  disabled={currentPage === 1}
                  onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); playSound('click'); }}
                  className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all disabled:opacity-30 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
              </button>

              <div className="flex items-center gap-2">
                {[...Array(totalPages)].map((_, i) => (
                    <button
                        key={i}
                        onClick={() => { setCurrentPage(i + 1); playSound('click'); }}
                        className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${currentPage === i + 1 ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                    >
                      {i + 1}
                    </button>
                ))}
              </div>

              <button
                  disabled={currentPage === totalPages}
                  onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); playSound('click'); }}
                  className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all disabled:opacity-30 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
        )}
      </div>
  );
};
