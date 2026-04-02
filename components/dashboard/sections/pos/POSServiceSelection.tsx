import React, { useMemo } from 'react';
import { Service } from '../../../../types';
import { playSound } from '../../../../lib/audio';

interface POSServiceSelectionProps {
    services: Service[];
    selectedIds: string[];
    onToggle: (id: string) => void;
}

export const POSServiceSelection: React.FC<POSServiceSelectionProps> = ({ services, selectedIds, onToggle }) => {

    // Group services by catalogId
    const groupedServices = useMemo(() => {
        const groups: Record<string, { name: string; services: Service[] }> = {};
        services.forEach(service => {
            const catId = service.catalogId || 'uncategorized';
            const catName = service.catalogName || 'Uncategorized';
            if (!groups[catId]) groups[catId] = { name: catName, services: [] };
            groups[catId].services.push(service);
        });
        return Object.entries(groups); // [ [catId, {name, services}], ... ]
    }, [services]);

    return (
        <div className="space-y-6">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] ml-2">
                Service Unit Selection
            </h3>

            {services.length > 0 ? (
                <div className="space-y-8">
                    {groupedServices.map(([catId, group]) => (
                        <div key={catId} className="space-y-3">
                            {/* Catalog Header */}
                            <div className="flex items-center gap-3 px-2">
                                <div className="h-px flex-1 bg-slate-200" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                    {group.name} {/* Catalog Name */}
                                </span>
                                <div className="h-px flex-1 bg-slate-200" />
                            </div>

                            {/* Services Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {group.services.map(s => {
                                    const isSelected = selectedIds.includes(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => {
                                                playSound('click');
                                                onToggle(s.id);
                                            }}
                                            className={`p-5 rounded-[28px] border-2 text-left transition-all duration-300 relative group overflow-hidden ${
                                                isSelected
                                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-100 scale-[1.02]'
                                                    : 'bg-white border-slate-100 hover:border-emerald-200'
                                            }`}
                                        >
                                            <div className="flex flex-col h-full justify-between gap-1 relative z-10">
                                                <p className={`font-bold text-[11px] sm:text-[13px] uppercase leading-tight tracking-tight ${
                                                    isSelected ? 'text-white' : 'text-slate-900 group-hover:text-emerald-700'
                                                }`}>{s.name}</p>

                                                <div className="flex items-center justify-between mt-2">
                                                    <span className={`text-[9px] font-bold uppercase tracking-widest ${
                                                        isSelected ? 'text-emerald-100' : 'text-slate-400'
                                                    }`}>{s.duration} MINS</span>

                                                    <span className={`text-sm font-bold tabular-nums ${
                                                        isSelected ? 'text-white' : 'text-emerald-600'
                                                    }`}>₱{s.price}</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-16 px-8 text-center bg-slate-50 rounded-[36px] border-2 border-dashed border-slate-200 animate-in fade-in duration-700">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                        <span className="text-3xl grayscale">🛠️</span>
                    </div>
                    <p className="text-[12px] font-bold text-slate-900 uppercase tracking-widest leading-none mb-3">
                        No Services Found
                    </p>
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest max-w-[280px] mx-auto leading-relaxed">
                        This node has no catalog subscription attached. Please contact the <span className="text-emerald-600">Network Administrator</span> to synchronize service units.
                    </p>
                </div>
            )}
        </div>
    );
};
