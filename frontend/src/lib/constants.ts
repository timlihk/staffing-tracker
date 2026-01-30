/**
 * Application-wide constants
 * Mirror of backend constants for frontend use
 */

// ============================================================================
// Project Status
// ============================================================================
export const ProjectStatus = {
  ACTIVE: 'Active',
  SLOW_DOWN: 'Slow-down',
  SUSPENDED: 'Suspended',
  CLOSED: 'Closed',
  TERMINATED: 'Terminated',
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const PROJECT_STATUS_OPTIONS = Object.values(ProjectStatus);

// ============================================================================
// Project Category
// ============================================================================
export const ProjectCategory = {
  HK_TRX: 'HK Trx',
  US_TRX: 'US Trx',
  COMP: 'Comp',
  OTHER: 'Other',
} as const;

export type ProjectCategory = (typeof ProjectCategory)[keyof typeof ProjectCategory];

export const PROJECT_CATEGORY_OPTIONS = Object.values(ProjectCategory);

// ============================================================================
// Project Priority
// ============================================================================
export const ProjectPriority = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
} as const;

export type ProjectPriority = (typeof ProjectPriority)[keyof typeof ProjectPriority];

export const PROJECT_PRIORITY_OPTIONS = Object.values(ProjectPriority);

// ============================================================================
// Project Side
// ============================================================================
export const ProjectSide = {
  BUY_SIDE: 'Buy-side',
  SELL_SIDE: 'Sell-side',
} as const;

export type ProjectSide = (typeof ProjectSide)[keyof typeof ProjectSide];

export const PROJECT_SIDE_OPTIONS = Object.values(ProjectSide);

// ============================================================================
// EL Status
// ============================================================================
export const ELStatus = {
  YES: 'Yes',
  NO: 'No',
  PENDING: 'Pending',
  NA: 'N/A',
} as const;

export type ELStatus = (typeof ELStatus)[keyof typeof ELStatus];

export const EL_STATUS_OPTIONS = Object.values(ELStatus);

// ============================================================================
// Timetable
// ============================================================================
export const Timetable = {
  PRE_A1: 'PRE_A1',
  A1: 'A1',
  HEARING: 'HEARING',
  LISTING: 'LISTING',
} as const;

export type Timetable = (typeof Timetable)[keyof typeof Timetable];

export const TIMETABLE_OPTIONS = Object.values(Timetable);

// ============================================================================
// User Roles
// ============================================================================
export const UserRole = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const USER_ROLE_OPTIONS = Object.values(UserRole);

// ============================================================================
// Staff Position
// ============================================================================
export const StaffPosition = {
  PARTNER: 'Partner',
  ASSOCIATE: 'Associate',
  JUNIOR_FLIC: 'Junior FLIC',
  SENIOR_FLIC: 'Senior FLIC',
  INTERN: 'Intern',
  BC_WORKING_ATTORNEY: 'B&C Working Attorney',
} as const;

export type StaffPosition = (typeof StaffPosition)[keyof typeof StaffPosition];

export const STAFF_POSITION_OPTIONS = Object.values(StaffPosition);

// ============================================================================
// Staff Status
// ============================================================================
export const StaffStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  LEAVING: 'leaving',
} as const;

export type StaffStatus = (typeof StaffStatus)[keyof typeof StaffStatus];

export const STAFF_STATUS_OPTIONS = Object.values(StaffStatus);

// ============================================================================
// Jurisdiction
// ============================================================================
export const Jurisdiction = {
  HK_LAW: 'HK Law',
  US_LAW: 'US Law',
  BC: 'B&C',
} as const;

export type Jurisdiction = (typeof Jurisdiction)[keyof typeof Jurisdiction];

export const JURISDICTION_OPTIONS = Object.values(Jurisdiction);

// ============================================================================
// Pagination
// ============================================================================
export const Pagination = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
  PAGE_SIZE_OPTIONS: [25, 50, 100, 250],
} as const;

// ============================================================================
// UI/UX Constants
// ============================================================================
export const UI = {
  DEBOUNCE_DELAY: 300, // ms
  TOAST_DURATION: 3000, // ms
  SNACKBAR_AUTO_HIDE_DURATION: 6000, // ms
  TABLE_ROW_HEIGHT: 52,
  MOBILE_BREAKPOINT: 768, // px
  TABLET_BREAKPOINT: 1024, // px
  SIDEBAR_WIDTH: 280, // px
  SIDEBAR_WIDTH_COLLAPSED: 72, // px
} as const;

// ============================================================================
// Validation
// ============================================================================
export const Validation = {
  MAX_NAME_LENGTH: 255,
  MAX_EMAIL_LENGTH: 255,
  MAX_NOTES_LENGTH: 5000,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MIN_PASSWORD_LENGTH: 8,
} as const;

// ============================================================================
// Error Messages
// ============================================================================
export const ErrorMessage = {
  GENERIC: 'Something went wrong. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: (entity: string) => `${entity} not found`,
  REQUIRED: (field: string) => `${field} is required`,
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PASSWORD: 'Password must be at least 8 characters',
} as const;

// ============================================================================
// Success Messages
// ============================================================================
export const SuccessMessage = {
  SAVED: 'Changes saved successfully',
  CREATED: (entity: string) => `${entity} created successfully`,
  UPDATED: (entity: string) => `${entity} updated successfully`,
  DELETED: (entity: string) => `${entity} deleted successfully`,
} as const;
