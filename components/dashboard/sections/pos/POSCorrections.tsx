
import React from 'react';
import { Transaction } from '../../../../types';

interface POSCorrectionsProps {
    transactions: Transaction[];
    onEdit: (tx: Transaction) => void;
    onDelete: (id: string) => void;
    isProcessing: boolean;
    isClosedMode: boolean;
}

export const POSCorrections: React.FC<POSCorrectionsProps> = ({ transactions, onEdit, onDelete, isProcessing, isClosedMode }) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-500 flex flex-col">
            <div className="flex justify-between items-end px-4 shrink-0">
                <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-slate-900 uppercase tracking-tighter">Recent Sessions</h3>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Select record for modification</p>
                </div>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl border border-emerald-100 shadow-sm uppercase tracking-widest">{transactions.length} Total Today</span>
            </div>

            <div className="flex-1 min-h-0">
                {transactions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                        {transactions.map((t) => (
                            <div key={t.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between h-full">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0 pr-4">
                                            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">{new Date(t.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                            <h4 className="font-bold text-slate-900 uppercase text-base truncate">{t.clientName}</h4>
                                        </div>
                                        <p className="font-bold text-slate-900 text-lg tabular-nums tracking-tighter">₱{t.total.toLocaleString()}</p>
                                    </div>
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase truncate leading-tight border-t border-slate-50 pt-3">{t.serviceName}</p>
                                    {t.note && (
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Note</p>
                                            <p className="text-[10px] text-slate-600 italic line-clamp-2 leading-relaxed">"{t.note}"</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-6">
                                    <button onClick={() => onEdit(t)} className="flex-1 bg-slate-900 text-white font-bold py-3.5 rounded-xl text-[10px] uppercase tracking-widest shadow-md hover:bg-emerald-600 transition-all active:scale-95">Edit Record</button>
                                    <button onClick={() => onDelete(t.id)} disabled={isProcessing || isClosedMode} className="p-3.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-95 disabled:opacity-30"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-24 text-center bg-white rounded-[44px] border-2 border-dashed border-slate-100 opacity-30 flex flex-col items-center gap-4">
                        <div className="text-6xl grayscale">📂</div>
                        <p className="text-[11px] font-bold uppercase tracking-widest">No Sessions Indexed Today</p>
                    </div>
                )}
            </div>
        </div>
    );
};
