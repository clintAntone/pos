
import React from 'react';

const ROLE_ORDER = ['MANAGER', 'THERAPIST', 'BONESETTER', 'TRAINEE'];

export const RoleBadge = ({ role, centered = false }: { role: string, centered?: boolean }) => {
  const styles: Record<string, string> = {
    MANAGER: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    THERAPIST: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    BONESETTER: 'bg-amber-50 text-amber-700 border-amber-100',
    TRAINEE: 'bg-slate-50 text-slate-500 border-slate-100'
  };
  
  const roles = (role || '').split(',')
    .filter(Boolean)
    .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
    
  return (
    <div className={`flex flex-wrap gap-1 ${centered ? 'justify-center w-full' : ''}`}>
      {roles.map(r => (
        <span key={r} className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-widest border ${styles[r] || styles.TRAINEE}`}>
          {r}
        </span>
      ))}
    </div>
  );
};
