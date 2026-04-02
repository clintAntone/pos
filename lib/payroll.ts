import { Employee } from '../types';

/**
 * Calculates the correct daily allowance for an employee at a specific branch.
 * Checks for branch-specific overrides first, then falls back to the base allowance.
 */
export const getEmployeeAllowance = (employee: Employee, branchId: string): number => {
  if (employee.branchAllowances && employee.branchAllowances[branchId] !== undefined) {
    return Number(employee.branchAllowances[branchId]);
  }
  return Number(employee.allowance || 0);
};
