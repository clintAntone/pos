import React from 'react';
import { motion } from 'motion/react';
import { Transaction } from '../../../../types';

import { UI_THEME } from '../../../../constants/ui_designs';

interface SessionLogsProps {
  transactions: Transaction[];
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 }
};

export const SessionLogs: React.FC<SessionLogsProps> = ({ transactions }) => {
  return (
      <div className="space-y-4">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-4">Archived Session Log</h4>

        <div className={`bg-white ${UI_THEME.radius.card} border border-slate-100 shadow-sm overflow-hidden print:overflow-visible`}>
          <div className="overflow-x-auto no-scrollbar print:overflow-visible">
            <table className="w-full text-left text-[12px] min-w-[900px] print:min-w-0">
              <thead>
              <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b bg-slate-50/30">
                <th className="px-8 py-5">Time</th>
                <th className="px-8 py-5">Client</th>
                <th className="px-8 py-5">Service</th>
                <th className="px-8 py-5 text-right">Price</th>
                <th className="px-8 py-5 text-right">Total</th>
                <th className="px-8 py-5">Settlement</th>
                <th className="px-8 py-5">Provider(s)</th>
                <th className="px-8 py-5 text-right">ROI</th>
              </tr>
              </thead>
              <motion.tbody 
                variants={container}
                initial="hidden"
                animate="show"
                className="divide-y divide-slate-100"
              >
              {transactions.length > 0 ? transactions.map(t => {
                const totalDeduction = (Number(t.discount) || 0);
                const therapistComm = Number(t.primaryCommission) || 0;
                const bonesetterComm = Number(t.secondaryCommission) || 0;
                const sessionDeduction = Number(t.deduction) || 0;
                const netTotal = (Number(t.basePrice) - totalDeduction);
                const netRoi = (netTotal - therapistComm - bonesetterComm + sessionDeduction);
                
                const isPayMongo = t.paymentMethod === 'PAYMONGO';
                const isPaid = t.paymentStatus === 'PAID';

                return (
                    <motion.tr variants={item} key={t.id} className="hover:bg-slate-50/20 transition-colors group">
                      {/* TIME: Standardized to medium slate */}
                      <td className="px-8 py-5 font-medium text-slate-400 uppercase tracking-tighter tabular-nums text-[11px]">
                        {(() => {
                          // strip the UTC part so JS treats it as local
                          const date = new Date(t.timestamp.replace(/(\+00:00|Z)$/, ""));
                          return date.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          });
                        })()}
                      </td>

                      {/* CLIENT: Standardized to bold slate-900 */}
                      <td className="px-8 py-5 font-bold text-slate-600 text-[11px] uppercase tracking-tight">
                        {t.clientName}
                      </td>

                      {/* SERVICE: Standardized to medium slate-600 */}
                      <td className="px-8 py-5 font-bold text-slate-600 uppercase tracking-tight text-[11px] max-w-[200px] break-words leading-tight">
                        <div className="flex flex-col gap-1">
                          {t.serviceName.split('+').map((srv, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                <span>{srv.trim()}</span>
                              </div>
                          ))}
                        </div>
                      </td>

                      <td className="px-8 py-5 text-right tabular-nums text-[12px] whitespace-nowrap">
                        <span className="text-slate-900 font-semibold">₱{(Number(t.basePrice) || 0).toLocaleString()}</span>
                        {totalDeduction > 0 && (
                            <span className="text-rose-600 ml-1 text-[10px]">−₱{totalDeduction.toLocaleString()}</span>
                        )}
                      </td>

                      {/* TOTAL: Primary identifier style */}
                      <td className="px-8 py-5 font-bold text-slate-900 text-[13px] text-right tabular-nums tracking-tighter">
                        ₱{netTotal.toLocaleString()}
                      </td>

                      {/* SETTLEMENT: Payment Method and Status */}
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border leading-none uppercase ${isPayMongo ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                              {isPayMongo ? '📱 Digital' : '💵 Cash'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${isPaid ? 'text-emerald-500' : 'text-amber-500 animate-pulse'}`}>
                              {isPaid ? '● Verified' : '○ Pending'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* PROVIDERS: Standardized font weights and badges */}
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1.5">
                          {t.therapistName && t.therapistName.trim() && (
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md border border-emerald-100 leading-none uppercase shrink-0">T:</span>
                                <span className="text-[11px] px-1.5 py-0.5 leading-none uppercase">₱{therapistComm.toLocaleString()}</span>
                                <span className="font-bold text-slate-600 text-[11px] uppercase tracking-tight truncate max-w-[120px]">{t.therapistName}</span>
                              </div>
                          )}
                          {t.bonesetterName && t.bonesetterName.trim() && (
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md border border-indigo-100 leading-none uppercase shrink-0">B: </span>
                                <span className="text-[11px] px-1.5 py-0.5 leading-none uppercase">₱{bonesetterComm.toLocaleString()}</span>
                                <span className="font-bold text-slate-600 text-[11px] uppercase tracking-tight truncate max-w-[120px]">{t.bonesetterName}</span>
                              </div>
                          )}
                          {sessionDeduction > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md border border-rose-100 leading-none uppercase shrink-0">D: </span>
                                <span className="text-[11px] px-1.5 py-0.5 leading-none uppercase text-rose-600 font-bold">-₱{sessionDeduction.toLocaleString()}</span>
                              </div>
                          )}
                        </div>
                      </td>

                      {/* NET ROI: */}
                      <td className="px-8 py-5 font-bold text-slate-900 text-base text-right tabular-nums tracking-tighter">
                        ₱{netRoi.toLocaleString()}
                      </td>
                    </motion.tr>
                );
              }) : (
                  <tr>
                    <td colSpan={8} className="py-24 text-center font-bold text-slate-200 uppercase tracking-[0.4em]">
                      No transaction data recorded
                    </td>
                  </tr>
              )}
              </motion.tbody>
            </table>
          </div>
        </div>
      </div>
  );
};
