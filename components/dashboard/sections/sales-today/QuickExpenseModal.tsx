
import React, { useState, useRef } from 'react';
import { Branch } from '../../../../types';
import { DB_TABLES, DB_COLUMNS } from '../../../../constants/db_schema';
import { supabase } from '../../../../lib/supabase';
import { playSound } from '../../../../lib/audio';
import { compressImage } from '../../../../lib/image';

interface QuickExpenseModalProps {
  branch: Branch;
  todayStr: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export const QuickExpenseModal: React.FC<QuickExpenseModalProps> = ({ branch, todayStr, onClose, onRefresh }) => {
  const [expenseForm, setExpenseForm] = useState({ name: '', amount: 0 });
  const [expenseFile, setExpenseFile] = useState<File | null>(null);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleQuickAddExpense = async () => {
    if (!expenseForm.name || !expenseForm.amount || isSavingExpense) return;
    setIsSavingExpense(true);
    setErrorMessage('');
    setUploadProgress(10);
    let receiptUrl = '';
    
    const now = new Date();
    const timePart = now.toTimeString().split(' ')[0];
    const timestamp = `${todayStr}T${timePart}.000Z`;

    const expenseId = Math.random().toString(36).substr(2, 9);
    try {
      if (expenseFile) {
        setUploadProgress(30);
        // This call might now throw specific file-type errors from v2.2 utility
        const compressedBlob = await compressImage(expenseFile);
        setUploadProgress(50);
        const filePath = `${branch.id}/${todayStr}/${Date.now()}_quick.jpg`;
        const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, compressedBlob, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
        receiptUrl = data.publicUrl;
      }
      
      const { error: dbError } = await supabase.from(DB_TABLES.EXPENSES).insert({ 
        [DB_COLUMNS.ID]: expenseId, [DB_COLUMNS.BRANCH_ID]: branch.id, [DB_COLUMNS.TIMESTAMP]: timestamp, 
        [DB_COLUMNS.NAME]: expenseForm.name.trim().toUpperCase(), [DB_COLUMNS.AMOUNT]: Number(expenseForm.amount), 
        [DB_COLUMNS.CATEGORY]: 'OPERATIONAL', [DB_COLUMNS.RECEIPT_IMAGE]: receiptUrl || null 
      });
      if (dbError) throw dbError;

      playSound('success');
      onRefresh?.();
      onClose();
    } catch (err: any) { 
      setErrorMessage(err.message || 'Registry Sync Fault');
      playSound('warning'); 
    } finally { 
      setIsSavingExpense(false); 
      setUploadProgress(0); 
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-[44px] w-full max-w-xl shadow-2xl flex flex-col animate-in zoom-in duration-300">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h4 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Quick Expense Log</h4>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-900 transition-all">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-10 space-y-6">
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-center text-[10px] font-bold text-rose-600 uppercase tracking-widest animate-in slide-in-from-top-2">
               {errorMessage}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Label</label>
            <input value={expenseForm.name} onChange={e => setExpenseForm({...expenseForm, name: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[24px] font-bold text-sm uppercase outline-none focus:border-rose-500 transition-all shadow-inner" placeholder="E.G. LAUNDRY..." />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount (₱)</label>
            <input type="number" value={expenseForm.amount || ''} onChange={e => setExpenseForm({...expenseForm, amount: Number(e.target.value)})} className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[24px] font-bold text-lg outline-none focus:border-rose-500 transition-all shadow-inner" placeholder="0" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Receipt Verification <span className="text-[8px] opacity-50 font-bold">(Optional)</span></label>
            {expenseFile ? (
                <div className="w-full p-6 rounded-[32px] border-2 border-emerald-500 bg-emerald-50 flex items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white shadow-lg border border-slate-200">
                      <img src={URL.createObjectURL(expenseFile)} className="w-full h-full object-cover" alt="Receipt preview" />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-black uppercase text-emerald-900">Evidence Indexed</p>
                      <p className="text-[9px] font-bold text-emerald-600/60 uppercase tracking-widest">Ready for sync</p>
                    </div>
                  </div>
                  <button
                      type="button"
                      onClick={() => { setExpenseFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="p-3 text-rose-500 hover:bg-rose-100 rounded-full transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.setAttribute('capture', 'environment');
                          fileInputRef.current.click();
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-2 py-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] hover:border-rose-500 hover:bg-rose-50/30 transition-all group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">📷</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-rose-600">Snap Photo</span>
                  </button>

                  <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.click();
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-2 py-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[32px] hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">📁</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600">Upload File</span>
                  </button>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => setExpenseFile(e.target.files?.[0] || null)}
            />
          </div>
          <button onClick={handleQuickAddExpense} disabled={!expenseForm.name || !expenseForm.amount || isSavingExpense} className="w-full bg-slate-900 text-white font-bold py-6 rounded-[32px] uppercase tracking-widest text-[12px] shadow-lg active:scale-95 disabled:opacity-30">
            {isSavingExpense ? `Synchronizing (${uploadProgress}%)...` : 'Commit Expense'}
          </button>
        </div>
      </div>
    </div>
  );
};
