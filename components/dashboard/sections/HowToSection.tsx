import React, { useState, useEffect } from 'react';
import { UserRole } from '../../../types';
import { UI_THEME } from '../../../constants/ui_designs';
import { supabase } from '../../../lib/supabase';
import { DB_TABLES, DB_COLUMNS } from '../../../constants/db_schema';

interface HowToSectionProps {
  role: UserRole;
}

const ProtocolCard = ({ title, desc, icon, color }: { title: string, desc: string, icon: string, color: string }) => (
  <div className="bg-white p-6 rounded-[32px] border border-slate-100 relative overflow-hidden group shadow-sm">
    <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2`}></div>
    <div className="relative z-10">
      <div className="text-2xl mb-4">{icon}</div>
      <h4 className="text-slate-900 font-bold uppercase text-[11px] tracking-widest mb-2">{title}</h4>
      <p className="text-slate-400 text-[10px] leading-relaxed uppercase font-bold">{desc}</p>
    </div>
  </div>
);

const StepItem = ({ number, title, desc, icon, isLast = false }: { number: string, title: string, desc: string, icon: React.ReactNode, isLast?: boolean }) => (
  <div className="relative flex gap-6 md:gap-10 pb-12 group">
    {!isLast && <div className="absolute left-[23px] top-12 bottom-0 w-0.5 bg-slate-100 group-hover:bg-emerald-100 transition-colors"></div>}
    <div className="relative z-10 w-12 h-12 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center font-black text-slate-300 transition-all group-hover:border-emerald-500 group-hover:text-emerald-600 shadow-sm">
      {number}
    </div>
    <div className="flex-1 bg-white p-6 md:p-8 rounded-[36px] border border-slate-100 shadow-sm group-hover:shadow-xl transition-all duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
            {icon}
          </div>
          <h3 className="font-bold text-slate-900 uppercase text-sm md:text-base tracking-tight">{title}</h3>
        </div>
      </div>
      <p className="text-slate-500 text-xs md:text-[13px] font-medium leading-relaxed">{desc}</p>
    </div>
  </div>
);

const CardReference = ({ title, action, validation, icon }: { title: string, action: string, validation: string, icon: string }) => (
  <div className="bg-slate-50 rounded-[28px] p-6 border border-slate-100 space-y-4">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-xl border border-slate-100">{icon}</div>
      <h5 className="font-bold text-slate-900 uppercase text-[12px] tracking-tight">{title}</h5>
    </div>
    <div className="space-y-3">
      <div>
        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Interaction Behavior</p>
        <p className="text-[11px] font-medium text-slate-600 leading-relaxed uppercase">{action}</p>
      </div>
      <div className="pt-2 border-t border-slate-200/50">
        <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">Node Validation</p>
        <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase italic">{validation}</p>
      </div>
    </div>
  </div>
);

export const HowToSection: React.FC<HowToSectionProps> = ({ role }) => {
  const isSuperAdmin = role === UserRole.SUPERADMIN;
  const [heartbeatTime, setHeartbeatTime] = useState<string>('00:00');

  useEffect(() => {
    const fetchHeartbeat = async () => {
        const { data } = await supabase.from(DB_TABLES.SYSTEM_CONFIG).select('*').eq(DB_COLUMNS.KEY, 'auto_refresh_daily_audit').single();
        if (data) setHeartbeatTime(data[DB_COLUMNS.VALUE]);
    };
    fetchHeartbeat();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-16 animate-in fade-in duration-700 pb-40 px-2 sm:px-6">
      {/* HEADER */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-5 py-2 rounded-full mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span>
          <span className="text-[9px] font-black uppercase tracking-[0.4em] text-emerald-600">Standard Operating Procedures</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-black text-slate-950 uppercase tracking-tighter leading-none">
          {isSuperAdmin ? 'Network Blueprint' : 'Operational Manual'}
        </h2>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.5em]">HilotCenter Core Terminal v5.2 • Distributed Intelligence</p>
      </div>

      {/* PROTOCOL GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProtocolCard 
          icon="🛡️" color="bg-emerald-500"
          title="Personnel Integrity"
          desc="Only Therapists and Bonesetters are recognized. Providers must be clocked in to appear in the POS selector. Unregistered staff are strictly prohibited from node access."
        />
        <ProtocolCard 
          icon="🕛" color="bg-amber-500"
          title="The Midnight Rule"
          desc={`Nodes force-close at ${heartbeatTime} Manila Time. Sessions left in the registry are automatically purged to Archive. Managers must ensure all sessions are closed before heartbeat.`}
        />
        <ProtocolCard 
          icon="💹" color="bg-indigo-500"
          title="Yield Logic"
          desc="Net ROI = Gross - (Ops Expenses + R&B Provision + Staff Pay). Payroll includes OT additions and Late deductions. Real-time yield is broadcast to the central hub."
        />
      </div>

      {/* CORE WORKFLOWS */}
      <div className="space-y-10">
        <div className="flex items-center gap-4 px-4">
          <div className="w-1.5 h-8 bg-slate-900 rounded-full"></div>
          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">1. Primary Operational Flow</h4>
        </div>
        
        <div className="max-w-4xl">
          {isSuperAdmin ? (
            <>
              <StepItem 
                number="01" title="Node Deployment"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                desc="Register a new terminal in the 'Branches' tab. This initializes a 6-digit random code. The node remains 'Offline' until a manager completes the profile handshake. Ensure the branch name follows the standard naming convention (e.g., CITY - LOCATION)."
              />
              <StepItem 
                number="02" title="Catalog Relay"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                desc="Service pricing is managed globally. Link your Master Catalogs to specific nodes. Any change made to a catalog is broadcast to all linked branches instantly. Use the 'Matrix' tab to verify service availability across the network."
              />
              <StepItem 
                number="03" title="Identity Registry"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8zm14-2v2m-3-1h6"/></svg>}
                desc="Use 'Staff Master' to register personnel. Managers must be assigned to a specific branch slot in the 'Branch Editor' to enable login permissions. Verify staff credentials and roles before deployment."
              />
              <StepItem 
                number="04" title="Neural Audit"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 6v6l4 2m-4-10v2m0 12v2m10-10h-2M4 12H2"/></svg>}
                isLast
                desc="The Live Hub tracks network ROI in real-time. Use the 'Intel' tab to query Gemini AI for ranking data, revenue leaks, and performance forecasting. Perform weekly audits to ensure data consistency."
              />
            </>
          ) : (
            <>
              <StepItem 
                number="01" title="Opening Protocol"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>}
                desc="Click the 'Offline' status button daily to open the terminal. This initializes the registry, purges stale previous-day sessions, and enables the POS. Opening must be done at least 15 minutes before the first appointment."
              />
              <StepItem 
                number="02" title="Staff Duty Check"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                desc="Navigate to the 'Staff' tab. Personnel must clock in to be selectable in the POS. Note: Clock-in is restricted if the branch is still Offline. Ensure all staff are in proper uniform."
              />
              <StepItem 
                number="03" title="Registry Entry"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20m-5 5h.01M13 15h.01"/></svg>}
                desc="Record customer sessions immediately. Select service units, therapists, and support specialists. Apply Senior/PWD discounts before finalization. Double-check the total amount before accepting payment."
              />
              <StepItem 
                number="04" title="Disbursement Logs"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>}
                desc="Log daily R&B Provisions (Deposits) and Petty Cash outflows. All expenses REQUIRE a photo receipt to sync with the central mainframe audit. Incomplete logs will be flagged for investigation."
              />
              <StepItem 
                number="05" title="Ledger & Payroll"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M3 3v18h18m-15-5l4-4 4 4 6-6"/></svg>}
                isLast
                desc="Review the 'Sales' ledger for accuracy. Use the (+) icon in the 'Payroll' tab to log Cash Advances or verify OT for the current cycle. Closing reports must be submitted before the heartbeat."
              />
            </>
          )}
        </div>
      </div>

      {/* CRISIS PROTOCOL */}
      <div className="space-y-10">
        <div className="flex items-center gap-4 px-4">
          <div className="w-1.5 h-8 bg-rose-600 rounded-full shadow-[0_0_10px_#e11d48]"></div>
          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">2. Crisis & Security Protocol</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-rose-50 rounded-[32px] p-8 border border-rose-100 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-2xl border border-rose-100">📡</div>
              <h5 className="font-black text-slate-900 uppercase text-sm tracking-tight">Network Outage</h5>
            </div>
            <p className="text-slate-600 text-xs font-medium leading-relaxed">
              If the terminal loses internet connectivity, continue recording sessions on manual log sheets. Once connection is restored, backfill all data immediately using the 'Backfill' tab. Do not clear browser cache as local storage may hold unsynced data.
            </p>
          </div>
          <div className="bg-slate-900 rounded-[32px] p-8 space-y-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shadow-sm text-2xl border border-white/5">🔐</div>
              <h5 className="font-black uppercase text-sm tracking-tight">Credential Compromise</h5>
            </div>
            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              If a manager's PIN is suspected to be compromised, the SuperAdmin must trigger a 'Remote Force Logout' and 'PIN Reset' immediately from the Network Manager. All active sessions for that node will be terminated to prevent unauthorized access.
            </p>
          </div>
        </div>
      </div>

      {/* INTERFACE COMMAND REFERENCE */}
      <div className="space-y-10">
        <div className="flex items-center gap-4 px-4">
          <div className="w-1.5 h-8 bg-indigo-600 rounded-full shadow-[0_0_10px_#6366f1]"></div>
          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">3. Interface Card Reference</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardReference 
            icon="💆" title="Staff Status Card"
            action="Tap 'Time In' to start shift. Use the 'Payroll' tab (+) button to log OT/Late/Advances."
            validation="Clock-in is blocked if the branch is Offline. OT Pay is enabled only for sessions ending after closing time for non-late staff."
          />
          <CardReference 
            icon="🎫" title="POS Service Card"
            action="Click to select multiple units. Selected units sum price and duration."
            validation="Dual-Provider services (Specialist required) force the 'Specialist Selector' to open. Finalization blocked if lead or support is missing."
          />
          <CardReference 
            icon="🧾" title="Ledger Session Item"
            action="Tap 'Edit Record' in Corrections mode to modify client, price, or provider."
            validation="All modifications or deletions (Registry Scrubs) are logged in the Audit Trail with the manager's identity timestamped."
          />
          <CardReference 
            icon="🏦" title="Vault Activity Card"
            action="Record 'Deposits' to fund the pool or 'Settlements' for bill payments."
            validation="Settlements are BLOCKED if 'Amount > Pool Balance'. A mandatory receipt photo is required for all reserve pool outflows."
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-[#0F172A] p-10 md:p-14 rounded-[56px] text-center space-y-6 relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-rose-500"></div>
         <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto text-4xl mb-4">💡</div>
         <h3 className="text-2xl font-black text-white uppercase tracking-tight">Need Support?</h3>
         <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-lg mx-auto">
            Contact the SuperAdmin if a node fails to sync, if you suspect credential compromise, or if you need a specific Archive Record from more than 12 months ago.
         </p>
         <div className="pt-6">
            <span className="px-6 py-2 rounded-full border border-white/10 text-[9px] font-black text-white uppercase tracking-widest bg-white/5">HilotCore Network Security Verified</span>
         </div>
      </div>
    </div>
  );
};