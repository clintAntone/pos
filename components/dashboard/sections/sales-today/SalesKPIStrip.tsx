import React from 'react';
import { motion } from 'motion/react';

interface SalesKPIStripProps {
    gross: number;
    operationalExp: number;
    finalStaffPayTotal: number;
    provisionExp: number;
    net: number;
    totalAllowances: number;
    otAdditions: number;
    lateDeductions: number;
    totalCashAdvances: number;
    connStatus?: 'connecting' | 'connected' | 'error' | 'offline';
    pendingSyncCount?: number;
}

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

const getFontSize = (val: number) => {
    const len = Math.abs(val).toLocaleString().length;
    if (len > 14) return 'text-lg sm:text-xl';
    if (len > 11) return 'text-xl sm:text-2xl';
    if (len > 8) return 'text-2xl sm:text-3xl';
    return 'text-3xl sm:text-4xl';
};

export const SalesKPIStrip: React.FC<SalesKPIStripProps> = ({
                                                                gross, operationalExp, finalStaffPayTotal, provisionExp, net,
                                                                totalAllowances, otAdditions, lateDeductions, totalCashAdvances,
                                                                connStatus = 'connected', pendingSyncCount = 0
                                                            }) => {
    const netPayableCash = finalStaffPayTotal - totalCashAdvances;

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-4"
        >
            <div className="flex flex-wrap lg:flex-nowrap gap-2 sm:gap-3">
                <motion.div variants={item} className="flex-1 min-w-[160px] bg-[#E6F9F1] p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-emerald-100/50 flex flex-col justify-center min-h-[110px] sm:min-h-[120px] print:bg-white print:border-slate-200">
                    <p className="text-[9px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5 sm:mb-2">Gross Sales</p>
                    <p className={`${getFontSize(gross)} font-bold text-slate-900 tracking-tighter leading-none tabular-nums whitespace-nowrap`}>₱{gross.toLocaleString()}</p>
                </motion.div>
                <motion.div variants={item} className="flex-1 min-w-[160px] bg-[#FFF1F2] p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-red-100/50 flex flex-col justify-center min-h-[110px] sm:min-h-[120px] print:bg-white print:border-slate-200">
                    <p className="text-[9px] sm:text-[11px] font-bold text-red-600 uppercase tracking-widest mb-1.5 sm:mb-2">Expenses</p>
                    <p className={`${getFontSize(operationalExp)} font-bold text-slate-900 tracking-tighter leading-none tabular-nums whitespace-nowrap`}>₱{operationalExp.toLocaleString()}</p>
                </motion.div>
                <motion.div variants={item} className="flex-1 min-w-[160px] bg-[#FFFBEB] p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-amber-100/50 flex flex-col justify-center min-h-[110px] sm:min-h-[120px] print:bg-white print:border-slate-200">
                    <p className="text-[9px] sm:text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-1.5 sm:mb-2">Staff Payroll</p>
                    <div className="flex flex-col">
                        <p className={`${getFontSize(finalStaffPayTotal)} font-bold text-slate-900 tracking-tighter leading-none tabular-nums whitespace-nowrap`}>₱{finalStaffPayTotal.toLocaleString()}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-1 opacity-60">
                <span className="text-[7px] sm:text-[10px] font-black text-amber-700 uppercase">
                   Payable: ₱{netPayableCash.toLocaleString()}
                </span>
                            {totalCashAdvances > 0 && (
                                <span className="text-[7px] sm:text-[10px] font-bold text-indigo-600">
                    (−₱{totalCashAdvances} ADV)
                  </span>
                            )}
                        </div>
                    </div>
                </motion.div>
                <motion.div variants={item} className="flex-1 min-w-[160px] bg-indigo-50 p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border border-indigo-100/50 flex flex-col justify-center min-h-[110px] sm:min-h-[120px] print:bg-white print:border-slate-200">
                    <p className="text-[9px] sm:text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5 sm:mb-2">Rent & Bills</p>
                    <p className={`${getFontSize(provisionExp)} font-bold text-slate-900 tracking-tighter leading-none tabular-nums whitespace-nowrap`}>₱{provisionExp.toLocaleString()}</p>
                </motion.div>
                <motion.div variants={item} className={`flex-[1.2] min-w-[200px] p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] shadow-2xl flex flex-col justify-center min-h-[110px] sm:min-h-[120px] relative overflow-hidden group transition-colors duration-500 print:bg-white print:border-slate-200 print:shadow-none ${net < 0 ? 'bg-rose-950' : 'bg-[#0F172A]'}`}>
                    <div className={`absolute top-0 right-0 w-24 h-24 blur-2xl rounded-full no-print ${net < 0 ? 'bg-rose-500/20' : 'bg-emerald-500/10'}`}></div>
                    <p className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2 relative z-10 print:text-slate-600">Net ROI</p>
                    <p className={`${getFontSize(Math.abs(net))} font-bold tracking-tighter leading-none relative z-10 tabular-nums whitespace-nowrap print:text-slate-900 ${net < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{net < 0 ? '−' : ''}₱{Math.abs(net).toLocaleString()}</p>
                </motion.div>
            </div>
        </motion.div>
    );
};
