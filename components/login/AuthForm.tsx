
import React from 'react';
import { Employee } from '../../types';

interface AuthFormProps {
  username: string;
  setUsername: (val: string) => void;
  pin: string;
  setPin: (val: string) => void;
  isReliefMode: boolean;
  isSetupMode: boolean;
  isAdmin: boolean;
  tempManagerIdentity?: Employee | null;
  isAuthenticating: boolean;
  lockoutUntil: number | null;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  username, setUsername, pin, setPin, isReliefMode, isSetupMode, isAdmin, tempManagerIdentity, isAuthenticating, lockoutUntil
}) => {
  return (
    <div className="space-y-4">
      {/* USERNAME FIELD */}
      {(!isSetupMode && !isAdmin && !isReliefMode) && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Identity Username</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value.toLowerCase())} 
            placeholder="USERNAME" 
            className="w-full p-4 sm:p-5 bg-slate-50 border-2 border-transparent text-[12px] rounded-[15px] font-bold uppercase outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner text-center tracking-widest" 
            disabled={isAuthenticating} 
            autoFocus 
          />
        </div>
      )}

      {/* RELIEF IDENTITY CARD */}
      {isReliefMode && tempManagerIdentity && (
        <div className="p-4 bg-indigo-50 rounded-[15px] border border-indigo-100 flex items-center gap-4 mb-2 animate-in fade-in slide-in-from-top-1">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
            {tempManagerIdentity.profile ? <img src={tempManagerIdentity.profile} className="w-full h-full object-cover" alt="p" /> : '👤'}
          </div>
          <div className="overflow-hidden">
            <p className="text-[8px] font-semibold text-indigo-400 uppercase tracking-widest">Authorized Relief Head</p>
            <p className="text-[12px] font-bold text-slate-900 uppercase truncate">{tempManagerIdentity.name}</p>
          </div>
        </div>
      )}

      {/* PIN FIELD */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">
          {isSetupMode ? 'Initial Branch PIN' : 'Security PIN'}
        </label>
        <input 
          type="password" 
          maxLength={6} 
          inputMode="numeric" 
          value={pin} 
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} 
          className="w-full p-5 sm:p-6 text-center text-3xl font-black tracking-[0.5em] pl-[0.5em] bg-slate-50 border-2 border-transparent rounded-[15px] sm:rounded-[28px] focus:border-emerald-500 focus:bg-white outline-none transition-all" 
          autoComplete="off" 
          disabled={isAuthenticating || !!lockoutUntil} 
          placeholder="••••••" 
        />
      </div>
    </div>
  );
};
