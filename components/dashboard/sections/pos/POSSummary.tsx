import React, { useMemo } from 'react';
import { Service } from '../../../../types';
import { playSound } from '../../../../lib/audio';
import { POSMode } from '../POSSection';

interface POSSummaryProps {
    mode: POSMode;
    formData: any;
    setFormData: any;
    selectedServices: Service[];
    isDualProviderRequired: boolean;
    isProcessing: boolean;
    onFinalize: () => void;
    onAbort: () => void;
    primaryRole: 'THERAPIST' | 'BONESETTER';
    isPaymongoEnabled?: boolean;
}

export const POSSummary: React.FC<POSSummaryProps> = (props) => {
    const currentBasePrice = useMemo(() => props.selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0), [props.selectedServices]);

    // FIX: Match the corrected threshold logic for precisely ₱900 and above
    const pwdDiscount = useMemo(() => (props.formData.is_pwd_senior && currentBasePrice > 0) ? (currentBasePrice > 900 ? 100 : 50) : 0, [props.formData.is_pwd_senior, currentBasePrice]);

    const manualDiscount = Number(props.formData.discount || 0);
    const totalDiscount = Math.min(currentBasePrice, manualDiscount + pwdDiscount);
    const totalCalculated = Math.max(0, currentBasePrice - totalDiscount);

    const isLeadSelected = props.primaryRole === 'THERAPIST' ? props.formData.therapist_name : props.formData.bonesetter_name;
    const isSupportSelected = props.primaryRole === 'THERAPIST' ? props.formData.bonesetter_name : props.formData.therapist_name;

    const isReady = props.formData.client_name &&
        props.formData.selected_service_ids.length > 0 &&
        isLeadSelected &&
        (!props.isDualProviderRequired || isSupportSelected);

    return (
        <div className="bg-[#0F172A] text-white p-8 rounded-[44px] shadow-2xl relative overflow-hidden h-full flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full"></div>
            <div className="space-y-8 relative z-10">
                <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em]">Session Yield</p>
                    <h4 className="text-5xl font-bold tracking-tighter text-emerald-400 tabular-nums">₱{totalCalculated.toLocaleString()}</h4>
                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-2">Gross: ₱{currentBasePrice.toLocaleString()}</p>
                </div>

                <div className="space-y-6 border-t border-white/5 pt-8">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">PWD / Senior</span>
                                {props.formData.is_pwd_senior && currentBasePrice > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-500 animate-in fade-in slide-in-from-left-2 duration-300">
                                        − ₱{pwdDiscount.toLocaleString()} Applied
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => { playSound('click'); props.setFormData({...props.formData, is_pwd_senior: !props.formData.is_pwd_senior}); }}
                                className={`w-12 h-6 rounded-full transition-all relative ${props.formData.is_pwd_senior ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${props.formData.is_pwd_senior ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Manual Discount (₱)</label>
                            {manualDiscount > 0 && <button onClick={() => props.setFormData({...props.formData, discount: 0})} className="text-[8px] font-bold text-rose-400 uppercase tracking-widest hover:text-rose-300">Clear</button>}
                        </div>
                        <input
                            type="number"
                            value={props.formData.discount || ''}
                            onChange={e => props.setFormData({...props.formData, discount: Math.min(currentBasePrice - pwdDiscount, Number(e.target.value))})}
                            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-emerald-500 transition-all shadow-inner tabular-nums"
                            placeholder="0"
                        />
                    </div>

                    <div className="space-y-3 pt-4">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Settlement Method</label>
                        <div className={`grid ${props.isPaymongoEnabled ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                            <button
                                onClick={() => { playSound('click'); props.setFormData({...props.formData, payment_method: 'CASH'}); }}
                                className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${props.formData.payment_method === 'CASH' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                            >
                                💵 Cash
                            </button>
                            {props.isPaymongoEnabled && (
                                <button
                                    onClick={() => { playSound('click'); props.setFormData({...props.formData, payment_method: 'PAYMONGO'}); }}
                                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${props.formData.payment_method === 'PAYMONGO' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                >
                                    📱 GCash / Maya
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3 mt-12">
                <button
                    disabled={!isReady || props.isProcessing}
                    onClick={() => { playSound('click'); props.onFinalize(); }}
                    className={`w-full text-white font-bold py-7 rounded-[32px] shadow-xl uppercase tracking-[0.3em] text-sm active:scale-[0.98] disabled:opacity-30 transition-all ${props.mode === 'EDITING' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                >
                    {props.isProcessing ? 'Saving...' : props.mode === 'EDITING' ? 'Apply Corrections' : 'Finalize Session'}
                </button>
                <button
                    onClick={props.onAbort}
                    className="w-full text-slate-500 text-[10px] font-bold uppercase tracking-widest py-2 hover:text-slate-300 transition-colors"
                >
                    {props.mode === 'EDITING' ? 'Discard Changes' : 'Reset Entry Form'}
                </button>
            </div>
        </div>
    );
};