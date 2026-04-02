
import React from 'react';
import { Employee } from '../../../../types';
import { RoleBadge } from './RoleBadge';
import { getEmployeeAllowance } from '../../../../lib/payroll';
import { UI_THEME } from '../../../../constants/ui_designs';

interface StaffCardProps {
    emp: Employee;
    branchId: string;
    shiftState: 'NOT_STARTED' | 'ONGOING' | 'COMPLETED';
    isClosedMode: boolean;
    onEdit: (emp: Employee) => void;
    onTimeAction: (emp: Employee) => void;
    onReset: (emp: Employee) => void;
}

export const StaffCard: React.FC<StaffCardProps> = ({ emp, branchId, shiftState, isClosedMode, onEdit, onTimeAction, onReset }) => {
    const isOngoing = shiftState === 'ONGOING';
    const isCompleted = shiftState === 'COMPLETED';
    const isActive = emp.isActive;
    const currentAllowance = getEmployeeAllowance(emp, branchId);

    return (
        <div
            className={`bg-white ${UI_THEME.radius.card} border transition-all duration-500 group relative overflow-hidden flex flex-col h-full active:scale-[0.98] ${!isActive ? 'grayscale opacity-60 border-slate-100' : isOngoing ? 'border-emerald-500 shadow-xl ring-4 ring-emerald-500/5' : 'border-slate-100 hover:border-emerald-300 hover:shadow-2xl'}`}
        >
            <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[7px] font-black uppercase tracking-widest z-10 text-white shadow-lg ${!isActive ? 'bg-slate-400' : isOngoing ? 'bg-emerald-500 animate-pulse' : isCompleted ? 'bg-indigo-600' : 'bg-slate-900'}`}>
                {!isActive ? 'Suspended' : isOngoing ? 'On Duty' : isCompleted ? 'Timed Out' : 'Offline'}
            </div>

            <div className="p-5 sm:p-8 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4 sm:mb-8">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[32px] overflow-hidden bg-slate-50 border-4 border-white shadow-xl transition-transform group-hover:scale-110 duration-500">
                        {emp.profile ? (
                            <img src={emp.profile} className="w-full h-full object-cover" alt="p" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-200 italic">{(emp.name || '').charAt(0)}</div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => onReset(emp)} className="p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:bg-rose-600 hover:text-white transition-all border border-transparent hover:border-white shadow-inner" title="Reset Credentials"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" strokeWidth="3" /></svg></button>
                        <button onClick={() => onEdit(emp)} className="p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:bg-slate-900 hover:text-white transition-all border border-transparent hover:border-white shadow-inner" title="Edit Profile"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth="3" /></svg></button>
                    </div>
                </div>

                <div className="space-y-4 flex-1">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tighter truncate group-hover:text-emerald-700 transition-colors leading-none mb-2">{emp.name || 'UNNAMED'}</h3>
                        {emp.firstName && emp.lastName && (
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 truncate">
                                {emp.firstName} {emp.middleName ? emp.middleName + ' ' : ''}{emp.lastName}
                            </p>
                        )}
                        <RoleBadge role={emp.role} />
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            {emp.branchAllowances?.[branchId] ? 'Override Rate' : 'Base Rate'}
                        </p>
                        <p className="text-sm font-black text-slate-900 tabular-nums">₱{currentAllowance.toLocaleString()}</p>
                    </div>
                    <button
                        disabled={!isActive}
                        onClick={() => onTimeAction(emp)}
                        className={`h-11 px-6 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-90 shadow-lg ${isOngoing ? 'bg-rose-600 text-white' : isCompleted ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white hover:bg-emerald-600'}`}
                    >
                        {isOngoing ? 'Time Out' : isCompleted ? 'Reset' : 'Time In'}
                    </button>
                </div>
            </div>
        </div>
    );
};
