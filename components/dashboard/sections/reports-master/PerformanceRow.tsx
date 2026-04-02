import React from 'react';
import { UI_THEME } from '../../../../constants/ui_designs';

interface PerformanceRowProps {
    label: string;
    sublabel: string;
    branchName: string;
    gross: number;
    pay: number;
    exp: number;
    vault: number;
    net: number;
    onClick: () => void;
    isMissing?: boolean;
}

export const PerformanceRow: React.FC<PerformanceRowProps> = ({
                                                                  label,
                                                                  sublabel,
                                                                  branchName,
                                                                  gross,
                                                                  pay,
                                                                  exp,
                                                                  vault,
                                                                  net,
                                                                  onClick,
                                                                  isMissing = false
                                                              }) => {
    const isPositive = net >= 0;

    if (isMissing) {
        return (
            <div
                onClick={onClick}
                className={`bg-rose-50/30 ${UI_THEME.radius.card} border border-rose-100 p-6 flex flex-col gap-4 mb-4 relative overflow-hidden cursor-pointer`}
            >
                <div className="absolute left-0 top-0 h-full w-2 bg-rose-500"></div>
                <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">MISSING DATA</span>
                        </div>
                        <span className="font-bold text-slate-900 uppercase text-lg tracking-tight block leading-none">{label}</span>
                        <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-widest mt-1.5 opacity-60">No operational data submitted</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-300 text-lg">⚠️</div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table Row */}
            <div
                onClick={onClick}
                className="hidden md:flex group transition-all cursor-pointer border-b border-slate-100 last:border-0 items-center"
            >
                <div className="px-8 py-5 w-[18%]">
                    <div className="flex flex-col">
            <span className="font-bold text-slate-900 uppercase text-sm tracking-tight group-hover:text-emerald-700 transition-colors whitespace-nowrap">
              {label}
            </span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1 opacity-70">
               {sublabel}
            </span>
                    </div>
                </div>
                <div className="px-6 py-5 w-[22%]">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-lg shadow-inner shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            🏢
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 uppercase text-[12px] tracking-wider leading-tight">{branchName}</span>
                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">Verified Archive</span>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-5 w-[11%] text-right font-bold text-slate-900 text-[15px] tabular-nums whitespace-nowrap">₱{gross.toLocaleString()}</div>
                <div className="px-6 py-5 w-[11%] text-right font-semibold text-amber-600 text-[15px] tabular-nums whitespace-nowrap">₱{pay.toLocaleString()}</div>
                <div className="px-6 py-5 w-[11%] text-right font-semibold text-rose-500 text-[15px] tabular-nums whitespace-nowrap">₱{exp.toLocaleString()}</div>
                <div className="px-6 py-5 w-[11%] text-right font-bold text-indigo-700 text-[15px] tabular-nums whitespace-nowrap">₱{vault.toLocaleString()}</div>
                <div className="px-8 py-5 w-[16%] text-right">
                    <div className="flex flex-col items-end">
            <span className={`font-bold tabular-nums leading-none whitespace-nowrap ${isPositive ? 'text-emerald-600' : 'text-rose-600'} ${
                net.toLocaleString().length > 9 ? 'text-sm lg:text-base' :
                    net.toLocaleString().length > 7 ? 'text-base lg:text-lg' :
                        'text-xl lg:text-2xl'
            }`}>
              {net < 0 ? '−' : ''}₱{Math.abs(net).toLocaleString()}
            </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest mt-1.5 text-slate-300 whitespace-nowrap">Finalized ROI</span>
                    </div>
                </div>
            </div>

            {/* Mobile Card View */}
            <div
                onClick={onClick}
                className={`md:hidden ${UI_THEME.radius.card} border border-slate-100 p-4 flex flex-col gap-3 active:scale-[0.98] transition-all shadow-sm mb-3 relative overflow-hidden`}
            >
                <div className={`absolute left-0 top-0 h-full w-1.5 ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{branchName}</span>
                        </div>
                        <span className="font-bold text-slate-900 uppercase text-base tracking-tight block leading-none">{label}</span>
                        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-1 opacity-60">{sublabel}</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 text-lg">🏢</div>
                </div>
                <div className="flex flex-col gap-2.5 py-3 border-y border-slate-50">
                    <div className="flex justify-between items-center min-w-0">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Gross Yield</span>
                        <span className="text-[13px] font-bold text-slate-900 tabular-nums">₱{gross.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center min-w-0">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Payroll Total</span>
                        <span className="text-[13px] font-bold text-amber-600 tabular-nums">₱{pay.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center min-w-0">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Expenses</span>
                        <span className="text-[13px] font-bold text-rose-500 tabular-nums">₱{exp.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center min-w-0">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Vault Reserve</span>
                        <span className="text-[13px] font-bold text-indigo-600 tabular-nums">₱{vault.toLocaleString()}</span>
                    </div>
                </div>
                <div className={`p-3 rounded-xl flex items-center justify-between border border-slate-50`}>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Audited P/L</span>
                    <p className={`font-bold tracking-tight leading-none whitespace-nowrap ${isPositive ? 'text-emerald-700' : 'text-rose-700'} ${
                        net.toLocaleString().length > 9 ? 'text-sm' :
                            net.toLocaleString().length > 7 ? 'text-base' :
                                'text-xl'
                    }`}>
                        {net < 0 ? '−' : ''}₱{Math.abs(net).toLocaleString()}
                    </p>
                </div>
            </div>
        </>
    );
};
