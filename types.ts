import { DB_COLUMNS } from './constants/db_schema';

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER'
}

export interface Terminology {
  branchHead: string;
  reliefManager: string;
  vault: string;
  branch: string;
  staff: string;
  service: string;
  expense: string;
  sales: string;
  inventory?: string;
  roles?: string;
  basePay?: string;
}

export type CommissionType = 'percentage' | 'fixed';
export type ProviderRole = 'THERAPIST' | 'BONESETTER' | 'MANAGER' | 'TRAINEE';

export interface Branch {
  id: string;
  name: string;
  pin: string;
  isPinChanged: boolean;
  isEnabled: boolean;
  isOpen: boolean;
  isOpenDate: string;
  manager?: string;
  tempManager?: string;
  services: Service[];
  weeklyCutoff: number;
  cycleStartDate: string;
  dailyProvisionAmount?: number;
  enableShiftTracking?: boolean;
  openingTime?: string;
  closingTime?: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  primaryRole?: ProviderRole;
  commissionType: CommissionType;
  commissionValue: number;
  isDualProvider?: boolean;
  secondaryCommissionType?: CommissionType;
  secondaryCommissionValue?: number;
  catalogId?: string;
  catalogName?: string;
}

export type ExpenseCategory = 'OPERATIONAL' | 'PROVISION' | 'SETTLEMENT';

export interface Expense {
  id: string;
  branchId: string;
  timestamp: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  receiptImage?: string;
}

export interface Transaction {
  id: string;
  branchId: string;
  timestamp: string;
  clientName: string;
  therapistName: string;
  therapistId?: string;
  bonesetterName?: string;
  bonesetterId?: string;
  serviceId: string;
  serviceName: string;
  basePrice: number;
  discount: number;
  voucherValue: number;
  primaryCommission: number;
  secondaryCommission?: number;
  deduction?: number;
  total: number;
  note?: string;
  paymentMethod?: 'CASH' | 'PAYMONGO';
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED';
  paymongoLinkId?: string;
}

export interface AttendanceLog {
  id: string;
  branchId: string;
  timestamp: string;
  staffName: string;
  status: 'LATE' | 'OT' | 'REGULAR';
  amount: number;
  cashAdvance: number;
}

export interface Attendance {
  id: string;
  branchId: string;
  employeeId: string;
  staffName: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  status: string;
  lateDeduction: number;
  otPay: number;
  cashAdvance: number;
  createdAt: string;
}

export interface ShiftLog {
  id: string;
  branchId: string;
  employeeId: string;
  employeeName: string;
  clockIn: string;
  clockOut?: string;
  dateStr: string;
}

export interface Employee {
  id: string;
  branchId: string;
  timestamp: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  username?: string;
  loginPin?: string;
  pinSalt?: string;
  requestReset?: boolean;
  role: string;
  allowance: number;
  salary?: number;
  isActive: boolean;
  profile?: string;
  branchAllowances?: Record<string, number>;
}

export interface SalesReport {
  id: string;
  branchId: string;
  reportDate: string;
  submittedAt: string;
  grossSales: number;
  totalStaffPay: number;
  totalExpenses: number;
  totalVaultProvision: number;
  netRoi: number;
  sortDate?: string;
  periodEnd?: string;
  sessionData: any[];
  staffBreakdown: any[];
  expenseData: any[];
  vaultData: any[];
  isFinalized?: boolean;
  finalizedAt?: string;
  finalizedBy?: string;
}

export interface AuditLog {
  id: string;
  branchId: string;
  timestamp: string;
  activityType: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'TRANSACTION' | 'EXPENSE' | 'ATTENDANCE' | 'EMPLOYEE';
  entityId: string;
  description: string;
  amount?: number;
  performerName?: string;
}

export interface AuthState {
  user: {
    role: UserRole;
    branchId?: string;
    employeeId?: string;
    username?: string;
    lastActive: number;
    loginPin?: string;
    sessionStart: number;
  } | null;
}