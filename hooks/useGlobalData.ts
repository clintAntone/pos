import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Branch, Transaction, Expense, Employee, SalesReport, AuditLog, ShiftLog, Attendance, AuthState, UserRole, Terminology } from '../types';
import { APP_NAME } from '../constants';
import { DB_TABLES, DB_COLUMNS } from '../constants/db_schema';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/audio';

const OFFLINE_QUEUE_KEY = 'hilot_core_pending_sync_v1';

export const useGlobalData = (auth: AuthState) => {
    const queryClient = useQueryClient();
    const [systemLogo, setSystemLogo] = useState<string | null>(null);
    const [systemVersion, setSystemVersion] = useState<string | null>(null);
    const [dynamicAppName, setDynamicAppName] = useState<string>(APP_NAME);
    const [autoRefreshTime, setAutoRefreshTime] = useState<string>('00:00');
    const [fontFamily, setFontFamily] = useState<string>('Outfit');
    const [isPaymongoEnabled, setIsPaymongoEnabled] = useState<boolean>(false);
    const [globalSync, setGlobalSync] = useState(false);
    const [connStatus, setConnStatus] = useState<'connecting' | 'connected' | 'error' | 'offline'>('connecting');
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [forceLogoutRegistry, setForceLogoutRegistry] = useState<Record<string, number>>({});
    const [terminology, setTerminology] = useState<Terminology>({
        branchHead: 'Branch Manager',
        reliefManager: 'Relief Manager',
        vault: 'Vault',
        branch: 'Branch',
        staff: 'Staff',
        service: 'Service',
        expense: 'Expense',
        sales: 'Sales'
    });

    const isSyncingQueue = useRef(false);

    // OFFLINE SYNC ENGINE
    const flushOfflineQueue = useCallback(async () => {
        if (isSyncingQueue.current || !navigator.onLine) {
            const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
            if (saved) {
                try { setPendingSyncCount(JSON.parse(saved).length); } catch { setPendingSyncCount(0); }
            } else {
                setPendingSyncCount(0);
            }
            return;
        }

        const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (!saved) {
            setPendingSyncCount(0);
            return;
        }

        try {
            const queue: { table: string; data: any; audit?: any }[] = JSON.parse(saved);
            if (queue.length === 0) {
                setPendingSyncCount(0);
                return;
            }

            isSyncingQueue.current = true;
            setGlobalSync(true);
            console.log(`📡 HilotCore: Relaying ${queue.length} cached items to mainframe...`);

            const remainingQueue = [...queue];
            const processedIndices: number[] = [];

            for (let i = 0; i < remainingQueue.length; i++) {
                const item = remainingQueue[i];
                try {
                    const conflictTarget = item.table === DB_TABLES.SYSTEM_CONFIG ? 'key' : 'id';
                    const { error } = await supabase.from(item.table).upsert(item.data, { onConflict: conflictTarget });

                    if (!error) {
                        if (item.audit) await supabase.from(DB_TABLES.AUDIT_LOGS).insert(item.audit);
                        processedIndices.push(i);
                    }
                } catch (e) {
                    console.error("Sync partial failure for item", i, e);
                }
            }

            const newQueue = remainingQueue.filter((_, idx) => !processedIndices.includes(idx));
            if (newQueue.length === 0) {
                localStorage.removeItem(OFFLINE_QUEUE_KEY);
                setPendingSyncCount(0);
                playSound('success');
            } else {
                localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
                setPendingSyncCount(newQueue.length);
            }
        } catch (err) {
            console.error("Critical Sync Engine Failure:", err);
        } finally {
            isSyncingQueue.current = false;
            setGlobalSync(false);
        }
    }, []);

    const mapDbBranch = (db: any): Branch => {
        let services = [];
        try {
            services = typeof db[DB_COLUMNS.SERVICES] === 'string'
                ? JSON.parse(db[DB_COLUMNS.SERVICES])
                : (db[DB_COLUMNS.SERVICES] || []);
            if (!Array.isArray(services)) services = [];
        } catch (e) {
            console.error("Failed to parse services for branch", db[DB_COLUMNS.ID], e);
            services = [];
        }

        return {
            id: db[DB_COLUMNS.ID],
            name: db[DB_COLUMNS.NAME],
            pin: db[DB_COLUMNS.PIN],
            isPinChanged: Boolean(db[DB_COLUMNS.IS_PIN_CHANGED]),
            isEnabled: Boolean(db[DB_COLUMNS.IS_ENABLED]),
            isOpen: Boolean(db[DB_COLUMNS.IS_OPEN]),
            isOpenDate: db[DB_COLUMNS.IS_OPEN_DATE] ?? '',
            manager: db[DB_COLUMNS.MANAGER] || '',
            tempManager: db[DB_COLUMNS.TEMP_MANAGER] || '',
            services,
            weeklyCutoff: Number(db[DB_COLUMNS.WEEKLY_CUTOFF] ?? 0),
            cycleStartDate: db[DB_COLUMNS.CYCLE_START_DATE] ?? '',
            dailyProvisionAmount: Number(db[DB_COLUMNS.DAILY_PROVISION_AMOUNT] ?? 800),
            enableShiftTracking: Boolean(db[DB_COLUMNS.ENABLE_SHIFT_TRACKING]),
            openingTime: db[DB_COLUMNS.OPENING_TIME] ?? '09:00',
            closingTime: db[DB_COLUMNS.CLOSING_TIME] ?? '22:00'
        };
    };

    const mapDbEmployee = (db: any): Employee => {
        let branchAllowances = {};
        try {
            branchAllowances = typeof db[DB_COLUMNS.BRANCH_ALLOWANCES] === 'string'
                ? JSON.parse(db[DB_COLUMNS.BRANCH_ALLOWANCES])
                : (db[DB_COLUMNS.BRANCH_ALLOWANCES] || {});
            if (typeof branchAllowances !== 'object' || branchAllowances === null) branchAllowances = {};
        } catch (e) {
            console.error("Failed to parse branchAllowances for employee", db[DB_COLUMNS.ID], e);
            branchAllowances = {};
        }

        return {
            id: db[DB_COLUMNS.ID],
            branchId: db[DB_COLUMNS.BRANCH_ID],
            name: db[DB_COLUMNS.NAME],
            firstName: db[DB_COLUMNS.FIRST_NAME],
            middleName: db[DB_COLUMNS.MIDDLE_NAME],
            lastName: db[DB_COLUMNS.LAST_NAME],
            username: db[DB_COLUMNS.USERNAME],
            loginPin: db[DB_COLUMNS.LOGIN_PIN],
            pinSalt: db[DB_COLUMNS.PIN_SALT],
            requestReset: Boolean(db[DB_COLUMNS.REQUEST_RESET]),
            role: db[DB_COLUMNS.ROLE],
            allowance: Number(db[DB_COLUMNS.ALLOWANCE] || 0),
            isActive: db[DB_COLUMNS.IS_ACTIVE] !== false,
            profile: db[DB_COLUMNS.PROFILE],
            branchAllowances,
            timestamp: db[DB_COLUMNS.TIMESTAMP] || db[DB_COLUMNS.CREATED_AT]
        };
    };

    // React Query Queries
    const { data: branches = [], isLoading: branchesLoading, error: branchesError } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            if (!supabase) return [];
            const { data, error } = await supabase.from(DB_TABLES.BRANCHES).select('*').order(DB_COLUMNS.NAME, { ascending: true });
            if (error) throw error;
            return data.map(mapDbBranch);
        },
        enabled: !!supabase
    });

    const { data: employees = [], isLoading: employeesLoading, error: employeesError } = useQuery({
        queryKey: ['employees', auth.user?.branchId, auth.user?.employeeId],
        queryFn: async () => {
            if (!supabase) return [];
            let query = supabase.from(DB_TABLES.EMPLOYEES).select('*').order(DB_COLUMNS.NAME, { ascending: true });

            // If branch manager, we need their own record PLUS their branch's employees
            if (auth.user?.role === UserRole.BRANCH_MANAGER && auth.user.branchId) {
                if (auth.user.employeeId) {
                    query = query.or(`${DB_COLUMNS.BRANCH_ID}.eq.${auth.user.branchId},${DB_COLUMNS.ID}.eq.${auth.user.employeeId}`);
                } else {
                    query = query.eq(DB_COLUMNS.BRANCH_ID, auth.user.branchId);
                }
            }
            const { data, error } = await query;
            if (error) throw error;
            return data.map(mapDbEmployee);
        },
        enabled: !!supabase
    });

    const { data: transactions = [], isLoading: transactionsLoading, error: transactionsError } = useQuery({
        queryKey: ['transactions', auth.user?.branchId],
        queryFn: async () => {
            if (!supabase) return [];
            const lookbackDate = new Date();
            lookbackDate.setDate(lookbackDate.getDate() - 90);
            const lookbackIso = lookbackDate.toISOString();

            let query = supabase.from(DB_TABLES.TRANSACTIONS).select('*').order(DB_COLUMNS.TIMESTAMP, { ascending: false }).gte(DB_COLUMNS.TIMESTAMP, lookbackIso).limit(2000);
            if (auth.user?.role === UserRole.BRANCH_MANAGER && auth.user.branchId) {
                query = query.eq(DB_COLUMNS.BRANCH_ID, auth.user.branchId);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data.map(t => ({
                id: t[DB_COLUMNS.ID], branchId: t[DB_COLUMNS.BRANCH_ID], timestamp: t[DB_COLUMNS.TIMESTAMP],
                clientName: t[DB_COLUMNS.CLIENT_NAME], therapistName: t[DB_COLUMNS.THERAPIST_NAME], bonesetterName: t[DB_COLUMNS.BONESETTER_NAME],
                serviceId: t[DB_COLUMNS.SERVICE_ID], serviceName: t[DB_COLUMNS.SERVICE_NAME], basePrice: Number(t[DB_COLUMNS.BASE_PRICE] || 0),
                discount: Number(t[DB_COLUMNS.DISCOUNT] || 0), voucherValue: Number(t[DB_COLUMNS.VOUCHER_VALUE] || 0),
                primaryCommission: Number(t[DB_COLUMNS.PRIMARY_COMMISSION] || 0), secondaryCommission: Number(t[DB_COLUMNS.SECONDARY_COMMISSION] || 0),
                total: Number(t[DB_COLUMNS.TOTAL] || 0),
                paymentMethod: t[DB_COLUMNS.PAYMENT_METHOD],
                paymentStatus: t[DB_COLUMNS.PAYMENT_STATUS],
                paymongoLinkId: t[DB_COLUMNS.PAYMONGO_LINK_ID],
                note: t[DB_COLUMNS.NOTE]
            }));
        },
        enabled: !!supabase && !!auth.user
    });

    const { data: expenses = [], isLoading: expensesLoading, error: expensesError } = useQuery({
        queryKey: ['expenses', auth.user?.branchId],
        queryFn: async () => {
            if (!supabase) return [];
            const lookbackDate = new Date();
            lookbackDate.setDate(lookbackDate.getDate() - 90);
            const lookbackIso = lookbackDate.toISOString();

            let query = supabase.from(DB_TABLES.EXPENSES).select('*').order(DB_COLUMNS.TIMESTAMP, { ascending: false }).gte(DB_COLUMNS.TIMESTAMP, lookbackIso).limit(1000);
            if (auth.user?.role === UserRole.BRANCH_MANAGER && auth.user.branchId) {
                query = query.eq(DB_COLUMNS.BRANCH_ID, auth.user.branchId);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data.map(e => ({
                id: e[DB_COLUMNS.ID], branchId: e[DB_COLUMNS.BRANCH_ID], timestamp: e[DB_COLUMNS.TIMESTAMP],
                name: e[DB_COLUMNS.NAME], amount: Number(e[DB_COLUMNS.AMOUNT] || 0), category: e[DB_COLUMNS.CATEGORY], receiptImage: e[DB_COLUMNS.RECEIPT_IMAGE]
            }));
        },
        enabled: !!supabase && !!auth.user
    });

    const { data: salesReports = [], isLoading: salesReportsLoading, error: salesReportsError } = useQuery({
        queryKey: ['salesReports', auth.user?.branchId],
        queryFn: async () => {
            if (!supabase) return [];
            const lookbackDate = new Date();
            lookbackDate.setDate(lookbackDate.getDate() - 90);
            const lookbackYmd = lookbackDate.toISOString().split('T')[0];

            let query = supabase.from(DB_TABLES.SALES_REPORTS).select('*').order(DB_COLUMNS.REPORT_DATE, { ascending: false }).gte(DB_COLUMNS.REPORT_DATE, lookbackYmd).limit(2000);
            if (auth.user?.role === UserRole.BRANCH_MANAGER && auth.user.branchId) {
                query = query.eq(DB_COLUMNS.BRANCH_ID, auth.user.branchId);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data.map(r => ({
                id: r[DB_COLUMNS.ID], branchId: r[DB_COLUMNS.BRANCH_ID], reportDate: r[DB_COLUMNS.REPORT_DATE], submittedAt: r[DB_COLUMNS.SUBMITTED_AT],
                grossSales: Number(r[DB_COLUMNS.GROSS_SALES] ?? 0), totalStaffPay: Number(r[DB_COLUMNS.TOTAL_STAFF_PAY] ?? 0),
                totalExpenses: Number(r[DB_COLUMNS.TOTAL_EXPENSES] ?? 0), totalVaultProvision: Number(r[DB_COLUMNS.TOTAL_VAULT_PROVISION] ?? 0),
                netRoi: Number(r[DB_COLUMNS.NET_ROI] ?? 0), sessionData: typeof r[DB_COLUMNS.SESSION_DATA] === 'string' ? JSON.parse(r[DB_COLUMNS.SESSION_DATA]) : (r[DB_COLUMNS.SESSION_DATA] || []),
                staffBreakdown: typeof r[DB_COLUMNS.STAFF_BREAKDOWN] === 'string' ? JSON.parse(r[DB_COLUMNS.STAFF_BREAKDOWN]) : (r[DB_COLUMNS.STAFF_BREAKDOWN] || []),
                expenseData: typeof r[DB_COLUMNS.EXPENSE_DATA] === 'string' ? JSON.parse(r[DB_COLUMNS.EXPENSE_DATA]) : (r[DB_COLUMNS.EXPENSE_DATA] || []),
                vaultData: typeof r[DB_COLUMNS.VAULT_DATA] === 'string' ? JSON.parse(r[DB_COLUMNS.VAULT_DATA]) : (r[DB_COLUMNS.VAULT_DATA] || [])
            }));
        },
        enabled: !!supabase && !!auth.user
    });

    const { data: shiftLogs = [], isLoading: shiftLogsLoading, error: shiftLogsError } = useQuery({
        queryKey: ['shiftLogs', auth.user?.branchId],
        queryFn: async () => {
            if (!supabase) return [];
            const lookbackDate = new Date();
            lookbackDate.setDate(lookbackDate.getDate() - 90);
            const lookbackIso = lookbackDate.toISOString();

            let query = supabase.from(DB_TABLES.SHIFT_LOGS).select('*').order(DB_COLUMNS.CLOCK_IN, { ascending: false }).gte(DB_COLUMNS.CLOCK_IN, lookbackIso).limit(500);
            if (auth.user?.role === UserRole.BRANCH_MANAGER && auth.user.branchId) {
                query = query.eq(DB_COLUMNS.BRANCH_ID, auth.user.branchId);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data.map(sl => ({
                id: sl[DB_COLUMNS.ID], branchId: sl[DB_COLUMNS.BRANCH_ID], employeeId: sl[DB_COLUMNS.EMPLOYEE_ID],
                employeeName: sl[DB_COLUMNS.EMPLOYEE_NAME], clockIn: sl[DB_COLUMNS.CLOCK_IN], clockOut: sl[DB_COLUMNS.CLOCK_OUT], dateStr: sl[DB_COLUMNS.DATE_STR]
            }));
        },
        enabled: !!supabase && !!auth.user
    });

    const { data: auditLogs = [], isLoading: auditLogsLoading, error: auditLogsError } = useQuery({
        queryKey: ['auditLogs', auth.user?.branchId],
        queryFn: async () => {
            if (!supabase) return [];
            const lookbackDate = new Date();
            lookbackDate.setDate(lookbackDate.getDate() - 90);
            const lookbackIso = lookbackDate.toISOString();

            let query = supabase.from(DB_TABLES.AUDIT_LOGS).select('*').order(DB_COLUMNS.TIMESTAMP, { ascending: false }).gte(DB_COLUMNS.TIMESTAMP, lookbackIso).limit(500);
            if (auth.user?.role === UserRole.BRANCH_MANAGER && auth.user.branchId) {
                query = query.eq(DB_COLUMNS.BRANCH_ID, auth.user.branchId);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data.map(au => ({
                id: String(au[DB_COLUMNS.ID]), branchId: au[DB_COLUMNS.BRANCH_ID], timestamp: au[DB_COLUMNS.TIMESTAMP],
                activityType: au[DB_COLUMNS.ACTIVITY_TYPE], entityType: au[DB_COLUMNS.ENTITY_TYPE], entityId: au[DB_COLUMNS.ENTITY_ID],
                description: au[DB_COLUMNS.DESCRIPTION], amount: Number(au[DB_COLUMNS.AMOUNT] || 0), performerName: au[DB_COLUMNS.PERFORMER_NAME]
            }));
        },
        enabled: !!supabase && !!auth.user
    });

    const { data: attendance = [], isLoading: attendanceLoading, error: attendanceError } = useQuery({
        queryKey: ['attendance', auth.user?.branchId],
        queryFn: async () => {
            if (!supabase) return [];
            const lookbackDate = new Date();
            lookbackDate.setDate(lookbackDate.getDate() - 90);
            const lookbackIso = lookbackDate.toISOString();

            let query = supabase.from(DB_TABLES.ATTENDANCE).select('*').order(DB_COLUMNS.CLOCK_IN, { ascending: false }).gte(DB_COLUMNS.CLOCK_IN, lookbackIso).limit(1000);
            if (auth.user?.role === UserRole.BRANCH_MANAGER && auth.user.branchId) {
                query = query.eq(DB_COLUMNS.BRANCH_ID, auth.user.branchId);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data.map(att => ({
                id: att[DB_COLUMNS.ID], branchId: att[DB_COLUMNS.BRANCH_ID], employeeId: att[DB_COLUMNS.EMPLOYEE_ID],
                staffName: att[DB_COLUMNS.STAFF_NAME], date: att[DB_COLUMNS.DATE], clockIn: att[DB_COLUMNS.CLOCK_IN],
                clockOut: att[DB_COLUMNS.CLOCK_OUT], status: att[DB_COLUMNS.STATUS], lateDeduction: Number(att[DB_COLUMNS.LATE_DEDUCTION] || 0),
                otPay: Number(att[DB_COLUMNS.OT_PAY] || 0), cashAdvance: Number(att[DB_COLUMNS.CASH_ADVANCE] || 0), createdAt: att[DB_COLUMNS.CREATED_AT]
            }));
        },
        enabled: !!supabase && !!auth.user
    });

    const fetchSystemConfig = useCallback(async () => {
        if (!supabase) return;
        const { data: configData } = await supabase.from(DB_TABLES.SYSTEM_CONFIG).select('*');
        if (configData) {
            let logoVal = configData.find(c => c[DB_COLUMNS.KEY] === 'logo')?.value;
            const version = configData.find(c => c[DB_COLUMNS.KEY] === 'version')?.value;
            const nameVal = configData.find(c => c[DB_COLUMNS.KEY] === 'app_name')?.value;
            const refreshTimeVal = configData.find(c => c[DB_COLUMNS.KEY] === 'auto_refresh_daily_audit')?.value;
            const logoutRegistryVal = configData.find(c => c[DB_COLUMNS.KEY] === 'force_logout_registry')?.value;
            const fontVal = configData.find(c => c[DB_COLUMNS.KEY] === 'font_family')?.value;
            const paymongoEnabledVal = configData.find(c => c[DB_COLUMNS.KEY] === 'paymongo_enabled')?.value;
            const terminologyVal = configData.find(c => c[DB_COLUMNS.KEY] === 'terminology')?.value;

            if (nameVal) setDynamicAppName(nameVal);
            if (version) setSystemVersion(version);
            if (fontVal) setFontFamily(fontVal);
            if (paymongoEnabledVal) setIsPaymongoEnabled(paymongoEnabledVal === 'true');
            if (terminologyVal) {
                try { setTerminology(JSON.parse(terminologyVal)); } catch { }
            }
            if (logoutRegistryVal) {
                try { setForceLogoutRegistry(JSON.parse(logoutRegistryVal)); } catch { setForceLogoutRegistry({}); }
            }
            if (refreshTimeVal) setAutoRefreshTime(refreshTimeVal);

            if (logoVal) {
                if (!logoVal.startsWith('http')) {
                    const parts = logoVal.split('/');
                    if (parts.length >= 2) {
                        const bucket = parts[0];
                        const filePath = parts.slice(1).join('/');
                        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
                        logoVal = data.publicUrl;
                    }
                }
                setSystemLogo(logoVal);
            }
        }
    }, []);

    useEffect(() => {
        fetchSystemConfig();
    }, [fetchSystemConfig]);

    const refreshDatabase = useCallback(async (quiet = false) => {
        if (!navigator.onLine) {
            setConnStatus('offline');
            return;
        }
        if (!quiet) setConnStatus('connecting');

        await queryClient.invalidateQueries();
        await fetchSystemConfig();

        if (!quiet) setConnStatus('connected');
    }, [queryClient, fetchSystemConfig]);

    const updateTerminology = useCallback(async (newTerminology: Terminology) => {
        setTerminology(newTerminology);
        if (supabase) {
            await supabase.from(DB_TABLES.SYSTEM_CONFIG).upsert({
                key: 'terminology',
                value: JSON.stringify(newTerminology)
            }, { onConflict: 'key' });
        }
    }, []);

    // CONNECTIVITY & SYNC SENTINEL
    useEffect(() => {
        const handleOnline = () => {
            setConnStatus('connecting');
            refreshDatabase(true);
            flushOfflineQueue();
        };
        const handleOffline = () => setConnStatus('offline');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        flushOfflineQueue();
        const syncInterval = setInterval(flushOfflineQueue, 45000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(syncInterval);
        };
    }, [refreshDatabase, flushOfflineQueue]);

    useEffect(() => {
        const channel = supabase.channel('global_network_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.BRANCHES }, () => refreshDatabase(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.TRANSACTIONS }, () => refreshDatabase(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.EXPENSES }, () => refreshDatabase(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.EMPLOYEES }, () => refreshDatabase(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.SHIFT_LOGS }, () => refreshDatabase(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.ATTENDANCE }, () => refreshDatabase(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.SALES_REPORTS }, () => refreshDatabase(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.SERVICE_CATALOGS }, () => refreshDatabase(true))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: DB_TABLES.AUDIT_LOGS }, () => refreshDatabase(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: DB_TABLES.SYSTEM_CONFIG }, () => refreshDatabase(true))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [refreshDatabase]);

    const loading = branchesLoading || employeesLoading || transactionsLoading || expensesLoading || salesReportsLoading || shiftLogsLoading || auditLogsLoading || attendanceLoading;
    const error = branchesError || employeesError || transactionsError || expensesError || salesReportsError || shiftLogsError || auditLogsError || attendanceError;

    // AUTO-LOGOUT STALE SESSIONS: Automatically close sessions 2 hours after branch closing time
    useEffect(() => {
        if (!supabase || !auth.user || loading || !navigator.onLine || branches.length === 0) return;

        const checkStaleSessions = async () => {
            const now = new Date();

            const getStaleInfo = (item: { clockIn: string; clockOut?: string | null; branchId: string }) => {
                if (item.clockOut) return null;
                const branch = branches.find(b => b.id === item.branchId);
                if (!branch) return null;

                const clockInDate = new Date(item.clockIn);

                // 1. Midnight of the next day (End of the clock-in day)
                let midnightDate = new Date(clockInDate);
                midnightDate.setHours(24, 0, 0, 0);

                // 2. Branch closing time
                const [closeH, closeM] = (branch.closingTime || '22:00').split(':').map(Number);
                let branchClosingDate = new Date(clockInDate);
                branchClosingDate.setHours(closeH, closeM, 0, 0);

                // If closing time is earlier in the day than clock-in, it must be the next day (overnight shift)
                if (branchClosingDate < clockInDate) {
                    branchClosingDate.setDate(branchClosingDate.getDate() + 1);
                }

                // Final closing time is the later of Midnight or Branch Closing
                const finalClosingDate = new Date(Math.max(midnightDate.getTime(), branchClosingDate.getTime()));

                // Cutoff is 2 hours after the final closing time
                const cutoffDate = new Date(finalClosingDate.getTime() + 2 * 60 * 60 * 1000);

                if (now > cutoffDate) {
                    return { closingDate: finalClosingDate.toISOString() };
                }
                return null;
            };

            const staleAttendance = attendance.map(a => ({ ...a, stale: getStaleInfo(a) })).filter(a => a.stale);
            const staleShifts = shiftLogs.map(s => ({ ...s, stale: getStaleInfo(s) })).filter(s => s.stale);

            if (staleAttendance.length === 0 && staleShifts.length === 0) return;

            console.log(`🕒 HilotCore: Found ${staleAttendance.length + staleShifts.length} stale sessions. Initiating daily reset auto-logout...`);

            try {
                // Process Attendance
                for (const att of staleAttendance) {
                    const autoClockOut = att.stale!.closingDate;
                    await supabase.from(DB_TABLES.ATTENDANCE).update({
                        [DB_COLUMNS.CLOCK_OUT]: autoClockOut,
                        [DB_COLUMNS.STATUS]: 'AUTO-LOGOUT'
                    }).eq(DB_COLUMNS.ID, att.id);

                    // Log to Audit
                    await supabase.from(DB_TABLES.AUDIT_LOGS).insert({
                        [DB_COLUMNS.BRANCH_ID]: att.branchId,
                        [DB_COLUMNS.ACTIVITY_TYPE]: 'UPDATE',
                        [DB_COLUMNS.ENTITY_TYPE]: 'ATTENDANCE',
                        [DB_COLUMNS.ENTITY_ID]: att.id,
                        [DB_COLUMNS.DESCRIPTION]: `System auto-logout for ${att.staffName} (Shift exceeded branch hours + 2h grace)`,
                        [DB_COLUMNS.PERFORMER_NAME]: 'SYSTEM_SENTINEL'
                    });
                }

                // Process Shift Logs
                for (const shift of staleShifts) {
                    const autoClockOut = shift.stale!.closingDate;
                    await supabase.from(DB_TABLES.SHIFT_LOGS).update({
                        [DB_COLUMNS.CLOCK_OUT]: autoClockOut
                    }).eq(DB_COLUMNS.ID, shift.id);
                }

                // Refresh to sync UI
                refreshDatabase(true);
            } catch (err) {
                console.error("Auto-logout execution failed:", err);
            }
        };

        // Delay check slightly after load to prioritize UI rendering
        const timer = setTimeout(checkStaleSessions, 8000);
        return () => clearTimeout(timer);
    }, [attendance, shiftLogs, branches, auth.user, loading, refreshDatabase]);

    useEffect(() => {
        if (loading) {
            console.log('Syncing Data Status:', {
                branches: branchesLoading,
                employees: employeesLoading,
                transactions: transactionsLoading,
                expenses: expensesLoading,
                salesReports: salesReportsLoading,
                shiftLogs: shiftLogsLoading,
                auditLogs: auditLogsLoading,
                attendance: attendanceLoading
            });
        }
    }, [loading, branchesLoading, employeesLoading, transactionsLoading, expensesLoading, salesReportsLoading, shiftLogsLoading, auditLogsLoading, attendanceLoading]);

    return {
        branches, transactions, expenses, attendance, employees, shiftLogs,
        salesReports, auditLogs, systemLogo, systemVersion,
        dynamicAppName, autoRefreshTime, fontFamily, isPaymongoEnabled, terminology, updateTerminology, loading, error, globalSync, setGlobalSync, connStatus,
        pendingSyncCount, forceLogoutRegistry, refreshDatabase
    };
};