import { useMemo } from 'react';
import { Branch, Transaction, Expense } from '../../../types';

export const useBranchData = (branch: Branch, transactions: Transaction[], expenses: Expense[]) => {
  const yearlyCycles = useMemo(() => {
    const cycles = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const anchorDateString = branch.cycleStartDate || `${new Date().getFullYear()}-01-01`;
    const [year, month, day] = anchorDateString.split('-').map(v => parseInt(v, 10));
    let iter = new Date(year, month - 1, day);
    iter.setHours(0, 0, 0, 0);

    const targetYear = now.getFullYear() + 1; // Project slightly into the future to capture current week
    let cycleId = 1;

    const toDateKey = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    while (iter.getFullYear() <= targetYear && cycles.length < 100) {
      const cycleStart = new Date(iter);
      const cycleEnd = new Date(iter);
      
      // Computation for Week 1 and subsequent weeks:
      // Week 1 spans from cycle start to the next cutoff day.
      if (cycleId === 1) {
        const currentDay = cycleStart.getDay();
        const daysToCutoff = (Number(branch.weeklyCutoff) - currentDay + 7) % 7;
        cycleEnd.setDate(cycleStart.getDate() + daysToCutoff);
      } else {
        // Subsequent weeks are standard 7-day windows aligned to cutoff
        cycleEnd.setDate(cycleStart.getDate() + 6);
      }
      
      const startStr = toDateKey(cycleStart);
      const endStr = toDateKey(cycleEnd);
      
      const cycleTxs = transactions.filter(t => t.branchId === branch.id && t.timestamp >= startStr && t.timestamp <= endStr + 'T23:59:59');
      const cycleExps = expenses.filter(e => e.branchId === branch.id && e.timestamp >= startStr && e.timestamp <= endStr + 'T23:59:59');
      
      const gross = cycleTxs.reduce((s, t) => s + (Number(t.total) || 0), 0);
      // Fix: Used primaryCommission instead of commission on line 48 to match Transaction interface
      const comm = cycleTxs.reduce((s, t) => s + (Number(t.primaryCommission) || 0) + (Number(t.secondaryCommission) || 0), 0);
      const exp = cycleExps.reduce((s, e) => s + (Number(e.amount) || 0), 0);

      const cycleDays = [];
      const diff = Math.round((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      for(let i = 0; i < diff; i++) {
        const dayDate = new Date(cycleStart);
        dayDate.setDate(dayDate.getDate() + i);
        const dStr = toDateKey(dayDate);
        const dTxs = cycleTxs.filter(t => t.timestamp.startsWith(dStr));
        const dExps = cycleExps.filter(e => e.timestamp.startsWith(dStr));
        const dGross = dTxs.reduce((s, t) => s + Number(t.total), 0);
        // Fix: Used primaryCommission instead of commission on line 61 to match Transaction interface
        const dComm = dTxs.reduce((s, t) => s + (Number(t.primaryCommission) || 0) + (Number(t.secondaryCommission) || 0), 0);
        const dExp = dExps.reduce((s, e) => s + Number(e.amount), 0);
        cycleDays.push({ date: dStr, gross: dGross, comm: dComm, exp: dExp, net: dGross - dComm - dExp });
      }

      cycles.push({
        id: cycleId++,
        start: cycleStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        startDate: new Date(cycleStart),
        end: cycleEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        endDate: new Date(cycleEnd),
        gross, comm, exp, net: gross - comm - exp,
        isFuture: cycleStart > now,
        days: cycleDays
      });
      
      iter = new Date(cycleEnd);
      iter.setDate(iter.getDate() + 1);
      
      if (cycleStart > now && cycles.length > 5) break; 
    }
    return cycles;
  }, [branch.cycleStartDate, branch.weeklyCutoff, transactions, expenses, branch.id]);

  return { yearlyCycles };
};