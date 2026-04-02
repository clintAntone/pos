import React from 'react';
import { Employee } from '../../../../types';
import { UI_THEME } from '../../../../constants/ui_designs';

const ROLES_LIST = ['THERAPIST', 'BONESETTER'];

interface StaffModalsProps {
  isTimeModalOpen: boolean;
  isModalOpen: boolean;
  showBranchClosedModal?: boolean;
  selectedEmpForTime: Employee | null;
  editingEmployee: Partial<Employee> | null;
  isSyncing: boolean;
  uploadProgress: number;
  profileFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  getShiftState: (id: string) => string;
  onTimeAction: () => void;
  onSaveEmployee: () => void;
  onCloseModals: () => void;
  setEditingEmployee: (emp: any) => void;
  setProfileFile: (file: File | null) => void;
  toggleRole: (role: string) => void;
  allEmployees?: Employee[];
  branchId?: string;
}

export const StaffModals: React.FC<StaffModalsProps> = (props) => {
  if (!props.isTimeModalOpen && !props.isModalOpen && !props.showBranchClosedModal) return null;

  return (
    <>
      {/* BRANCH CLOSED WARNING MODAL */}
      {props.showBranchClosedModal && (
        <div className={UI_THEME.layout.modalWrapper}>
          <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-8 sm:p-12 text-center border border-rose-100 bg-white relative overflow-hidden`}>
            {/* Background Accent */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500"></div>
            
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner text-4xl animate-bounce">
              🔒
            </div>
            
            <h4 className="text-2xl font-bold text-slate-900 uppercase tracking-tighter mb-4">Branch is Closed</h4>
            
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-10 max-w-[280px] mx-auto">
              Personnel clock-in is restricted while the branch is offline. Please initialize the branch operations first.
            </p>
            
            <button 
              onClick={props.onCloseModals}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-[12px] shadow-xl active:scale-95 transition-all"
            >
              Acknowledged
            </button>
          </div>
        </div>
      )}

      {/* CLOCK MODAL */}
      {props.isTimeModalOpen && props.selectedEmpForTime && (
        <div className={UI_THEME.layout.modalWrapper}>
          <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-6 sm:p-10 text-center border border-slate-100`}>
             <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-900 text-white rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl text-3xl sm:text-4xl">🕒</div>
             <h4 className="text-xl sm:text-2xl font-bold text-slate-900 uppercase tracking-tighter mb-2">{props.selectedEmpForTime.name}</h4>
             <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-8 sm:mb-10">
               {props.getShiftState(props.selectedEmpForTime.id) === 'NOT_STARTED' ? 'Initializing daily shift protocol.' : 'Terminating active duty session.'}
             </p>
             <div className="flex flex-col gap-3">
                <button 
                  onClick={props.onTimeAction}
                  disabled={props.isSyncing}
                  className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold uppercase tracking-widest text-[11px] sm:text-[12px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 ${props.getShiftState(props.selectedEmpForTime.id) === 'NOT_STARTED' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                >
                  {props.isSyncing ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : (props.getShiftState(props.selectedEmpForTime.id) === 'NOT_STARTED' ? 'Initialize Clock-In' : 'Authorize Clock-Out')}
                </button>
                <button onClick={props.onCloseModals} disabled={props.isSyncing} className="w-full py-3 text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest">Abort</button>
             </div>
          </div>
        </div>
      )}

      {/* EDITOR MODAL */}
      {props.isModalOpen && props.editingEmployee && (
        <div className={UI_THEME.layout.modalWrapper}>
           <div className={`${UI_THEME.layout.modalLarge} ${UI_THEME.radius.modal} p-6 md:p-12 flex flex-col overflow-hidden max-h-[95vh] border border-slate-100`}>
              <div className="flex justify-between items-center mb-6 sm:mb-10 shrink-0">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 uppercase tracking-tighter">{props.editingEmployee.id ? 'Edit Personnel' : 'New Personnel'}</h3>
                <button onClick={props.onCloseModals} className="p-2 sm:p-3 bg-slate-50 rounded-xl sm:rounded-2xl text-slate-300 hover:text-slate-900 transition-all active:scale-90"><svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" /></svg></button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 sm:space-y-8 pr-1">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <button 
                      type="button"
                      onClick={() => props.fileInputRef.current?.click()} 
                      className="w-28 h-28 sm:w-36 sm:h-36 rounded-[36px] sm:rounded-[48px] bg-white border-4 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-emerald-500 hover:bg-emerald-50/30 group relative shadow-xl active:scale-95"
                    >
                      {props.profileFile || props.editingEmployee.profile ? (
                        <img 
                          src={props.profileFile ? URL.createObjectURL(props.profileFile) : props.editingEmployee.profile} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          alt="Preview" 
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Upload Photo</span>
                        </div>
                      )}

                      {/* Overlay on Hover when image exists */}
                      {(props.profileFile || props.editingEmployee.profile) && (
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span className="text-white text-[7px] sm:text-[8px] font-black uppercase tracking-widest">Replace Photo</span>
                        </div>
                      )}
                    </button>

                    {/* Decorative Badge */}
                    <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-xl sm:rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-white z-10">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>

                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Identity Verification Image</p>
                  <input ref={props.fileInputRef} type="file" className="hidden" accept="image/*" onChange={e => props.setProfileFile(e.target.files?.[0] || null)} />
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                      <input 
                        required 
                        value={props.editingEmployee.firstName || ''} 
                        onChange={e => {
                          const val = e.target.value.toUpperCase();
                          const fullName = `${val} ${props.editingEmployee.middleName ? props.editingEmployee.middleName.trim() + ' ' : ''}${props.editingEmployee.lastName || ''}`.trim();
                          props.setEditingEmployee({...props.editingEmployee, firstName: val, name: fullName});
                        }} 
                        className="w-full p-3.5 sm:p-5 bg-slate-50 border-2 border-transparent rounded-[16px] sm:rounded-[22px] font-bold text-xs sm:text-sm uppercase outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner" 
                        placeholder="FIRST NAME" 
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Middle Name</label>
                      <input 
                        value={props.editingEmployee.middleName || ''} 
                        onChange={e => {
                          const val = e.target.value.toUpperCase();
                          const fullName = `${props.editingEmployee.firstName || ''} ${val ? val.trim() + ' ' : ''}${props.editingEmployee.lastName || ''}`.trim();
                          props.setEditingEmployee({...props.editingEmployee, middleName: val, name: fullName});
                        }} 
                        className="w-full p-3.5 sm:p-5 bg-slate-50 border-2 border-transparent rounded-[16px] sm:rounded-[22px] font-bold text-xs sm:text-sm uppercase outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner" 
                        placeholder="OPTIONAL" 
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                      <input 
                        required 
                        value={props.editingEmployee.lastName || ''} 
                        onChange={e => {
                          const val = e.target.value.toUpperCase();
                          const fullName = `${props.editingEmployee.firstName || ''} ${props.editingEmployee.middleName ? props.editingEmployee.middleName.trim() + ' ' : ''}${val}`.trim();
                          props.setEditingEmployee({...props.editingEmployee, lastName: val, name: fullName});
                        }} 
                        className="w-full p-3.5 sm:p-5 bg-slate-50 border-2 border-transparent rounded-[16px] sm:rounded-[22px] font-bold text-xs sm:text-sm uppercase outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner" 
                        placeholder="LAST NAME" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Generated Display Name</label>
                    <div className="w-full p-4 sm:p-5 bg-white border-2 border-slate-100 rounded-[18px] sm:rounded-[24px] font-bold text-xs sm:text-sm uppercase text-slate-900 shadow-sm">
                      {props.editingEmployee.name || <span className="text-slate-300 italic">Auto-generated from full name...</span>}
                    </div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1 mt-1">This name will be used in all transactions and reports.</p>
                  </div>

                  {/* Duplicate Warning */}
                  {(() => {
                    const firstName = props.editingEmployee.firstName?.trim().toUpperCase();
                    const lastName = props.editingEmployee.lastName?.trim().toUpperCase();
                    const cleanName = `${firstName || ''} ${props.editingEmployee.middleName?.trim().toUpperCase() ? props.editingEmployee.middleName.trim().toUpperCase() + ' ' : ''}${lastName || ''}`.trim().toUpperCase();
                    
                    if (!firstName || !lastName) return null;

                    const isDuplicate = (props as any).allEmployees?.some((e: any) => {
                      if (props.editingEmployee.id && e.id === props.editingEmployee.id) return false;
                      if (e.branchId !== (props as any).branchId) return false;
                      if (!e.isActive) return false;

                      const existingFullName = e.firstName && e.lastName 
                        ? `${e.firstName} ${e.middleName ? e.middleName + ' ' : ''}${e.lastName}`.trim().toUpperCase() 
                        : (e.name || '').toUpperCase();

                      return existingFullName === cleanName;
                    });

                    if (isDuplicate) {
                      return (
                        <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                          <p className="text-[8px] font-bold text-rose-600 uppercase tracking-widest">Potential Duplicate Detected in this Branch</p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="space-y-2 sm:space-y-3">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Qualified Designations (Skill Set)</label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {ROLES_LIST.map(role => {
                        const isSelected = (props.editingEmployee?.role || '').split(',').includes(role);
                        const activeClass = role === 'THERAPIST' 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                          : 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-600/20';
                        
                        return (
                          <button 
                            key={role} 
                            type="button" 
                            onClick={() => props.toggleRole(role)} 
                            className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-bold uppercase tracking-widest transition-all border-2 ${isSelected ? activeClass : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Base Daily Payout (₱)</label>
                    <input type="number" value={props.editingEmployee.allowance || ''} onChange={e => props.setEditingEmployee({...props.editingEmployee, allowance: Number(e.target.value)})} className="w-full p-4 sm:p-5 bg-slate-50 border-2 border-transparent rounded-[18px] sm:rounded-[24px] font-bold text-sm sm:text-lg outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner" />
                  </div>
                </div>
              </div>

              <div className="pt-6 sm:pt-8 shrink-0">
                <button 
                  onClick={props.onSaveEmployee}
                  disabled={props.isSyncing || !props.editingEmployee.firstName || !props.editingEmployee.lastName || !props.editingEmployee.role}
                  className="w-full bg-slate-900 text-white font-black py-5 sm:py-6 rounded-[20px] sm:rounded-[28px] uppercase tracking-widest text-[10px] sm:text-[11px] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {props.isSyncing ? `Syncing ${props.uploadProgress}%...` : 'Commit to Registry'}
                </button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};
