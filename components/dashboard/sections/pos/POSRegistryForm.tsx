
import React, { useMemo } from 'react';
import { Branch, Service, Employee } from '../../../../types';
import { POSMode } from '../POSSection';
import { POSServiceSelection } from './POSServiceSelection';
import { POSStaffSelection } from './POSStaffSelection';
import { POSSummary } from './POSSummary';

interface POSRegistryFormProps {
    mode: POSMode;
    branch: Branch;
    formData: any;
    setFormData: any;
    activeServices: Service[];
    availableTherapists: Employee[];
    availableBonesetters: Employee[];
    isProcessing: boolean;
    isClosedMode: boolean;
    isPaymongoEnabled?: boolean;
    onFinalize: () => void;
    onAbort: () => void;
}

export const POSRegistryForm: React.FC<POSRegistryFormProps> = (props) => {
    const selectedServices = props.activeServices.filter(s => props.formData.selected_service_ids.includes(s.id));
    const rolesInSelection = new Set(selectedServices.map(s => s.primaryRole || 'THERAPIST'));
    const isDualProviderRequired = selectedServices.some(s => s.isDualProvider) || rolesInSelection.size > 1;
    const primaryRole = selectedServices.length > 0 ? (selectedServices[0].primaryRole || 'THERAPIST') : 'THERAPIST';

    return (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500 ${props.isClosedMode ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
            <div className="lg:col-span-8 space-y-6">
                <div className="bg-white p-6 md:p-10 rounded-[22px] shadow-sm border border-slate-200 space-y-8">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between ml-2">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em]">Customer Information</h3>
                            {props.mode === 'EDITING' && <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-[8px] font-bold uppercase border border-amber-100 tracking-widest animate-pulse">Correction Active</span>}
                        </div>

                        <input
                            value={props.formData.client_name}
                            onChange={e =>
                                props.setFormData((prev: any) => ({
                                    ...prev,
                                    client_name: e.target.value
                                }))
                            }
                            onBlur={() =>
                                props.setFormData((prev: any) => ({
                                    ...prev,
                                    client_name: prev.client_name.toUpperCase()
                                }))
                            }
                            placeholder="CLIENT FULL NAME..."
                            className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[24px] font-bold text-sm uppercase outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                        />

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Transaction Note (Optional)</label>
                            <textarea
                                value={props.formData.note}
                                onChange={e => props.setFormData({...props.formData, note: e.target.value})}
                                placeholder="ADD SPECIAL INSTRUCTIONS OR NOTES..."
                                className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[24px] font-bold text-sm uppercase outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner min-h-[100px] resize-none"
                            />
                        </div>
                    </div>

                    <POSServiceSelection
                        services={props.activeServices}
                        selectedIds={props.formData.selected_service_ids}
                        onToggle={(id: string) => {
                            const isSelected = props.formData.selected_service_ids.includes(id);
                            props.setFormData((f: any) => ({
                                ...f,
                                selected_service_ids: isSelected ? f.selected_service_ids.filter((sid: string) => sid !== id) : [...f.selected_service_ids, id]
                            }));
                        }}
                    />
                </div>

                <POSStaffSelection
                    primaryRole={primaryRole}
                    isDualProviderRequired={isDualProviderRequired}
                    availableTherapists={props.availableTherapists}
                    availableBonesetters={props.availableBonesetters}
                    selectedTherapistName={props.formData.therapist_name}
                    selectedTherapistId={props.formData.therapist_id}
                    selectedBonesetterName={props.formData.bonesetter_name}
                    selectedBonesetterId={props.formData.bonesetter_id}
                    onSelectTherapist={(name: string, id: string) => props.setFormData({...props.formData, therapist_name: name, therapist_id: id})}
                    onSelectBonesetter={(name: string, id: string) => props.setFormData({...props.formData, bonesetter_name: name, bonesetter_id: id})}
                />
            </div>

            <div className="lg:col-span-4">
                <POSSummary
                    mode={props.mode}
                    formData={props.formData}
                    setFormData={props.setFormData}
                    selectedServices={selectedServices}
                    isDualProviderRequired={isDualProviderRequired}
                    isProcessing={props.isProcessing}
                    onFinalize={props.onFinalize}
                    onAbort={props.onAbort}
                    primaryRole={primaryRole}
                    isPaymongoEnabled={props.isPaymongoEnabled}
                />
            </div>
        </div>
    );
};
