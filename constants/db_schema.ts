/**
 * MAINFRAME DATABASE CONFIGURATION
 * Centralized tracking for all snake_case column names.
 */

export const DB_TABLES = {
  BRANCHES: 'branches',
  TRANSACTIONS: 'transactions',
  EXPENSES: 'expenses',
  EMPLOYEES: 'employees',
  ATTENDANCE: 'attendance',
  SHIFT_LOGS: 'shift_logs',
  SALES_REPORTS: 'sales_reports',
  AUDIT_LOGS: 'audit_logs',
  SYSTEM_CONFIG: 'system_config',
  PAYROLL: 'payroll',
  SERVICE_CATALOGS: 'service_catalogs',
  ATTENDANCE_LOGS: 'attendance_logs'
};

export const DB_COLUMNS = {
  // Common
  ID: 'id',
  BRANCH_ID: 'branch_id',
  TIMESTAMP: 'timestamp',
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
  NAME: 'name',

  // Branches
  PIN: 'pin',
  IS_PIN_CHANGED: 'is_pin_changed',
  IS_ENABLED: 'is_enabled',
  IS_OPEN: 'is_open',
  IS_OPEN_DATE: 'is_open_date',
  MANAGER: 'manager',
  TEMP_MANAGER: 'temp_manager',
  SERVICES: 'services',
  WEEKLY_CUTOFF: 'weekly_cutoff',
  CYCLE_START_DATE: 'cycle_start_date',
  DAILY_PROVISION_AMOUNT: 'daily_provision_amount',
  ENABLE_SHIFT_TRACKING: 'enable_shift_tracking',
  OPENING_TIME: 'opening_time',
  CLOSING_TIME: 'closing_time',

  // Transactions
  CLIENT_NAME: 'client_name',
  THERAPIST_NAME: 'therapist_name',
  THERAPIST_ID: 'therapist_id',
  BONESETTER_NAME: 'bonesetter_name',
  BONESETTER_ID: 'bonesetter_id',
  SERVICE_ID: 'service_id',
  SERVICE_NAME: 'service_name',
  BASE_PRICE: 'base_price',
  DISCOUNT: 'discount',
  VOUCHER_VALUE: 'voucher_value',
  PRIMARY_COMMISSION: 'primary_commission',
  SECONDARY_COMMISSION: 'secondary_commission',
  TOTAL: 'total',
  NOTE: 'note',
  PAYMENT_METHOD: 'payment_method',
  PAYMENT_STATUS: 'payment_status',
  PAYMONGO_LINK_ID: 'paymongo_link_id',

  // Expenses
  AMOUNT: 'amount',
  CATEGORY: 'category',
  RECEIPT_IMAGE: 'receipt_image',

  // Employees
  ROLE: 'role',
  ALLOWANCE: 'allowance',
  IS_ACTIVE: 'is_active',
  PROFILE: 'profile',
  USERNAME: 'username',
  LOGIN_PIN: 'login_pin',
  PIN_SALT: 'pin_salt',
  REQUEST_RESET: 'request_reset',
  BRANCH_ALLOWANCES: 'branch_allowances',
  FIRST_NAME: 'first_name',
  MIDDLE_NAME: 'middle_name',
  LAST_NAME: 'last_name',

  // Attendance & Shift
  STAFF_NAME: 'staff_name',
  EMPLOYEE_ID: 'employee_id',
  EMPLOYEE_NAME: 'employee_name',
  CLOCK_IN: 'clock_in',
  CLOCK_OUT: 'clock_out',
  STATUS: 'status',
  DATE_STR: 'date_str',
  DATE: 'date',
  LATE_DEDUCTION: 'late_deduction',
  OT_PAY: 'ot_pay',
  CASH_ADVANCE: 'cash_advance',

  // Service Catalogs
  BRANCH_IDS: 'branch_ids',

  // Audit Logs
  ACTIVITY_TYPE: 'activity_type',
  ENTITY_TYPE: 'entity_type',
  ENTITY_ID: 'entity_id',
  DESCRIPTION: 'description',
  PERFORMER_NAME: 'performer_name',

  // Sales Reports
  REPORT_DATE: 'report_date',
  SUBMITTED_AT: 'submitted_at',
  GROSS_SALES: 'gross_sales',
  TOTAL_STAFF_PAY: 'total_staff_pay',
  TOTAL_EXPENSES: 'total_expenses',
  TOTAL_VAULT_PROVISION: 'total_vault_provision',
  NET_ROI: 'net_roi',
  SESSION_DATA: 'session_data',
  STAFF_BREAKDOWN: 'staff_breakdown',
  EXPENSE_DATA: 'expense_data',
  VAULT_DATA: 'vault_data',

  // System Config
  KEY: 'key',
  VALUE: 'value',

  // Payroll
  SETTLEMENT: 'settlement',
  BRANCH: 'branch'
} as const;