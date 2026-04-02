import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SalesReport, Expense, Branch } from '../../../../types';
import { UI_THEME } from '../../../../constants/ui_designs';
import { playSound } from '../../../../lib/audio';
import { toDateStr, getWeekRange, parseDate } from '@/src/utils/reportUtils';
import { PerformanceRow } from './PerformanceRow';
import { SalesKPIStrip } from '../sales-today/SalesKPIStrip';
import { SessionLogs } from '../sales-today/SessionLogs';
import { ExpenseDetailModal } from '../sales-today/ExpenseDetailModal';
import { ReportEditorModal } from '../../../superadmin/ReportEditorModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';

interface ReportDashboardModalProps {
  report: SalesReport;
  constituents?: SalesReport[];
  branchName: string;
  employees?: any[];
  onClose: () => void;
  canEdit?: boolean;
  branch?: Branch;
  branches?: Branch[];
}

export const ReportDashboardModal: React.FC<ReportDashboardModalProps> = ({ report, constituents = [], branchName, employees = [], onClose, canEdit, branch, branches = [] }) => {
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [drilldownReport, setDrilldownReport] = useState<SalesReport | null>(null);
  const [drilldownConstituents, setDrilldownConstituents] = useState<SalesReport[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPDFConfirm, setShowPDFConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

  const isAggregate = constituents.length > 0;

  const vaultWithdrawals = useMemo(() => (report.vaultData || []).filter((e: any) => e.category === 'SETTLEMENT'), [report.vaultData]);
  const vaultContributions = useMemo(() => (report.vaultData || []).filter((e: any) => e.category === 'PROVISION'), [report.vaultData]);
  const operationalExpenses = useMemo(() => (report.expenseData || []).filter((e: any) => e.category === 'OPERATIONAL'), [report.expenseData]);

  const displayDate = useMemo(() => {
    if (isAggregate) return report.reportDate;
    return parseDate(report.reportDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  }, [report.reportDate, isAggregate]);

  const payrollBreakdown = useMemo(() => {
    const breakdown = {
      allowances: 0,
      ot: 0,
      late: 0,
      advances: 0
    };

    (report.staffBreakdown || []).forEach((s: any) => {
      breakdown.allowances += Number(s.allowance || 0);
      breakdown.ot += Number(s.attendance?.otPay || s.attendance?.ot_pay || 0);
      breakdown.late += Number(s.attendance?.lateDeduction || s.attendance?.late_deduction || 0);
      breakdown.advances += Number(s.attendance?.cashAdvance || s.attendance?.cash_advance || 0);
    });

    return breakdown;
  }, [report.staffBreakdown]);

  const handleExportPDF = async (confirmed = false) => {
    if (!confirmed) {
      playSound('warning');
      setShowPDFConfirm(true);
      return;
    }

    setShowPDFConfirm(false);
    setIsExporting(true);
    playSound('click');

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // 1. Header
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text((branchName || '').toUpperCase(), 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-400
      doc.text(isAggregate ? 'CONSOLIDATED PERIOD REPORT' : 'DAILY OPERATIONAL LEDGER', 14, 26);

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(displayDate, pageWidth - 14, 20, { align: 'right' });

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Report ID: ${report.id.toUpperCase()}`, pageWidth - 14, 26, { align: 'right' });

      // 2. Financial Summary
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('FINANCIAL SUMMARY', 14, 40);

      autoTable(doc, {
        startY: 43,
        head: [['Metric', 'Amount']],
        body: [
          ['Gross Sales', `PHP ${Number(report.grossSales || 0).toLocaleString()}`],
          ['Operational Expenses', `PHP ${Number(report.totalExpenses || 0).toLocaleString()}`],
          ['Staff Payroll', `PHP ${Number(report.totalStaffPay || 0).toLocaleString()}`],
          ['Vault Reserve', `PHP ${Number(report.totalVaultProvision || 0).toLocaleString()}`],
          ['Net ROI', `PHP ${Number(report.netRoi || 0).toLocaleString()}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'right', fontStyle: 'bold' }
        },
        rowPageBreak: 'avoid'
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;

      if (isAggregate) {
        // 3. Constituent Units
        doc.setFontSize(11);
        doc.text('CONSTITUENT UNIT BREAKDOWN', 14, currentY);

        autoTable(doc, {
          startY: currentY + 3,
          head: [['Date', 'Gross', 'Payroll', 'Expenses', 'Vault', 'Net ROI']],
          body: constituents.sort((a,b) => (a.reportDate || '').localeCompare(b.reportDate || '')).map(sub => [
            new Date(sub.reportDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase(),
            `PHP ${sub.grossSales.toLocaleString()}`,
            `PHP ${sub.totalStaffPay.toLocaleString()}`,
            `PHP ${sub.totalExpenses.toLocaleString()}`,
            `PHP ${sub.totalVaultProvision.toLocaleString()}`,
            `PHP ${sub.netRoi.toLocaleString()}`
          ]),
          theme: 'grid',
          headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
          styles: { fontSize: 8 },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' }
          },
          rowPageBreak: 'avoid'
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // 4. Session Logs
      doc.setFontSize(11);
      doc.text('SESSION LOGS', 14, currentY);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Time', 'Client', 'Service', 'Total', 'Settlement', 'Providers', 'ROI']],
        body: (report.sessionData || []).map(t => {
          const therapistComm = Number(t.primaryCommission) || 0;
          const bonesetterComm = Number(t.secondaryCommission) || 0;
          const sessionDeduction = Number(t.deduction) || 0;
          const netTotal = (Number(t.basePrice) - (Number(t.discount) || 0));
          const netRoi = (netTotal - therapistComm - bonesetterComm + sessionDeduction);

          let providers = '';
          if (t.therapistName) providers += `T: ${t.therapistName} (P${therapistComm})`;
          if (t.bonesetterName) providers += `${providers ? '\n' : ''}B: ${t.bonesetterName} (P${bonesetterComm})`;

          const settlement = t.settlement
              ? t.settlement.toUpperCase()
              : `${t.paymentMethod || 'CASH'} (${t.paymentStatus || 'VERIFIED'})`;

          return [
            new Date(t.timestamp.replace(/(\+00:00|Z)$/, "")).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            (t.clientName || '').toUpperCase(),
            (t.serviceName || '').toUpperCase(),
            `PHP ${netTotal.toLocaleString()}`,
            settlement.toUpperCase(),
            providers,
            `PHP ${netRoi.toLocaleString()}`
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        styles: { fontSize: 7 },
        columnStyles: {
          3: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' }
        },
        rowPageBreak: 'avoid'
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Check for page overflow
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // 5. Staff Performance
      doc.setFontSize(11);
      doc.text('STAFF PERFORMANCE MATRIX', 14, currentY);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Employee', 'Sessions', 'Base Pay', 'Late', 'OT', 'Advance', 'Final Pay']],
        body: (report.staffBreakdown || []).map(s => {
          const late = Number(s.attendance?.lateDeduction || s.attendance?.late_deduction || 0);
          const ot = Number(s.attendance?.otPay || s.attendance?.ot_pay || 0);
          const adv = Number(s.attendance?.cashAdvance || s.attendance?.cash_advance || 0);
          const baseComm = Number(s.commission || 0);
          const baseAllw = Number(s.allowance || 0);
          const finalPay = baseComm + baseAllw + ot - late;
          const resolvedName = employees.find(e => e.id === s.employeeId)?.name || s.name || 'Unknown Staff';

          return [
            resolvedName.toUpperCase(),
            Number(s.count || 0),
            `PHP ${(baseComm + baseAllw).toLocaleString()}`,
            `-PHP ${late.toLocaleString()}`,
            `+PHP ${ot.toLocaleString()}`,
            `PHP ${adv.toLocaleString()}`,
            `PHP ${finalPay.toLocaleString()}`
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        styles: { fontSize: 8 },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' }
        },
        rowPageBreak: 'avoid'
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // 6. Vault & Expenses
      doc.setFontSize(11);
      doc.text('VAULT & OPERATIONAL OUTFLOWS', 14, currentY);

      const vaultBody = (report.vaultData || []).map(e => [
        (e.name || '').toUpperCase(),
        e.category === 'PROVISION' ? 'VAULT CONTRIBUTION' : 'VAULT WITHDRAWAL',
        `${e.category === 'PROVISION' ? '+' : '-'}PHP ${Number(e.amount || 0).toLocaleString()}`
      ]);

      const expenseBody = (report.expenseData || []).map(e => [
        (e.name || '').toUpperCase(),
        'OPERATIONAL EXPENSE',
        `-PHP ${Number(e.amount || 0).toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Item', 'Category', 'Amount']],
        body: [...vaultBody, ...expenseBody],
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        styles: { fontSize: 8 },
        columnStyles: {
          2: { halign: 'right', fontStyle: 'bold' }
        },
        rowPageBreak: 'avoid'
      });

      doc.save(`REPORT_${branchName.replace(/\s+/g, '_')}_${report.reportDate.replace(/\s+/g, '_')}.pdf`);
      playSound('success');
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('Failed to generate PDF. Please try using the Print button.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isEditing && branch) {
    return (
        <ReportEditorModal
            report={report}
            branch={branch}
            employees={employees}
            onClose={() => setIsEditing(false)}
            onSave={() => {
              setIsEditing(false);
              onClose(); // Close the dashboard modal to force a refresh of the parent
            }}
        />
    );
  }

  if (drilldownReport) {
    return <ReportDashboardModal
        report={drilldownReport}
        constituents={drilldownConstituents}
        branchName={branchName}
        employees={employees}
        onClose={() => {
          setDrilldownReport(null);
          setDrilldownConstituents([]);
        }}
        canEdit={canEdit}
        branch={branch}
    />;
  }

  if (!mounted) return null;

  return createPortal(
      <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300 print:static print:bg-white print:p-0">
        <div className={`bg-slate-50 w-full max-w-7xl h-[95vh] md:max-h-[92vh] ${UI_THEME.radius.modal} shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in duration-300 print:h-auto print:max-h-none print:max-w-none print:shadow-none print:bg-white print:overflow-visible print:block`}>

          {viewingExpense && (
              <ExpenseDetailModal expense={viewingExpense} onClose={() => setViewingExpense(null)} />
          )}

          {showPDFConfirm && (
              <div className={UI_THEME.layout.modalWrapper}>
                <div className={`${UI_THEME.layout.modalStandard} ${UI_THEME.radius.modal} p-10 text-center border border-slate-100`}>
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2-0 01-2-2V5a2 2-0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2-0 01-2 2z" /></svg>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Export to PDF?</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                    Generate and download the report for {branchName}?
                  </p>
                  <div className="flex flex-col gap-4 mt-10">
                    <button
                        onClick={() => handleExportPDF(true)}
                        className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      Confirm Export
                    </button>
                    <button
                        onClick={() => setShowPDFConfirm(false)}
                        className="w-full text-slate-400 font-black py-4 rounded-xl text-[12px] uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
          )}

          {/* Print Only Header */}
          <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-8">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{branchName}</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
                  {isAggregate ? 'Consolidated Period Report' : 'Daily Operational Ledger'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold uppercase tracking-tight text-slate-900">{displayDate}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Report ID: {report.id.toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* HEADER BAR */}
          <div className="p-5 md:p-8 bg-white border-b border-slate-100 flex justify-between items-center shrink-0 gap-3 no-print">
            <div className="flex items-center gap-3 md:gap-5 min-w-0">
              <div className={`w-10 h-10 md:w-12 md:h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shrink-0`}>
                {isAggregate ? '📊' : '📂'}
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] sm:text-lg md:text-xl font-bold uppercase tracking-tighter text-slate-900 leading-tight truncate mb-0.5">{displayDate}</h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-emerald-600 whitespace-nowrap">{branchName} Node</span>
                  <span className="text-slate-200 hidden sm:inline">/</span>
                  <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 opacity-40 whitespace-nowrap">
                    {isAggregate ? `${constituents.length} PERIOD UNITS` : `ID: ${report.id.slice(-8).toUpperCase()}`}
                 </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 no-print">
              <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className={`p-2.5 md:p-3 bg-white text-slate-900 rounded-xl md:rounded-2xl hover:bg-emerald-600 hover:text-white active:scale-90 transition-all border border-slate-200 shadow-sm flex items-center gap-2 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isExporting ? (
                    <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2-0 01-2-2V5a2 2-0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2-0 01-2 2z" /></svg>
                )}
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{isExporting ? 'Exporting...' : 'Save PDF'}</span>
              </button>

              {canEdit && !isAggregate && (
                  <button
                      onClick={() => { playSound('click'); setIsEditing(true); }}
                      className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    <span className="hidden sm:inline">Update Report</span>
                  </button>
              )}
              <button onClick={onClose} className="p-2.5 md:p-3 bg-slate-50 rounded-xl md:rounded-2xl text-slate-400 hover:text-slate-900 active:scale-90 transition-all border border-slate-100 shadow-sm">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* DASHBOARD CONTENT */}
          <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-12 no-scrollbar pb-32 print:hidden">

            <SalesKPIStrip
                gross={Number(report.grossSales || 0)}
                operationalExp={Number(report.totalExpenses || 0)}
                finalStaffPayTotal={Number(report.totalStaffPay || 0)}
                provisionExp={Number(report.totalVaultProvision || 0)}
                net={Number(report.netRoi || 0)}
                totalAllowances={payrollBreakdown.allowances}
                otAdditions={payrollBreakdown.ot}
                lateDeductions={payrollBreakdown.late}
                totalCashAdvances={payrollBreakdown.advances}
            />

            {isAggregate ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-4">
                    <h4 className={`${UI_THEME.text.label}`}>Constituent Unit Breakdown</h4>
                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Tabular Ledger View</span>
                  </div>

                  <div className="overflow-hidden bg-white md:rounded-[32px] md:border border-slate-100 shadow-sm p-4 md:p-0">
                    <div className="hidden md:block overflow-x-auto no-scrollbar">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Period / Unit</th>
                          <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Gross Yield</th>
                          <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Staff Payroll</th>
                          <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Operational Exp</th>
                          <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Vault Reserve</th>
                          <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Net ROI</th>
                          <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Action</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                        {/* We will render the same rows but as table rows here */}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col">
                      {(() => {
                        if (report.reportType === 'monthly') {
                          const weeklyGroups: Record<string, {
                            label: string;
                            weekStart: Date;
                            weekEnd: Date;
                            constituents: SalesReport[];
                          }> = {};

                          constituents.forEach(c => {
                            const d = parseDate(c.reportDate);
                            const { weekIndex, weekStart, weekEnd } = getWeekRange(d, branch!);
                            const key = `W${weekIndex}-${weekStart.getMonth() + 1}-${weekStart.getFullYear()}`;

                            if (!weeklyGroups[key]) {
                              weeklyGroups[key] = {
                                label: `WEEK ${weekIndex}`,
                                weekStart,
                                weekEnd,
                                constituents: []
                              };
                            }
                            weeklyGroups[key].constituents.push(c);
                          });

                          const sortedWeekKeys = Object.keys(weeklyGroups).sort((a, b) => {
                            return weeklyGroups[a].weekStart.getTime() - weeklyGroups[b].weekStart.getTime();
                          });

                          return sortedWeekKeys.map((key) => {
                            const group = weeklyGroups[key];
                            const weekGross = group.constituents.reduce((sum, r) => sum + r.grossSales, 0);
                            const weekPayroll = group.constituents.reduce((sum, r) => sum + r.totalStaffPay, 0);
                            const weekExp = group.constituents.reduce((sum, r) => sum + r.totalExpenses, 0);
                            const weekVault = group.constituents.reduce((sum, r) => sum + r.totalVaultProvision, 0);
                            const weekRoi = group.constituents.reduce((sum, r) => sum + r.netRoi, 0);
                            const dateRangeLabel = `${group.weekStart.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} — ${group.weekEnd.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;

                            return (
                                <PerformanceRow
                                    key={key}
                                    label={group.label}
                                    sublabel={dateRangeLabel}
                                    branchName={branchName}
                                    gross={weekGross}
                                    pay={weekPayroll}
                                    exp={weekExp}
                                    vault={weekVault}
                                    net={weekRoi}
                                    onClick={() => {
                                      playSound('click');
                                      setDrilldownReport({
                                        ...report,
                                        id: `${report.id}-${key}`,
                                        reportDate: `${group.label}: ${dateRangeLabel}`,
                                        reportType: 'weekly',
                                        sortDate: toDateStr(group.weekStart),
                                        periodEnd: toDateStr(group.weekEnd),
                                        grossSales: weekGross,
                                        totalStaffPay: weekPayroll,
                                        totalExpenses: weekExp,
                                        totalVaultProvision: weekVault,
                                        netRoi: weekRoi
                                      });
                                      setDrilldownConstituents(group.constituents);
                                    }}
                                />
                            );
                          });
                        }

                        // Default logic for Weekly or other aggregate reports
                        const dailyGroups: Record<string, { report: SalesReport; constituents: SalesReport[] }> = {};
                        constituents.forEach(c => {
                          if (!dailyGroups[c.reportDate]) {
                            dailyGroups[c.reportDate] = {
                              report: { ...c },
                              constituents: [c]
                            };
                          } else {
                            const target = dailyGroups[c.reportDate].report;
                            target.grossSales += c.grossSales;
                            target.totalStaffPay += c.totalStaffPay;
                            target.totalExpenses += c.totalExpenses;
                            target.totalVaultProvision += c.totalVaultProvision;
                            target.netRoi += c.netRoi;
                            dailyGroups[c.reportDate].constituents.push(c);
                          }
                        });

                        let allDates: { date: string; group?: { report: SalesReport; constituents: SalesReport[] } }[] = [];
                        if (report.sortDate && report.periodEnd) {
                          const start = parseDate(report.sortDate);
                          const end = parseDate(report.periodEnd);
                          const current = new Date(start);
                          while (current <= end) {
                            const dateStr = toDateStr(current);
                            const existing = dailyGroups[dateStr];
                            allDates.push({ date: dateStr, group: existing });
                            current.setDate(current.getDate() + 1);
                          }
                        } else {
                          allDates = Object.keys(dailyGroups)
                              .sort((a, b) => (a || '').localeCompare(b || ''))
                              .map(date => ({ date, group: dailyGroups[date] }));
                        }

                        return allDates.map(({ date, group }) => {
                          const d = parseDate(date);
                          const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

                          if (!group) {
                            return (
                                <PerformanceRow
                                    key={date}
                                    label={label}
                                    sublabel="MISSING REPORT"
                                    branchName={branchName}
                                    gross={0}
                                    pay={0}
                                    exp={0}
                                    vault={0}
                                    net={0}
                                    isMissing={true}
                                    onClick={() => {}}
                                />
                            );
                          }

                          const sub = group.report;
                          const isConsolidatedDay = group.constituents.length > 1;

                          return (
                              <PerformanceRow
                                  key={sub.id}
                                  label={label}
                                  sublabel={isConsolidatedDay ? `${group.constituents.length} TERMINALS CONSOLIDATED` : `TRACE: ${sub.id.slice(-8).toUpperCase()}`}
                                  branchName={isConsolidatedDay ? "NETWORK CONSOLIDATED" : (branches.find(b => b.id === sub.branchId)?.name || branchName)}
                                  gross={sub.grossSales}
                                  pay={sub.totalStaffPay}
                                  exp={sub.totalExpenses}
                                  vault={sub.totalVaultProvision}
                                  net={sub.netRoi}
                                  onClick={() => {
                                    playSound('click');
                                    setDrilldownReport(sub);
                                    setDrilldownConstituents(isConsolidatedDay ? group.constituents : []);
                                  }}
                              />
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
            ) : (
                <>
                  <SessionLogs transactions={report.sessionData || []} />

                  <div className="space-y-4">
                    <h4 className={`${UI_THEME.text.label} ml-4`}>Staff Performance Matrix</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(report.staffBreakdown || []).map((s: any) => {
                        const late = Number(s.attendance?.lateDeduction || s.attendance?.late_deduction || 0);
                        const ot = Number(s.attendance?.otPay || s.attendance?.ot_pay || 0);
                        const adv = Number(s.attendance?.cashAdvance || s.attendance?.cash_advance || 0);
                        const baseComm = Number(s.commission || 0);
                        const baseAllw = Number(s.allowance || 0);
                        const finalPay = baseComm + baseAllw + ot - late;

                        // Resolve name from employeeId if possible
                        const resolvedName = employees.find(e => e.id === s.employeeId)?.name || s.name || 'Unknown Staff';

                        return (
                            <div key={s.employeeId || s.name} className={`bg-white p-5 ${UI_THEME.radius.card} border border-slate-100 flex flex-col gap-4 shadow-sm hover:border-emerald-500 transition-all group`}>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 shrink-0 shadow-inner">💆</div>
                                  <div className="overflow-hidden">
                                    <p className="text-[13px] font-bold text-slate-900 uppercase truncate mb-0.5">{resolvedName}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{Number(s.count || 0)} Sessions</p>
                                  </div>
                                </div>
                                <p className="text-lg font-bold text-emerald-700 tracking-tighter tabular-nums">₱{finalPay.toLocaleString()}</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5 border-t border-slate-50 pt-4">
                                {late > 0 && <span className="text-[8px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 uppercase">LATE: -₱{late}</span>}
                                {ot > 0 && <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 uppercase">OT: +₱{ot}</span>}
                                <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 uppercase">ALLW: +₱{baseAllw}</span>
                                {adv > 0 && <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-md uppercase">ADV: {adv}</span>}
                              </div>
                            </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-4">
                      <h4 className={`${UI_THEME.text.label} ml-4`}>Vault Archive</h4>
                      <div className="space-y-3">
                        {vaultContributions.map((e: any) => (
                            <div
                                key={e.id}
                                onClick={() => { playSound('click'); setViewingExpense(e); }}
                                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-500 transition-all cursor-pointer group flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors`}>
                                  ↓
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-[11px] font-bold text-slate-900 uppercase truncate leading-none mb-1.5">{e.name}</p>
                                  <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest tabular-nums">
                                    {(() => {
                                      // Treat the timestamp as Philippine time
                                      const date = new Date(e.timestamp.replace(/(\+00:00|Z)$/, ""));
                                      return date.toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: undefined, // remove if you don't want seconds
                                        hour12: true
                                      });
                                    })()}
                                  </p>
                                </div>
                              </div>
                              <p className={`text-sm font-bold tabular-nums text-emerald-700`}>
                                +₱{Number(e.amount || 0).toLocaleString()}
                              </p>
                            </div>
                        ))}
                        {vaultWithdrawals.map((e: any) => (
                            <div
                                key={e.id}
                                onClick={() => { playSound('click'); setViewingExpense(e); }}
                                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-500 transition-all cursor-pointer group flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-rose-50 text-rose-500 group-hover:bg-rose-600 group-hover:text-white transition-colors`}>
                                  ↑
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-[11px] font-bold text-slate-900 uppercase truncate leading-none mb-1.5">{e.name}</p>
                                  <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest tabular-nums">
                                    {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                              <p className={`text-sm font-bold tabular-nums text-rose-600`}>
                                +₱{Number(e.amount || 0).toLocaleString()}
                              </p>
                            </div>
                        ))}
                        {(!report.vaultData || report.vaultData.length === 0) && (
                            <div className="py-12 text-center bg-white border-2 border-dashed border-slate-100 rounded-3xl opacity-20"><p className={UI_THEME.text.metadata}>Empty Archive</p></div>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-8 space-y-4">
                      <h4 className={`${UI_THEME.text.label} ml-4`}>Operational Outflows</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {operationalExpenses.map((e: any) => (
                            <div
                                key={e.id}
                                onClick={() => { playSound('click'); setViewingExpense(e); }}
                                className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-9 h-9 bg-slate-50 text-slate-300 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">🧾</div>
                                <div className="overflow-hidden">
                                  <p className="text-[11px] font-bold text-slate-900 uppercase truncate leading-none mb-1">{e.name}</p>
                                  <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest tabular-nums">
                                    {(() => {
                                      // Treat the timestamp as Philippine time
                                      const date = new Date(e.timestamp.replace(/(\+00:00|Z)$/, ""));
                                      return date.toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: undefined, // remove if you don't want seconds
                                        hour12: true
                                      });
                                    })()}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm font-bold text-rose-600 tabular-nums">₱{Number(e.amount || 0).toLocaleString()}</p>
                            </div>
                        ))}
                        {(!report.expenseData || report.expenseData.length === 0) && (
                            <div className="col-span-full py-12 text-center bg-white border-2 border-dashed border-slate-100 rounded-3xl opacity-20"><p className={UI_THEME.text.metadata}>No Outflows Logged</p></div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
            )}

          </div>

          {/* PRINT ONLY TABLE VIEW */}
          <div ref={printRef} className="hidden print:block p-8 space-y-8 print-container overflow-visible h-auto">
            {/* KPI SUMMARY TABLE */}
            <div className="space-y-2 break-inside-avoid">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Financial Summary</h4>
              <table className="w-full border-collapse border border-slate-200 text-[11px]">
                <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-4 py-2 text-left uppercase tracking-widest">Metric</th>
                  <th className="border border-slate-200 px-4 py-2 text-right uppercase tracking-widest">Amount</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                  <td className="border border-slate-200 px-4 py-2 font-bold uppercase">Gross Sales</td>
                  <td className="border border-slate-200 px-4 py-2 text-right font-bold tabular-nums">₱{Number(report.grossSales || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-4 py-2 font-bold uppercase text-rose-600">Operational Expenses</td>
                  <td className="border border-slate-200 px-4 py-2 text-right font-bold tabular-nums text-rose-600">₱{Number(report.totalExpenses || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-4 py-2 font-bold uppercase text-amber-600">Staff Payroll</td>
                  <td className="border border-slate-200 px-4 py-2 text-right font-bold tabular-nums text-amber-600">₱{Number(report.totalStaffPay || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-4 py-2 font-bold uppercase text-indigo-600">R&B Reserve</td>
                  <td className="border border-slate-200 px-4 py-2 text-right font-bold tabular-nums text-indigo-600">₱{Number(report.totalVaultProvision || 0).toLocaleString()}</td>
                </tr>
                <tr className="bg-slate-900 text-white">
                  <td className="border border-slate-900 px-4 py-2 font-black uppercase tracking-widest">Net ROI</td>
                  <td className="border border-slate-900 px-4 py-2 text-right font-black tabular-nums">₱{Number(report.netRoi || 0).toLocaleString()}</td>
                </tr>
                </tbody>
              </table>
            </div>

            {isAggregate && (
                <div className="space-y-2 break-inside-avoid">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Constituent Unit Breakdown</h4>
                  <table className="w-full border-collapse border border-slate-200 text-[10px]">
                    <thead>
                    <tr className="bg-slate-50 font-bold uppercase tracking-widest">
                      <th className="border border-slate-200 px-3 py-2 text-left">Date</th>
                      <th className="border border-slate-200 px-3 py-2 text-right">Gross</th>
                      <th className="border border-slate-200 px-3 py-2 text-right">Payroll</th>
                      <th className="border border-slate-200 px-3 py-2 text-right">Expenses</th>
                      <th className="border border-slate-200 px-3 py-2 text-right">Vault</th>
                      <th className="border border-slate-200 px-3 py-2 text-right">Net ROI</th>
                    </tr>
                    </thead>
                    <tbody>
                    {constituents.sort((a,b) => (a.reportDate || '').localeCompare(b.reportDate || '')).map((sub) => (
                        <tr key={sub.id} className="break-inside-avoid">
                          <td className="border border-slate-200 px-3 py-2 font-bold uppercase">
                            {new Date(sub.reportDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}
                          </td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">₱{sub.grossSales.toLocaleString()}</td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">₱{sub.totalStaffPay.toLocaleString()}</td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">₱{sub.totalExpenses.toLocaleString()}</td>
                          <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">₱{sub.totalVaultProvision.toLocaleString()}</td>
                          <td className="border border-slate-200 px-3 py-2 text-right font-bold tabular-nums">₱{sub.netRoi.toLocaleString()}</td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
            )}

            <div className="space-y-2 break-inside-avoid">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Session Logs</h4>
              <table className="w-full border-collapse border border-slate-200 text-[9px]">
                <thead>
                <tr className="bg-slate-50 font-bold uppercase tracking-widest">
                  <th className="border border-slate-200 px-2 py-1.5 text-left">Time</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-left">Client</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-left">Service</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-right">Total</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-center">Settlement</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-left">Providers</th>
                  <th className="border border-slate-200 px-2 py-1.5 text-right">ROI</th>
                </tr>
                </thead>
                <tbody>
                {(report.sessionData || []).map((t: any) => {
                  const therapistComm = Number(t.primaryCommission) || 0;
                  const bonesetterComm = Number(t.secondaryCommission) || 0;
                  const sessionDeduction = Number(t.deduction) || 0;
                  const netTotal = (Number(t.basePrice) - (Number(t.discount) || 0));
                  const netRoi = (netTotal - therapistComm - bonesetterComm + sessionDeduction);
                  return (
                      <tr key={t.id} className="break-inside-avoid">
                        <td className="border border-slate-200 px-2 py-1.5 tabular-nums">
                          {new Date(t.timestamp.replace(/(\+00:00|Z)$/, "")).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 font-bold uppercase">{t.clientName}</td>
                        <td className="border border-slate-200 px-2 py-1.5 uppercase leading-tight">{t.serviceName}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">₱{netTotal.toLocaleString()}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center">
                          <div className="font-bold uppercase">{t.settlement || t.paymentMethod || 'CASH'}</div>
                          {!t.settlement && <div className="text-[7px] text-slate-400">{t.paymentStatus || 'VERIFIED'}</div>}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 uppercase text-[8px]">
                          {t.therapistName && <div>T: {t.therapistName} (₱{therapistComm})</div>}
                          {t.bonesetterName && <div>B: {t.bonesetterName} (₱{bonesetterComm})</div>}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right font-bold tabular-nums">₱{netRoi.toLocaleString()}</td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 break-inside-avoid">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Staff Performance Matrix</h4>
              <table className="w-full border-collapse border border-slate-200 text-[10px]">
                <thead>
                <tr className="bg-slate-50 font-bold uppercase tracking-widest">
                  <th className="border border-slate-200 px-3 py-2 text-left">Employee</th>
                  <th className="border border-slate-200 px-3 py-2 text-center">Sessions</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Base Pay</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Late</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">OT</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Advance</th>
                  <th className="border border-slate-200 px-3 py-2 text-right font-black">Final Pay</th>
                </tr>
                </thead>
                <tbody>
                {(report.staffBreakdown || []).map((s: any) => {
                  const late = Number(s.attendance?.lateDeduction || s.attendance?.late_deduction || 0);
                  const ot = Number(s.attendance?.otPay || s.attendance?.ot_pay || 0);
                  const adv = Number(s.attendance?.cashAdvance || s.attendance?.cash_advance || 0);
                  const baseComm = Number(s.commission || 0);
                  const baseAllw = Number(s.allowance || 0);
                  const finalPay = baseComm + baseAllw + ot - late;
                  const resolvedName = employees.find(e => e.id === s.employeeId)?.name || s.name || 'Unknown Staff';
                  return (
                      <tr key={s.employeeId || s.name} className="break-inside-avoid">
                        <td className="border border-slate-200 px-3 py-2 font-bold uppercase">{resolvedName}</td>
                        <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">{Number(s.count || 0)}</td>
                        <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">₱{(baseComm + baseAllw).toLocaleString()}</td>
                        <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-rose-600">-₱{late.toLocaleString()}</td>
                        <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-emerald-600">+₱{ot.toLocaleString()}</td>
                        <td className="border border-slate-200 px-3 py-2 text-right tabular-nums text-indigo-600">₱{adv.toLocaleString()}</td>
                        <td className="border border-slate-200 px-3 py-2 text-right font-black tabular-nums">₱{finalPay.toLocaleString()}</td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-8 break-inside-avoid">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vault Archive</h4>
                <table className="w-full border-collapse border border-slate-200 text-[9px]">
                  <thead>
                  <tr className="bg-slate-50 font-bold uppercase tracking-widest">
                    <th className="border border-slate-200 px-2 py-1.5 text-left">Item</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-right">Amount</th>
                  </tr>
                  </thead>
                  <tbody>
                  {(report.vaultData || []).map((e: any) => (
                      <tr key={e.id} className="break-inside-avoid">
                        <td className="border border-slate-200 px-2 py-1.5">
                          <div className="font-bold uppercase">{e.name}</div>
                          <div className="text-[7px] text-slate-400 uppercase tracking-widest">{e.category}</div>
                        </td>
                        <td className={`border border-slate-200 px-2 py-1.5 text-right font-bold tabular-nums ${e.category === 'PROVISION' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {e.category === 'PROVISION' ? '+' : '-'}₱{Number(e.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Operational Outflows</h4>
                <table className="w-full border-collapse border border-slate-200 text-[9px]">
                  <thead>
                  <tr className="bg-slate-50 font-bold uppercase tracking-widest">
                    <th className="border border-slate-200 px-2 py-1.5 text-left">Expense</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-right">Amount</th>
                  </tr>
                  </thead>
                  <tbody>
                  {(report.expenseData || []).map((e: any) => (
                      <tr key={e.id} className="break-inside-avoid">
                        <td className="border border-slate-200 px-2 py-1.5 font-bold uppercase">{e.name}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-right font-bold tabular-nums text-rose-600">₱{Number(e.amount || 0).toLocaleString()}</td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="p-6 md:p-8 bg-slate-900 text-white flex justify-end items-center shrink-0 no-print">
            <div className="text-center sm:text-right">
              <p className="text-[9px] font-bold uppercase animate-pulse tracking-[0.3em] text-emerald-500/60 mb-1">Finalized Ledger ROI</p>
              <p className={`font-bold uppercase tracking-widest text-emerald-400 tabular-nums leading-none ${
                  (report.netRoi || 0).toLocaleString().length > 10 ? 'text-sm sm:text-base' :
                      (report.netRoi || 0).toLocaleString().length > 7 ? 'text-base sm:text-lg' :
                          'text-xl sm:text-2xl'
              }`}>
                Total Net Yield: ₱{Number(report.netRoi || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>,
      document.body
  );
};