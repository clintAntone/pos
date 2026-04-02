import React, { useMemo } from 'react';
import { Service } from '../../../../types';
import { UI_THEME } from '../../../../constants/ui_designs';
import { playSound } from '../../../../lib/audio';
import { POSMode } from '../POSSection';

interface POSConfirmModalProps {
    mode: POSMode;
    formData: any;
    activeServices: Service[];
    isProcessing: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const POSConfirmModal: React.FC<POSConfirmModalProps> = (props) => {
    const selectedServices = props.activeServices.filter(s => props.formData.selected_service_ids.includes(s.id));
    const rolesInSelection = new Set(selectedServices.map(s => s.primaryRole || 'THERAPIST'));
    const isDualProviderRequired = selectedServices.some(s => s.isDualProvider) || rolesInSelection.size > 1;
    const currentBasePrice = useMemo(() => selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0), [selectedServices]);
    // FIX: Update threshold to 900 as per user request
    const pwdDiscount = (props.formData.is_pwd_senior && currentBasePrice > 0) ? (currentBasePrice > 900 ? 100 : 50) : 0;
    const totalDiscount = props.formData.discount + pwdDiscount;
    const totalCalculated = Math.max(0, currentBasePrice - totalDiscount);

    const calculateTotalCommission = (services: Service[], totalDiscount: number, roleToCalculate: 'THERAPIST' | 'BONESETTER'): number => {
        const totalPrice = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
        if (totalPrice === 0) return 0;
        return services.reduce((sum, s) => {
            const finalSPrice = Math.max(0, (Number(s.price) || 0) - (totalDiscount * (Number(s.price) || 0) / totalPrice));
            const sPrimaryRole = s.primaryRole || 'THERAPIST';

            if (sPrimaryRole === roleToCalculate) {
                return sum + (s.commissionType === 'fixed' ? Number(s.commissionValue || 0) : (finalSPrice * Number(s.commissionValue || 0)) / 100);
            } else if (s.isDualProvider) {
                const sSecondaryRole = sPrimaryRole === 'THERAPIST' ? 'BONESETTER' : 'THERAPIST';
                if (sSecondaryRole === roleToCalculate) {
                    return sum + (s.secondaryCommissionType === 'fixed' ? Number(s.secondaryCommissionValue || 0) : (finalSPrice * Number(s.secondaryCommissionValue || 0)) / 100);
                }
            }
            return sum;
        }, 0);
    };

    const primaryRole = selectedServices.length > 0 ? (selectedServices[0].primaryRole || 'THERAPIST') : 'THERAPIST';
    const therapistComm = calculateTotalCommission(selectedServices, totalDiscount, 'THERAPIST');
    const bonesetterComm = calculateTotalCommission(selectedServices, totalDiscount, 'BONESETTER');

    const leadName = primaryRole === 'THERAPIST' ? props.formData.therapist_name : props.formData.bonesetter_name;
    const supportName = primaryRole === 'THERAPIST' ? props.formData.bonesetter_name : props.formData.therapist_name;
    const leadComm = primaryRole === 'THERAPIST' ? therapistComm : bonesetterComm;
    const supportComm = primaryRole === 'THERAPIST' ? bonesetterComm : therapistComm;

    return (
        <div className={UI_THEME.layout.modalWrapper}>
            <div className={`${UI_THEME.layout.modalLarge} ${UI_THEME.radius.modal} p-5 md:p-8 flex flex-col overflow-hidden max-h-[95vh]`}>
                <div className="space-y-1 text-center shrink-0 mb-4">
                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900 uppercase tracking-tighter leading-none">{props.mode === 'EDITING' ? 'Modify Registry' : 'Confirm Session'}</h3>
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.4em]">Final Authentication Gate</p>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 px-1">
                    {/* CLIENT IDENTITY */}
                    <div className="bg-slate-900 rounded-[24px] p-4 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 blur-2xl rounded-full"></div>
                        <div className="relative z-10">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Client Identity</p>
                            <h4 className="text-lg font-bold uppercase tracking-tight truncate">{props.formData.client_name}</h4>
                        </div>
                    </div>

                    {/* SERVICES AVAILED */}
                    <div className="space-y-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-3">Services Availed</p>
                        <div className="bg-slate-50 rounded-[28px] p-3 space-y-2">
                            {selectedServices.map(s => {
                                const getCatalogColor = (catalogId?: string) => {
                                    if (!catalogId) return 'emerald';
                                    const colors = ['indigo', 'violet', 'rose', 'amber', 'cyan', 'emerald', 'fuchsia', 'orange', 'sky', 'teal'];
                                    let hash = 0;
                                    for (let i = 0; i < catalogId.length; i++) {
                                        hash = catalogId.charCodeAt(i) + ((hash << 5) - hash);
                                    }
                                    return colors[Math.abs(hash) % colors.length];
                                };
                                const color = getCatalogColor(s.catalogId);
                                const colorClasses: Record<string, string> = {
                                    emerald: 'border-emerald-100 bg-emerald-50/30',
                                    indigo: 'border-indigo-100 bg-indigo-50/30',
                                    violet: 'border-violet-100 bg-violet-50/30',
                                    rose: 'border-rose-100 bg-rose-50/30',
                                    amber: 'border-amber-100 bg-amber-50/30',
                                    cyan: 'border-cyan-100 bg-cyan-50/30',
                                    fuchsia: 'border-fuchsia-100 bg-fuchsia-50/30',
                                    orange: 'border-orange-100 bg-orange-50/30',
                                    sky: 'border-sky-100 bg-sky-50/30',
                                    teal: 'border-teal-100 bg-teal-50/30',
                                };
                                const textClasses: Record<string, string> = {
                                    emerald: 'text-emerald-600',
                                    indigo: 'text-indigo-600',
                                    violet: 'text-violet-600',
                                    rose: 'text-rose-600',
                                    amber: 'text-amber-600',
                                    cyan: 'text-cyan-600',
                                    fuchsia: 'text-fuchsia-600',
                                    orange: 'text-orange-600',
                                    sky: 'text-sky-600',
                                    teal: 'text-teal-600',
                                };

                                return (
                                    <div key={s.id} className={`flex justify-between items-center p-2.5 rounded-xl shadow-sm border ${colorClasses[color]}`}>
                                        <div className="min-w-0 pr-4">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-900 uppercase text-[10px] truncate">{s.name}</p>
                                                {s.catalogName && (
                                                    <span className={`text-[5px] font-black px-1 rounded bg-white border border-current uppercase tracking-tighter ${textClasses[color]}`}>
                                                        {s.catalogName}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[7px] font-semibold text-slate-400 uppercase tracking-widest">{s.duration} MINS</p>
                                        </div>
                                        <p className="font-bold text-slate-700 text-xs tabular-nums shrink-0">₱{s.price.toLocaleString()}</p>
                                    </div>
                                );
                            })}
                            {totalDiscount > 0 && (
                                <div className="flex justify-between items-center px-3 py-0.5">
                                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">Aggregate Reductions</span>
                                    <span className="font-bold text-rose-600 text-xs tabular-nums">−₱{totalDiscount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="h-px bg-slate-200 mx-2 my-1.5"></div>
                            <div className="flex justify-between items-center px-3 py-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Collection</span>
                                <span className="text-xl font-bold text-slate-900 tracking-tighter">₱{totalCalculated.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* COMMISSION BREAKDOWN */}
                    <div className="space-y-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-3">Commission Allocation</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-[24px] space-y-0.5">
                                <p className="text-[7px] font-bold text-emerald-600 uppercase tracking-widest">Lead Provider ({primaryRole})</p>
                                <p className="font-bold text-slate-900 uppercase text-[11px] truncate">{leadName}</p>
                                <p className="text-base font-bold text-emerald-700 tracking-tighter leading-none mt-1.5">₱{leadComm.toLocaleString()}</p>
                            </div>
                            {isDualProviderRequired && (
                                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-[24px] space-y-0.5">
                                    <p className="text-[7px] font-bold text-indigo-600 uppercase tracking-widest">Specialist Support</p>
                                    <p className="font-bold text-slate-900 uppercase text-[11px] truncate">{supportName}</p>
                                    <p className="text-base font-bold text-indigo-700 tracking-tighter leading-none mt-1.5">₱{supportComm.toLocaleString()}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-row gap-3 mt-6 shrink-0">
                    <button onClick={() => { playSound('click'); props.onClose(); }} disabled={props.isProcessing} className="flex-1 text-slate-500 font-bold py-4 rounded-[24px] border border-slate-200 uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all">
                        Go Back
                    </button>
                    <button onClick={props.onConfirm} disabled={props.isProcessing} className="flex-[2] bg-[#0F172A] text-white font-bold py-4 rounded-[24px] uppercase tracking-widest text-[10px] shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        {props.isProcessing && <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
                        {props.isProcessing ? 'SYNCING...' : 'CONFIRM & COMMIT'}
                    </button>
                </div>
            </div>
        </div>
    );
};