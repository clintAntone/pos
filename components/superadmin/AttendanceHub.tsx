import React, { useState, useMemo } from 'react';
import { Attendance, Branch, Employee } from '../../types';
import { UI_THEME } from '../../constants/ui_designs';
import { playSound } from '../../lib/audio';
import { Pagination } from '../dashboard/sections/common/Pagination';

interface AttendanceHubProps {
    attendance: Attendance[];
    branches: Branch[];
    employees: Employee[];
}

export const AttendanceHub: React.FC<AttendanceHubProps> = ({ attendance, branches, employees }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [branchFilter, setBranchFilter] = useState<string>('all');
    const [branchSearchTerm, setBranchSearchTerm] = useState('');
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const filteredBranches = useMemo(() => {
        if (!branchSearchTerm.trim()) return branches;
        return branches.filter(b => b.name.toLowerCase().includes(branchSearchTerm.toLowerCase()));
    }, [branches, branchSearchTerm]);

    const selectedBranchName = useMemo(() => {
        if (branchFilter === 'all') return 'All Branches';
        return branches.find(b => b.id === branchFilter)?.name || 'Unknown Branch';
    }, [branchFilter, branches]);

    const filteredAttendance = useMemo(() => {
        let res = [...attendance].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

        if (branchFilter !== 'all') {
            res = res.filter(a => a.branchId === branchFilter);
        }

        if (dateFilter) {
            res = res.filter(a => {
                const clockInDate = new Date(a.clockIn).toISOString().split('T')[0];
                return clockInDate === dateFilter;
            });
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            res = res.filter(a =>
                a.staffName.toLowerCase().includes(term) ||
                (branches.find(b => b.id === a.branchId)?.name || '').toLowerCase().includes(term)
            );
        }

        return res;
    }, [attendance, branchFilter, dateFilter, searchTerm, branches]);

    const paginatedAttendance = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredAttendance.slice(start, start + itemsPerPage);
    }, [filteredAttendance, currentPage]);

    const totalPages = Math.ceil(filteredAttendance.length / itemsPerPage);

    return (
        <div className="animate-in fade-in duration-300 space-y-6">
            {/* Header & Filters */}
            <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Attendance Logs</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Staff Clock-in Registry</p>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3" /></svg>
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search Staff or Branch..."
                            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-[13px] uppercase tracking-wider outline-none focus:bg-white focus:border-emerald-500 transition-all shadow-inner"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-center gap-2 flex-1 sm:flex-none">
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); playSound('click'); }}
                                className="h-12 flex-1 sm:w-40 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-[11px] uppercase tracking-widest outline-none focus:border-emerald-500 transition-all"
                            />
                            {dateFilter && (
                                <button
                                    onClick={() => { setDateFilter(''); setCurrentPage(1); playSound('click'); }}
                                    className="h-12 w-12 flex items-center justify-center bg-slate-100 text-slate-500 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all shrink-0"
                                    title="Clear Date Filter"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="3" /></svg>
                                </button>
                            )}
                        </div>

                        <div className="relative flex-1 sm:w-64">
                            <button
                                onClick={() => { setIsBranchDropdownOpen(!isBranchDropdownOpen); playSound('click'); }}
                                className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-[11px] uppercase tracking-widest outline-none focus:border-emerald-500 transition-all flex items-center justify-between group"
                            >
                                <span className="truncate">{selectedBranchName}</span>
                                <svg className={`w-4 h-4 transition-transform duration-300 ${isBranchDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isBranchDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-[100]"
                                        onClick={() => setIsBranchDropdownOpen(false)}
                                    />
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-2 border-b border-slate-100">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={branchSearchTerm}
                                                onChange={(e) => setBranchSearchTerm(e.target.value)}
                                                placeholder="Search branches..."
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold uppercase tracking-wider outline-none focus:bg-white focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto no-scrollbar">
                                            <button
                                                onClick={() => {
                                                    setBranchFilter('all');
                                                    setIsBranchDropdownOpen(false);
                                                    setBranchSearchTerm('');
                                                    setCurrentPage(1);
                                                    playSound('click');
                                                }}
                                                className={`w-full px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-slate-50 ${branchFilter === 'all' ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-600'}`}
                                            >
                                                All Branches
                                            </button>
                                            {filteredBranches.map(b => (
                                                <button
                                                    key={b.id}
                                                    onClick={() => {
                                                        setBranchFilter(b.id);
                                                        setIsBranchDropdownOpen(false);
                                                        setBranchSearchTerm('');
                                                        setCurrentPage(1);
                                                        playSound('click');
                                                    }}
                                                    className={`w-full px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-slate-50 ${branchFilter === b.id ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-600'}`}
                                                >
                                                    {b.name}
                                                </button>
                                            ))}
                                            {filteredBranches.length === 0 && (
                                                <div className="px-4 py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    No branches found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table / Mobile Cards */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Name</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock-in Branch</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock In</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock Out</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {paginatedAttendance.length > 0 ? (
                            paginatedAttendance.map((log) => {
                                const branch = branches.find(b => b.id === log.branchId);
                                const employee = employees.find(e => e.id === log.employeeId);
                                const homeBranch = branches.find(b => b.id === employee?.branchId);

                                return (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{log.staffName}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: {log.employeeId.slice(0, 8)}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">🏢</span>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{branch?.name || 'Unknown Node'}</span>
                                                    {homeBranch && homeBranch.id !== branch?.id && (
                                                        <span className="text-[8px] font-bold text-amber-500 uppercase tracking-widest">Home: {homeBranch.name}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">
                                                {new Date(log.clockIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className="text-[13px] font-black text-emerald-600 uppercase tracking-tight">
                                                {new Date(log.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.clockOut ? (
                                                <>
                                                    <div className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">
                                                        {new Date(log.clockOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                    <div className="text-[13px] font-black text-rose-600 uppercase tracking-tight">
                                                        {new Date(log.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">In Progress</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            log.status === 'LATE' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                log.status === 'OT' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                                    'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          {log.status}
                        </span>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-20 text-center">
                                    <div className="text-4xl mb-4">📂</div>
                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No attendance records found</div>
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4 p-4 bg-slate-50/50">
                    {paginatedAttendance.length > 0 ? (
                        paginatedAttendance.map((log) => {
                            const branch = branches.find(b => b.id === log.branchId);
                            const employee = employees.find(e => e.id === log.employeeId);
                            const homeBranch = branches.find(b => b.id === employee?.branchId);

                            const duration = log.clockOut
                                ? Math.floor((new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime()) / (1000 * 60 * 60))
                                : null;
                            const durationMinutes = log.clockOut
                                ? Math.floor(((new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime()) / (1000 * 60)) % 60)
                                : null;

                            return (
                                <div key={log.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                    {/* Top Section: Identity & Branch Context */}
                                    <div className="p-6 pb-0">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="space-y-1">
                                                <div className="text-[16px] font-black text-slate-900 uppercase tracking-tight leading-none">
                                                    {log.staffName}
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                                    ID: {log.employeeId.slice(0, 8)}
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm ${
                                                log.status === 'LATE' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    log.status === 'OT' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                                            }`}>
                        {log.status}
                      </span>
                                        </div>

                                        {/* Branch Info - Moved and Icon Removed */}
                                        <div className="flex flex-col gap-1 border-l-2 border-slate-100 pl-4 py-1">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                Node: {branch?.name || 'Unknown'}
                                            </div>
                                            {homeBranch && homeBranch.id !== branch?.id && (
                                                <div className="text-[8px] font-bold text-amber-500 uppercase tracking-widest italic">
                                                    Relief Assignment (Home: {homeBranch.name})
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle Section: The Timeline Story */}
                                    <div className="p-6">
                                        <div className="bg-slate-50 rounded-[24px] p-5 border border-slate-100/50">
                                            <div className="flex items-center justify-between relative">
                                                {/* Start Point */}
                                                <div className="flex flex-col items-start">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                        In
                                                    </div>
                                                    <div className="text-[16px] font-black text-slate-900 tracking-tighter leading-none">
                                                        {new Date(log.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div className="text-[9px] font-bold text-slate-400 mt-1.5">
                                                        {new Date(log.clockIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </div>
                                                </div>

                                                {/* Journey Path */}
                                                <div className="flex-1 flex flex-col items-center px-2">
                                                    <div className="w-full h-[1px] bg-slate-200 relative">
                                                        {!log.clockOut && (
                                                            <div className="absolute inset-0 bg-emerald-500/20 animate-pulse"></div>
                                                        )}
                                                    </div>
                                                    <div className="mt-3">
                                                        {log.clockOut ? (
                                                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                                                {duration}h {durationMinutes}m
                                                            </div>
                                                        ) : (
                                                            <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">
                                                                Active
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* End Point */}
                                                <div className="flex flex-col items-end">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                        Out
                                                        <div className={`w-1.5 h-1.5 rounded-full ${log.clockOut ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                                                    </div>
                                                    {log.clockOut ? (
                                                        <>
                                                            <div className="text-[16px] font-black text-slate-900 tracking-tighter leading-none">
                                                                {new Date(log.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                            <div className="text-[9px] font-bold text-slate-400 mt-1.5">
                                                                {new Date(log.clockOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-[11px] font-black text-slate-300 uppercase tracking-widest italic">Pending</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="px-6 py-20 text-center bg-white rounded-[32px] border border-slate-200">
                            <div className="text-4xl mb-4">📂</div>
                            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No attendance records found</div>
                        </div>
                    )}
                </div>

                {/* Pagination Footer */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filteredAttendance.length}
                        itemsPerPage={itemsPerPage}
                    />
                </div>
            </div>
        </div>
    );
};
