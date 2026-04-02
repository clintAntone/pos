import React from 'react';
import { Employee, Branch } from '../../../types';
import { UI_THEME } from '../../../constants/ui_designs';
import { RoleBadge } from './SharedComponents';
import { getEmployeeAllowance } from '../../../lib/payroll';

interface EmployeeMobileListProps {
  employees: Employee[];
  branches: Branch[];
  onEdit: (emp: Employee) => void;
  onReset: (emp: Employee) => void;
  currentBranchId?: string;
}

export const EmployeeMobileList: React.FC<EmployeeMobileListProps> = ({ employees, branches, onEdit, onReset, currentBranchId }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
      {employees.map(emp => {
        const authorizedNodes = branches.filter(b => b.id === emp.branchId || b.manager?.toUpperCase() === (emp.name || '').toUpperCase()).map(b => b.name);
        
        return (
          <div 
            key={emp.id} 
            className={`bg-white p-4 ${UI_THEME.radius.card} border transition-all duration-500 flex flex-col justify-between group hover:shadow-lg hover:translate-y-[-2px] cursor-pointer relative overflow-hidden ${emp.isActive ? 'border-slate-200 hover:border-emerald-500' : 'border-slate-100 opacity-60 grayscale bg-slate-50/50'}`}
          >
            <div className="flex items-start gap-3 mb-3" onClick={() => onEdit(emp)}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shadow-inner shrink-0 overflow-hidden ${emp.isActive ? 'bg-slate-100' : 'bg-white'}`}>
                {emp.profile ? <img src={emp.profile} className="w-full h-full object-cover" alt={emp.name || ''} /> : <span className="font-black italic text-slate-300 text-sm">{(emp.name || '').charAt(0)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                    <h3 className={`text-sm font-bold text-slate-900 uppercase tracking-tight group-hover:text-emerald-700 transition-colors`}>{emp.name || 'UNNAMED'}</h3>
                    {emp.requestReset && <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></div>}
                </div>
                {emp.firstName && emp.lastName && (
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">
                    {emp.firstName} {emp.middleName ? emp.middleName + ' ' : ''}{emp.lastName}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-1 opacity-60">
                  {authorizedNodes.map((n, i) => (
                    <span key={i} className="text-[6px] font-black bg-slate-100 text-slate-500 px-1 py-0.5 rounded leading-none uppercase">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                 <button 
                    onClick={(e) => { e.stopPropagation(); onReset(emp); }}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-md border ${emp.requestReset ? 'bg-rose-600 border-rose-500 text-white animate-pulse' : 'bg-white border-slate-100 text-slate-300'}`}
                 >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                 </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
               <RoleBadge role={emp.role} />
               <div className="flex flex-col items-end">
                  <p className="text-[13px] font-black text-slate-900 tabular-nums">
                    ₱{getEmployeeAllowance(emp, currentBranchId || 'all').toLocaleString()}
                  </p>
                  {emp.branchAllowances && Object.keys(emp.branchAllowances).length > 0 && (
                    <span className="text-[5px] font-black text-emerald-600 uppercase tracking-widest">
                      {currentBranchId && currentBranchId !== 'all' && emp.branchAllowances[currentBranchId] !== undefined ? 'Override Active' : 'Overrides Configured'}
                    </span>
                  )}
               </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};