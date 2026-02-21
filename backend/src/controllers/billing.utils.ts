/**
 * Billing Utilities
 *
 * Shared utilities for billing controllers
 */

import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';

export const NUMERIC_ID_REGEX = /^\d+$/;

export const BILLING_DASHBOARD_SELECT = Prisma.sql`
  SELECT
    project_id,
    project_name,
    client_name,
    attorney_in_charge,
    bc_attorney_staff_id,
    bc_attorney_name,
    bc_attorney_position,
    bc_attorney_status,
    is_auto_mapped,
    match_confidence,
    cm_numbers,
    cm_status,
    cm_open_date,
    cm_closed_date,
    fee_arrangement_text,
    lsd_date,
    agreed_fee_usd,
    billing_usd,
    collection_usd,
    billing_credit_usd,
    ubt_usd,
    agreed_fee_cny,
    billing_cny,
    collection_cny,
    billing_credit_cny,
    ubt_cny,
    total_milestones,
    completed_milestones,
    staffing_project_id,
    staffing_project_name,
    staffing_project_status,
    linked_at,
    financials_last_updated_at,
    financials_last_updated_by_username
  FROM billing_bc_attorney_dashboard
`;

export const buildStaffCondition = (staffId?: bigint | null) => (
  staffId
    ? Prisma.sql`EXISTS (
        SELECT 1
        FROM billing_project_bc_attorney bpa
        WHERE bpa.billing_project_id = billing_bc_attorney_dashboard.project_id
          AND bpa.staff_id = ${staffId}
      )`
    : null
);

interface BillingAuthUser {
  role?: string;
  userId?: number;
}

export async function resolveBillingAccessScope(authUser?: BillingAuthUser | null): Promise<{
  isAdmin: boolean;
  staffId: number | null;
}> {
  const isAdmin = authUser?.role === 'admin';
  if (isAdmin) {
    return { isAdmin: true, staffId: null };
  }

  if (!authUser?.userId) {
    return { isAdmin: false, staffId: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { staffId: true },
  });

  return {
    isAdmin: false,
    staffId: user?.staffId ?? null,
  };
}

export async function canAccessBillingProject(
  projectId: bigint,
  authUser?: BillingAuthUser | null
): Promise<boolean> {
  const scope = await resolveBillingAccessScope(authUser);
  if (scope.isAdmin) {
    return true;
  }
  if (!scope.staffId) {
    return false;
  }

  const mapping = await prisma.billing_project_bc_attorney.findFirst({
    where: {
      billing_project_id: projectId,
      staff_id: scope.staffId,
    },
    select: { id: true },
  });

  return !!mapping;
}

export const parseNumericIdParam = (value: string | string[] | undefined, label: string) => {
  if (typeof value !== 'string' || !NUMERIC_ID_REGEX.test(value.trim())) {
    throw new Error(`Invalid ${label}`);
  }
  return BigInt(value);
};

export const parseOptionalQueryId = (value: unknown, label: string) => {
  if (value === undefined) return null;
  if (Array.isArray(value) || typeof value !== 'string' || !NUMERIC_ID_REGEX.test(value.trim())) {
    throw new Error(`Invalid ${label}`);
  }
  return BigInt(value);
};

export const toSafeNumber = (value: bigint) =>
  value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);

/**
 * Convert BigInt values to JSON-safe representations.
 * Returns a Number when it is within the safe integer range,
 * otherwise returns a string to avoid precision loss.
 */
export function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') {
    const asNumber = Number(obj);
    return Number.isSafeInteger(asNumber) ? asNumber : obj.toString();
  }
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertBigIntToNumber(obj[key]);
    }
    return result;
  }
  return obj;
}

export const parseDate = (value: string | null | undefined) => {
  if (!value || value === '') return null;

  // Handle date strings like "2024-12-11"
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
};

export const parseNullableString = (value: string | null | undefined) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const parseNullableNumber = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};
