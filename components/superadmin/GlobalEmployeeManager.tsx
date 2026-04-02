import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Branch, Employee } from '../../types';
import { DB_TABLES, DB_COLUMNS } from '../../constants/db_schema';
import { UI_THEME } from '../../constants/ui_designs';
import { playSound } from '../../lib/audio';
import { compressImage } from '../../lib/image';
import { deleteFileByUrl } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { useAddEmployee, useUpdateEmployee, useUpdateBranch, useAddAuditLog } from '../../hooks/useNetworkData';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Pagination } from '../dashboard/sections/common/Pagination';

// Modular Components
import { EmployeeTable } from './employee-manager/EmployeeTable';
import { EmployeeMobileList } from './employee-manager/EmployeeMobileList';
import { RecoveryModal } from './employee-manager/RecoveryModal';
import { EditorModal } from './employee-manager/EditorModal';

interface GlobalEmployeeManagerProps {
    branches: Branch[];
    employees: Employee[];
    onRefresh?: () => void;
    onSyncStatusChange?: (isSyncing: boolean) => void;
}

export const GlobalEmployeeManager: React.FC<GlobalEmployeeManagerProps> = ({ branches, employees, onRefresh, onSyncStatusChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [sortBy, setSortBy] = useState<'name' | 'pay_asc' | 'pay_desc'>('name');

    const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
    const [showAdminWipeConfirm, setShowAdminWipeConfirm] = useState<Employee | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [showPrintConfirm, setShowPrintConfirm] = useState(false);

    const [resettingEmployee, setResettingEmployee] = useState<Employee | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const itemsPerPage = 15;

    const addEmployee = useAddEmployee();
    const updateEmployee = useUpdateEmployee();
    const updateBranch = useUpdateBranch();
    const addAuditLog = useAddAuditLog();

    const branchDropdownRef = useRef<HTMLDivElement>(null);
    const roleDropdownRef = useRef<HTMLDivElement>(null);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const sortDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) setIsBranchDropdownOpen(false);
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) setIsRoleDropdownOpen(false);
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setIsStatusDropdownOpen(false);
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) setIsSortDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filteredEmployees = useMemo(() => {
        const targetBranch = branchFilter !== 'all' ? branches.find(b => b.id === branchFilter) : null;

        let res = employees.filter(e => {
            const isNodeMatch = branchFilter === 'all' || e.branchId === branchFilter;
            const isAssignedManagerOfFiltered = targetBranch && targetBranch.manager?.toUpperCase() === (e.name || '').toUpperCase();
            const isTarget = isNodeMatch || isAssignedManagerOfFiltered;

            const isStatusValid =
                statusFilter === 'all' ? true :
                    statusFilter === 'active' ? e.isActive !== false :
                        e.isActive === false;

            const isRoleMatch = roleFilter === 'all' || (e.role || '').includes(roleFilter);

            return isTarget && isStatusValid && isRoleMatch;
        });

        if (searchTerm.trim()) {
            const term = searchTerm.toUpperCase();
            res = res.filter(e => (e.name || '').toUpperCase().includes(term));
        }

        return res.sort((a, b) => {
            if (!a || !b) return 0;
            if (sortBy === 'pay_asc') return (a.allowance || 0) - (b.allowance || 0);
            if (sortBy === 'pay_desc') return (b.allowance || 0) - (a.allowance || 0);
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [employees, branchFilter, searchTerm, statusFilter, roleFilter, sortBy, branches]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, branchFilter, roleFilter, statusFilter, sortBy]);

    const paginatedEmployees = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredEmployees.slice(start, start + itemsPerPage);
    }, [filteredEmployees, currentPage]);

    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

    const handleOpenEdit = (emp?: Employee) => {
        playSound('click');
        if (emp) {
            setEditingEmployee({ ...emp });
        } else {
            setEditingEmployee({
                name: '',
                firstName: '',
                middleName: '',
                lastName: '',
                role: '',
                allowance: 0,
                isActive: true,
                branchId: branchFilter === 'all' ? '' : branchFilter
            });
        }
    };

    const handleOpenResetModal = (emp: Employee) => {
        playSound('click');
        setResettingEmployee(emp);
        setError('');
    };

    const handleAdminCredentialWipe = async () => {
        if (!showAdminWipeConfirm || isSaving) return;
        const target = showAdminWipeConfirm;

        setIsSaving(true);
        if (onSyncStatusChange) onSyncStatusChange(true);

        try {
            await updateEmployee.mutateAsync({
                id: target.id,
                [DB_COLUMNS.USERNAME]: null,
                [DB_COLUMNS.LOGIN_PIN]: null,
                [DB_COLUMNS.PIN_SALT]: null,
                [DB_COLUMNS.REQUEST_RESET]: false
            });

            // Only reset branch setup status if the wiped employee is currently the assigned manager
            const branch = branches.find(b => b.id === target.branchId);
            const isManager = branch?.manager?.toUpperCase() === (target.name || '').toUpperCase();

            if (isManager) {
                await updateBranch.mutateAsync({
                    id: target.branchId,
                    [DB_COLUMNS.IS_PIN_CHANGED]: false
                });
            }

            await addAuditLog.mutateAsync({
                [DB_COLUMNS.BRANCH_ID]: null,
                [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
                [DB_COLUMNS.ACTIVITY_TYPE]: 'UPDATE',
                [DB_COLUMNS.ENTITY_TYPE]: 'SECURITY',
                [DB_COLUMNS.ENTITY_ID]: target.id,
                [DB_COLUMNS.DESCRIPTION]: `Administrator handled credentials reset for: ${target.name || 'UNNAMED'}. Access reverted to Setup Mode.`,
                [DB_COLUMNS.PERFORMER_NAME]: 'SYSTEM ADMIN'
            });

            playSound('success');
            setShowAdminWipeConfirm(null);
            setEditingEmployee(null);
            if (onRefresh) onRefresh();
        } catch (err) {
            setError('Reset Protocol Fault');
            playSound('warning');
        } finally {
            setIsSaving(false);
            if (onSyncStatusChange) onSyncStatusChange(false);
        }
    };

    const handleSaveEmployee = async (payload: any, authorizedBranchIds: string[], profileFile: File | null) => {
        if (isSaving) return;
        setIsSaving(true);
        if (onSyncStatusChange) onSyncStatusChange(true);
        setError('');

        try {
            const firstName = payload[DB_COLUMNS.FIRST_NAME]?.trim().toUpperCase();
            const middleName = payload[DB_COLUMNS.MIDDLE_NAME]?.trim().toUpperCase() || null;
            const lastName = payload[DB_COLUMNS.LAST_NAME]?.trim().toUpperCase();
            const cleanName = `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim().toUpperCase();
            const finalHomeBranchId = payload[DB_COLUMNS.BRANCH_ID];
            const oldName = editingEmployee?.name?.toUpperCase().trim();

            // 0. DUPLICATION CHECK (Branch-Level)
            const isDuplicate = employees.some(e => {
                if (editingEmployee?.id && e.id === editingEmployee.id) return false;
                if (e.branchId !== finalHomeBranchId) return false;
                if (!e.isActive) return false;

                const existingFullName = e.firstName && e.lastName
                    ? `${e.firstName} ${e.middleName ? e.middleName + ' ' : ''}${e.lastName}`.trim().toUpperCase()
                    : (e.name || '').toUpperCase();

                return existingFullName === cleanName;
            });

            if (isDuplicate) {
                setError(`DUPLICATE IDENTITY: A staff member with this name is already registered in this branch.`);
                playSound('warning');
                setIsSaving(false);
                if (onSyncStatusChange) onSyncStatusChange(false);
                return;
            }

            let profileUrl = payload[DB_COLUMNS.PROFILE] || '';
            if (profileFile) {
                if (payload[DB_COLUMNS.PROFILE]) await deleteFileByUrl(payload[DB_COLUMNS.PROFILE], 'profiles');
                const compressed = await compressImage(profileFile, { maxWidth: 400, maxHeight: 400, quality: 0.5 });
                const path = `${finalHomeBranchId || 'global'}/profiles/${Date.now()}_admin.jpg`;
                const { error: uploadErr } = await supabase.storage.from('profiles').upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
                if (!uploadErr) profileUrl = supabase.storage.from('profiles').getPublicUrl(path).data.publicUrl;
                payload[DB_COLUMNS.PROFILE] = profileUrl;
            }

            const id = editingEmployee?.id || Math.random().toString(36).substr(2,9);
            if (editingEmployee?.id) {
                await updateEmployee.mutateAsync({ id, ...payload });
            } else {
                await addEmployee.mutateAsync({ [DB_COLUMNS.ID]: id, ...payload });
            }

            const isManager = (payload[DB_COLUMNS.ROLE] || '').includes('MANAGER');
            const nameChanged = oldName && oldName !== cleanName;

            // 1. BRANCH SYNC: Update manager/temp_manager slots in branches
            const syncPromises = branches.map(async (b) => {
                const shouldBeManagerOfThisBranch = isManager && authorizedBranchIds.includes(b.id);
                const isCurrentlyMarkedAsManagerOfThisBranch = b.manager?.toUpperCase() === oldName || b.manager?.toUpperCase() === cleanName;
                const isCurrentlyMarkedAsTempManager = b.tempManager?.toUpperCase() === oldName;

                const branchUpdates: any = { id: b.id };
                let needsUpdate = false;

                // Case 1: Person is assigned as manager to this branch
                if (shouldBeManagerOfThisBranch) {
                    if (b.manager?.toUpperCase() !== cleanName) {
                        branchUpdates[DB_COLUMNS.MANAGER] = cleanName;
                        needsUpdate = true;
                    }
                }
                // Case 2: Name change cascade for existing management slots
                else if (nameChanged) {
                    if (b.manager?.toUpperCase() === oldName) {
                        branchUpdates[DB_COLUMNS.MANAGER] = cleanName;
                        needsUpdate = true;
                    }
                    if (b.tempManager?.toUpperCase() === oldName) {
                        branchUpdates[DB_COLUMNS.TEMP_MANAGER] = cleanName;
                        needsUpdate = true;
                    }
                }
                // Case 3: Removal from manager slot
                else if (isCurrentlyMarkedAsManagerOfThisBranch && !shouldBeManagerOfThisBranch) {
                    branchUpdates[DB_COLUMNS.MANAGER] = '';
                    branchUpdates[DB_COLUMNS.IS_PIN_CHANGED] = false;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    return updateBranch.mutateAsync(branchUpdates);
                }
                return Promise.resolve();
            });

            await Promise.all(syncPromises);

            // 2. DATA CASCADE: Update all historical records if name changed
            if (nameChanged) {
                const cascadePromises = [
                    // Transactions: Update both therapist and bonesetter roles
                    supabase.from(DB_TABLES.TRANSACTIONS).update({ [DB_COLUMNS.THERAPIST_NAME]: cleanName }).eq(DB_COLUMNS.THERAPIST_NAME, oldName),
                    supabase.from(DB_TABLES.TRANSACTIONS).update({ [DB_COLUMNS.BONESETTER_NAME]: cleanName }).eq(DB_COLUMNS.BONESETTER_NAME, oldName),

                    // Attendance & Shift Logs: Use ID for precision if possible, fallback to name
                    supabase.from(DB_TABLES.ATTENDANCE).update({ [DB_COLUMNS.STAFF_NAME]: cleanName }).eq(DB_COLUMNS.EMPLOYEE_ID, id),
                    supabase.from(DB_TABLES.SHIFT_LOGS).update({ [DB_COLUMNS.EMPLOYEE_NAME]: cleanName }).eq(DB_COLUMNS.EMPLOYEE_ID, id),

                    // Audit Logs: Update performer identity
                    supabase.from(DB_TABLES.AUDIT_LOGS).update({ [DB_COLUMNS.PERFORMER_NAME]: cleanName }).eq(DB_COLUMNS.PERFORMER_NAME, oldName),

                    // Attendance Logs (Legacy/Secondary)
                    supabase.from(DB_TABLES.ATTENDANCE_LOGS).update({ [DB_COLUMNS.STAFF_NAME]: cleanName }).eq(DB_COLUMNS.STAFF_NAME, oldName)
                ];

                // Execute all updates in parallel
                await Promise.all(cascadePromises);
            }

            await addAuditLog.mutateAsync({
                [DB_COLUMNS.BRANCH_ID]: null,
                [DB_COLUMNS.TIMESTAMP]: new Date().toISOString(),
                [DB_COLUMNS.ACTIVITY_TYPE]: editingEmployee?.id ? 'UPDATE' : 'CREATE',
                [DB_COLUMNS.ENTITY_TYPE]: 'EMPLOYEE',
                [DB_COLUMNS.ENTITY_ID]: id,
                [DB_COLUMNS.DESCRIPTION]: `${editingEmployee?.id ? 'Modified' : 'Registered'} staff identity: ${cleanName}${nameChanged ? ` (Previously: ${oldName || 'UNNAMED'})` : ''}`,
                [DB_COLUMNS.PERFORMER_NAME]: 'SYSTEM ADMIN'
            });

            playSound('success');
            setEditingEmployee(null);
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error(err);
            setError('SYSTEM SYNC FAULT. PLEASE RETRY.');
            playSound('warning');
        } finally {
            setIsSaving(false);
            if (onSyncStatusChange) onSyncStatusChange(false);
        }
    };

    const handleExportPDF = async (confirmed = false) => {
        if (!confirmed) {
            playSound('warning');
            setShowPrintConfirm(true);
            return;
        }

        setShowPrintConfirm(false);
        setIsExporting(true);
        playSound('click');

        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // 1. Header
            doc.setFontSize(18);
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text('STAFF DIRECTORY REPORT', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // slate-400
            doc.text('GLOBAL IDENTITY MANAGEMENT', 14, 26);

            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 20, { align: 'right' });
            doc.text(`Total Staff: ${filteredEmployees.length}`, pageWidth - 14, 26, { align: 'right' });

            // 2. Table
            autoTable(doc, {
                startY: 35,
                head: [['Employee Name', 'ID', 'Role', 'Branch Node', 'Allowance', 'Status']],
                body: filteredEmployees.map(emp => [
                    (emp.name || '').toUpperCase(),
                    emp.id.toUpperCase(),
                    (emp.role || '').toUpperCase(),
                    (branches.find(b => b.id === emp.branchId)?.name || 'UNASSIGNED').toUpperCase(),
                    `PHP ${(emp.allowance || 0).toLocaleString()}`,
                    emp.isActive ? 'ACTIVE' : 'INACTIVE'
                ]),
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 8 },
                columnStyles: {
                    4: { halign: 'right' }
                },
                rowPageBreak: 'avoid'
            });

            doc.save(`STAFF_DIRECTORY_${new Date().toISOString().split('T')[0]}.pdf`);
            playSound('success');
        } catch (error) {
            console.error('PDF Export failed:', error);
            alert('Failed to generate PDF.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className={`animate-in fade-in duration-300 ${UI_THEME.layout.maxContent} pb-32`}>
            {/* SECURITY WIPE MODAL */}
            {showAdminWipeConfirm && (
                <div className={`${UI_THEME.layout.modalWrapper} no-print`}>
                    <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-10 text-center border border-slate-100`}>
                        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner text-4xl">🛡️</div>
                        <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Authorize Data Wipe?</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed mb-10">
                            Wiping credentials for <span className="text-slate-900">{showAdminWipeConfirm.name || 'UNNAMED'}</span>. Account will revert to setup mode and require a new terminal handshake.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button onClick={handleAdminCredentialWipe} disabled={isSaving} className="w-full bg-rose-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[12px] shadow-lg active:scale-95 transition-all">
                                {isSaving ? 'Establishing Link...' : 'Confirm Identity Wipe'}
                            </button>
                            <button onClick={() => setShowAdminWipeConfirm(null)} disabled={isSaving} className="w-full py-4 text-slate-400 font-black text-[11px] uppercase tracking-widest">Abort</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER + FILTER SECTION */}
            <div className="bg-white p-4 sm:p-6 rounded-[24px] border border-slate-200 shadow-sm mb-6 space-y-6 no-print">
                <div className="flex flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Staff Directory</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Identity Management</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handleOpenEdit()}
                            className="h-10 sm:h-11 rounded-[24px] bg-emerald-600 px-4 sm:px-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                        >
                            <span className="text-lg leading-none">+</span>
                            <span className="hidden sm:inline">Register Staff</span>
                        </button>
                    </div>
                </div>

                {/* SEARCH + FILTER TOGGLE ROW */}
                <div className="flex flex-row items-center gap-2 sm:gap-4">
                    <div className={`relative flex-1 group ${UI_THEME.styles.controlHeight}`}>
                        <div className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3" /></svg>
                        </div>
                        <input
                            type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search Employee..."
                            className={`w-full h-full pl-10 sm:pl-14 pr-4 bg-slate-50 border border-slate-200 rounded-[24px] font-bold text-[11px] sm:text-[13px] uppercase tracking-wider outline-none focus:bg-white focus:border-emerald-500 transition-all placeholder:text-slate-300 shadow-inner`}
                        />
                    </div>

                    <button
                        onClick={() => { setShowFilters(!showFilters); playSound('click'); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-[24px] border transition-all text-[10px] font-black uppercase tracking-widest shrink-0 ${showFilters ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-500 hover:text-emerald-600'}`}
                    >
                        <svg className={`w-4 h-4 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M19 9l-7 7-7-7" /></svg>
                        <span className="hidden sm:inline">{showFilters ? 'Hide Filters' : 'Filters'}</span>
                        {(branchFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'active') && !showFilters && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
                    </button>
                </div>

                {showFilters && (
                    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-top-2 duration-300 pt-4 border-t border-slate-100">
                        <div className="flex gap-2 shrink-0 flex-wrap lg:flex-nowrap relative z-[200]">
                            {/* BRANCH DROPDOWN */}
                            <div className="relative flex-1 sm:flex-none" ref={branchDropdownRef}>
                                <button
                                    onClick={() => { setIsBranchDropdownOpen(!isBranchDropdownOpen); playSound('click'); }}
                                    className={`h-11 sm:h-12 min-w-[140px] sm:min-w-[180px] w-full flex items-center justify-between px-4 sm:px-5 bg-slate-50 border border-slate-200 rounded-2xl transition-all ${isBranchDropdownOpen ? 'bg-white border-emerald-500 shadow-lg' : 'hover:border-slate-300'}`}
                                >
                  <span className={`${UI_THEME.text.metadata} text-slate-900 truncate pr-2`}>
                    {branchFilter === 'all' ? 'All Branches' : (branches.find(b => b.id === branchFilter)?.name || 'Filtered')}
                  </span>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="4" /></svg>
                                </button>
                                {isBranchDropdownOpen && (
                                    <div className={`absolute top-[calc(100%+8px)] left-0 sm:right-0 sm:left-auto w-64 sm:w-72 bg-white border border-slate-200 rounded-2xl ${UI_THEME.shadows.extreme} overflow-hidden z-[1000] p-1.5 animate-in zoom-in-95 duration-200 backdrop-blur-xl`}>
                                        <button onClick={() => { setBranchFilter('all'); setIsBranchDropdownOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${UI_THEME.text.metadata} mb-1 ${branchFilter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50'}`}>All Branches</button>
                                        <div className="max-h-[280px] overflow-y-auto no-scrollbar">
                                            {branches.map(b => (
                                                <button key={b.id} onClick={() => { setBranchFilter(b.id); setIsBranchDropdownOpen(false); }} className={`w-full text-left px-4 py-3 rounded-lg ${UI_THEME.text.metadata} mb-1 last:mb-0 ${branchFilter === b.id ? 'bg-emerald-600 text-white shadow-lg' : 'hover:bg-slate-50'}`}>{b.name}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ROLE DROPDOWN */}
                            <div className="relative flex-1 sm:flex-none" ref={roleDropdownRef}>
                                <button
                                    onClick={() => { setIsRoleDropdownOpen(!isRoleDropdownOpen); playSound('click'); }}
                                    className={`h-11 sm:h-12 min-w-[140px] sm:min-w-[160px] w-full flex items-center justify-between px-4 sm:px-5 bg-slate-50 border border-slate-200 rounded-2xl transition-all ${isRoleDropdownOpen ? 'bg-white border-emerald-500 shadow-lg' : 'hover:border-slate-300'}`}
                                >
                  <span className={`${UI_THEME.text.metadata} text-slate-900 truncate pr-2`}>
                    {roleFilter === 'all' ? 'All Roles' : roleFilter.charAt(0) + roleFilter.slice(1).toLowerCase() + 's'}
                  </span>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="4" /></svg>
                                </button>
                                {isRoleDropdownOpen && (
                                    <div className={`absolute top-[calc(100%+8px)] left-0 sm:right-0 sm:left-auto w-56 bg-white border border-slate-200 rounded-2xl ${UI_THEME.shadows.extreme} overflow-hidden z-[1000] p-1.5 animate-in zoom-in-95 duration-200 backdrop-blur-xl`}>
                                        {['all', 'MANAGER', 'THERAPIST', 'BONESETTER', 'TRAINEE'].map(role => (
                                            <button
                                                key={role}
                                                onClick={() => { setRoleFilter(role); setIsRoleDropdownOpen(false); }}
                                                className={`w-full text-left px-4 py-3 rounded-lg ${UI_THEME.text.metadata} mb-1 last:mb-0 ${roleFilter === role ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50'}`}
                                            >
                                                {role === 'all' ? 'All Roles' : role.charAt(0) + role.slice(1).toLowerCase() + 's'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* STATUS DROPDOWN */}
                            <div className="relative flex-1 sm:flex-none" ref={statusDropdownRef}>
                                <button
                                    onClick={() => { setIsStatusDropdownOpen(!isStatusDropdownOpen); playSound('click'); }}
                                    className={`h-11 sm:h-12 min-w-[140px] sm:min-w-[160px] w-full flex items-center justify-between px-4 sm:px-5 bg-slate-50 border border-slate-200 rounded-2xl transition-all ${isStatusDropdownOpen ? 'bg-white border-emerald-500 shadow-lg' : 'hover:border-slate-300'}`}
                                >
                  <span className={`${UI_THEME.text.metadata} text-slate-900 truncate pr-2`}>
                    {statusFilter === 'all' ? 'All Status' : statusFilter === 'active' ? 'Active Only' : 'Inactive Only'}
                  </span>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="4" /></svg>
                                </button>
                                {isStatusDropdownOpen && (
                                    <div className={`absolute top-[calc(100%+8px)] left-0 sm:right-0 sm:left-auto w-56 bg-white border border-slate-200 rounded-2xl ${UI_THEME.shadows.extreme} overflow-hidden z-[1000] p-1.5 animate-in zoom-in-95 duration-200 backdrop-blur-xl`}>
                                        {[
                                            { id: 'active', label: 'Active Only' },
                                            { id: 'inactive', label: 'Inactive Only' },
                                            { id: 'all', label: 'All Status' }
                                        ].map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => { setStatusFilter(item.id as any); setIsStatusDropdownOpen(false); }}
                                                className={`w-full text-left px-4 py-3 rounded-lg ${UI_THEME.text.metadata} mb-1 last:mb-0 ${statusFilter === item.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50'}`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* SORT DROPDOWN */}
                            <div className="relative flex-1 sm:flex-none" ref={sortDropdownRef}>
                                <button
                                    onClick={() => { setIsSortDropdownOpen(!isSortDropdownOpen); playSound('click'); }}
                                    className={`h-11 sm:h-12 min-w-[140px] sm:min-w-[160px] w-full flex items-center justify-between px-4 sm:px-5 bg-slate-50 border border-slate-200 rounded-2xl transition-all ${isSortDropdownOpen ? 'bg-white border-emerald-500 shadow-lg' : 'hover:border-slate-300'}`}
                                >
                  <span className={`${UI_THEME.text.metadata} text-slate-900 truncate pr-2`}>
                    {sortBy === 'name' ? 'Sort by Name' : sortBy === 'pay_desc' ? 'Highest Pay' : 'Lowest Pay'}
                  </span>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="4" /></svg>
                                </button>
                                {isSortDropdownOpen && (
                                    <div className={`absolute top-[calc(100%+8px)] left-0 sm:right-0 sm:left-auto w-56 bg-white border border-slate-200 rounded-2xl ${UI_THEME.shadows.extreme} overflow-hidden z-[1000] p-1.5 animate-in zoom-in-95 duration-200 backdrop-blur-xl`}>
                                        {[
                                            { id: 'name', label: 'Sort by Name' },
                                            { id: 'pay_desc', label: 'Highest Pay' },
                                            { id: 'pay_asc', label: 'Lowest Pay' }
                                        ].map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => { setSortBy(item.id as any); setIsSortDropdownOpen(false); }}
                                                className={`w-full text-left px-4 py-3 rounded-lg ${UI_THEME.text.metadata} mb-1 last:mb-0 ${sortBy === item.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50'}`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="px-1 pt-2 sm:pt-4 space-y-4 no-print">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filteredEmployees.length}
                        itemsPerPage={itemsPerPage}
                    />

                    <button
                        onClick={() => handleExportPDF()}
                        disabled={isExporting || filteredEmployees.length === 0}
                        className={`h-10 sm:h-12 px-6 rounded-2xl bg-emerald-600 text-white flex items-center gap-3 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg active:scale-95 shrink-0 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isExporting ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        )}
                        <span>{isExporting ? 'Exporting...' : 'Export Employees'}</span>
                    </button>
                </div>

                {showPrintConfirm && (
                    <div className={UI_THEME.layout.modalWrapper}>
                        <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-10 text-center border border-slate-100`}>
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 17h2a2 2-0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </div>
                            <h4 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Export Employees?</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                                Generate and download the global staff directory report?
                            </p>
                            <div className="flex flex-col gap-4 mt-10">
                                <button
                                    onClick={() => handleExportPDF(true)}
                                    className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    Confirm Print
                                </button>
                                <button
                                    onClick={() => setShowPrintConfirm(false)}
                                    className="w-full text-slate-400 font-black py-4 rounded-xl text-[12px] uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <EmployeeTable
                    employees={paginatedEmployees}
                    branches={branches}
                    onEdit={handleOpenEdit}
                    onReset={handleOpenResetModal}
                />
                <EmployeeMobileList
                    employees={paginatedEmployees}
                    branches={branches}
                    onEdit={handleOpenEdit}
                    onReset={handleOpenResetModal}
                />
            </div>

            {resettingEmployee && (
                <div className="no-print">
                    <RecoveryModal
                        employee={resettingEmployee}
                        branches={branches}
                        isSaving={updateEmployee.isPending}
                        onClose={() => setResettingEmployee(null)}
                        onRefresh={onRefresh}
                        onSyncStatusChange={onSyncStatusChange}
                    />
                </div>
            )}

            {editingEmployee && !resettingEmployee && (
                <div className="no-print">
                    <EditorModal
                        employee={{...editingEmployee, allEmployees: employees} as any}
                        branches={branches}
                        isSaving={isSaving}
                        error={error}
                        onClose={() => setEditingEmployee(null)}
                        onSave={handleSaveEmployee}
                        onWipe={(target) => { setShowAdminWipeConfirm(target as Employee); }}
                        onReset={handleOpenResetModal}
                    />
                </div>
            )}
        </div>
    );
};
