/**
 * Billing Controller
 *
 * This file is now a re-export hub for backwards compatibility.
 * All controller functions have been split into focused modules.
 *
 * @deprecated Import directly from the specific controller modules instead:
 *   - billing-project.controller.ts
 *   - billing-engagement.controller.ts
 *   - billing-milestone.controller.ts
 *   - billing-financials.controller.ts
 *   - billing-mapping.controller.ts
 *   - billing-settings.controller.ts
 *   - billing-attorney.controller.ts
 *   - billing.utils.ts (for shared utilities)
 */

// Re-export all functions from the new modules for backwards compatibility
export * from './billing-project.controller';
export * from './billing-engagement.controller';
export * from './billing-milestone.controller';
export * from './billing-financials.controller';
export * from './billing-mapping.controller';
export * from './billing-settings.controller';
export * from './billing-attorney.controller';

// Re-export utilities for backwards compatibility
export {
  NUMERIC_ID_REGEX,
  BILLING_DASHBOARD_SELECT,
  buildStaffCondition,
  parseNumericIdParam,
  parseOptionalQueryId,
  toSafeNumber,
  convertBigIntToNumber,
  parseDate,
  parseNullableString,
  parseNullableNumber,
} from './billing.utils';
