
import React, { useState, useMemo } from 'react';
import { Branch, Employee, ShiftLog } from '../../../types';
import { DB_TABLES, DB_COLUMNS } from '../../../constants/db_schema';
import { playSound } from '../../../lib/audio';
import { useAddShiftLog, useUpdateShiftLog } from '../../../hooks/useNetworkData';

interface ShiftSectionProps {
  branch: Branch;
  employees: Employee[];
  shiftLogs: ShiftLog[];
  onRefresh?: () => void;
}

export const ShiftSection: React.FC<ShiftSectionProps> = ({ branch, employees, shiftLogs, onRefresh }) => {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const addShiftLog = useAddShiftLog();
  const updateShiftLog = useUpdateShiftLog();

  const todayStr = useMemo(() => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date()), []);

  const activeEmployees = useMemo(() =>
          employees.filter(e => e.branchId === branch.id && e.isActive !== false),
      [employees, branch.id]);

  const currentShifts = useMemo(() => {
    return shiftLogs.filter(s => s.branchId === branch.id && (s.dateStr === todayStr || !s.clockOut));
  }, [shiftLogs, branch.id, todayStr]);

  const handleClockIn = async (emp: Employee) => {
    if (isProcessing) return;
    setIsProcessing(emp.id);
    setError('');
    playSound('click');
    try {
      await addShiftLog.mutateAsync({
        [DB_COLUMNS.ID]: Math.random().toString(36).substr(2, 9),
        [DB_COLUMNS.BRANCH_ID]: branch.id,
        [DB_COLUMNS.EMPLOYEE_ID]: emp.id,
        [DB_COLUMNS.EMPLOYEE_NAME]: emp.name,
        [DB_COLUMNS.CLOCK_IN]: new Date().toISOString(),
        [DB_COLUMNS.DATE_STR]: todayStr
      });
      playSound('success');
      if (onRefresh) onRefresh();
    } catch (err) {
      setError('Clock-in fault.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleClockOut = async (shift: ShiftLog) => {
    if (isProcessing) return;
    setIsProcessing(shift.employeeId);
    setError('');
    playSound('click');
    try {
      await updateShiftLog.mutateAsync({
        id: shift.id,
        [DB_COLUMNS.CLOCK_OUT]: new Date().toISOString(),
        [DB_COLUMNS.BRANCH_ID]: branch.id,
        [DB_COLUMNS.EMPLOYEE_ID]: shift.employeeId,
        [DB_COLUMNS.DATE_STR]: todayStr
      });
      playSound('success');
      if (onRefresh) onRefresh();
    } catch (err) {
      setError('Clock-out fault.');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-32">
        <div className="px-2 space-y-2">
          <h2 className="text-4xl font-bold text-slate-900 uppercase tracking-tighter leading-none">Shift Terminal</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Live Attendance Stream</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
          {activeEmployees.map(emp => {
            const shift = currentShifts.find(s => s.employeeId === emp.id && !s.clockOut);
            const isOnDuty = !!shift;
            return (
                <div key={emp.id} className={`p-6 rounded-[36px] border-2 transition-all ${isOnDuty ? 'bg-white border-emerald-500 shadow-xl' : 'bg-slate-50 border-transparent opacity-80'}`}>
                  <div className="flex items-center justify-between gap-6">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 uppercase text-sm truncate">{emp.name}</h3>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{emp.role}</span>
                    </div>
                    <button onClick={() => isOnDuty ? handleClockOut(shift) : handleClockIn(emp)} disabled={!!isProcessing} className={`px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg ${isOnDuty ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
                      {isProcessing === emp.id ? '...' : (isOnDuty ? 'OUT' : 'IN')}
                    </button>
                  </div>
                </div>
            );
          })}
        </div>
      </div>
  );
};
