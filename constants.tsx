
import { UserRole, Service, Terminology } from './types';

export const APP_NAME = "Hilot Center";

export const DEFAULT_TERMINOLOGY: Terminology = {
    branchHead: 'Manager',
    reliefManager: 'Relief Manager',
    vault: 'Vault',
    branch: 'Branch',
    staff: 'Staff',
    service: 'Service',
    expense: 'Expense',
    sales: 'Sales',
};

/**
 * SESSION CONFIGURATION
 * Automated logout occurs after 4 hours of total inactivity.
 */
export const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000;

// Services are now managed purely via database; no initial mock defaults for new branches.
export const INITIAL_SERVICES: Service[] = [];

export const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
