
import React, { useState, useMemo } from 'react';
import { Branch, SalesReport } from '../../types';
import { ReportsMasterSection } from '../dashboard/sections/ReportsMasterSection';
import { playSound } from '../../lib/audio';
import { toDateStr } from '@/src/utils/reportUtils';

interface ArchiveHubProps {
  branches: Branch[];
  salesReports: SalesReport[];
  employees?: any[];
}

export const ArchiveHub: React.FC<ArchiveHubProps> = ({ branches, salesReports, employees = [] }) => {
  const consolidatedBranch = useMemo(() => ({
    id: 'all',
    name: 'NETWORK CONSOLIDATED',
    pin: '000000',
    isPinChanged: true,
    isEnabled: true,
    services: [],
    weeklyCutoff: 0,
    cycleStartDate: branches.length > 0 ? branches[0].cycleStartDate : toDateStr(new Date())
  } as Branch), [branches]);

  return (
      <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
        <ReportsMasterSection
            branch={consolidatedBranch}
            salesReports={salesReports}
            branches={branches}
            employees={employees}
            canEdit={true}
        />
      </div>
  );
};
