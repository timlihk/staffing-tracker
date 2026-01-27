/**
 * Application-wide constants
 * Use these instead of hardcoded strings to maintain consistency
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

// ============================================================================
// Project Priority
// ============================================================================
export const ProjectPriority = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
} as const;

export type ProjectPriority = (typeof ProjectPriority)[keyof typeof ProjectPriority];

// ============================================================================
// Project Side
// ============================================================================
export const ProjectSide = {
  BUY_SIDE: 'Buy-side',
  SELL_SIDE: 'Sell-side',
} as const;

export type ProjectSide = (typeof ProjectSide)[keyof typeof ProjectSide];

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

// ============================================================================
// User Roles
// ============================================================================
export const UserRole = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ALLOWED_ROLES = new Set([UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER]);

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

// ============================================================================
// Staff Status
// ============================================================================
export const StaffStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  LEAVING: 'leaving',
} as const;

export type StaffStatus = (typeof StaffStatus)[keyof typeof StaffStatus];

// ============================================================================
// Jurisdiction
// ============================================================================
export const Jurisdiction = {
  HK_LAW: 'HK Law',
  US_LAW: 'US Law',
  BC: 'B&C',
} as const;

export type Jurisdiction = (typeof Jurisdiction)[keyof typeof Jurisdiction];

// ============================================================================
// Activity Action Types
// ============================================================================
export const ActionType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

// ============================================================================
// Entity Types
// ============================================================================
export const EntityType = {
  PROJECT: 'project',
  STAFF: 'staff',
  ASSIGNMENT: 'assignment',
  USER: 'user',
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

// ============================================================================
// HTTP Status Codes
// ============================================================================
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// ============================================================================
// Error Messages
// ============================================================================
export const ErrorMessage = {
  INTERNAL_SERVER_ERROR: 'Internal server error',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: (entity: string) => `${entity} not found`,
  INVALID_CREDENTIALS: 'Invalid credentials',
  PASSWORD_RESET_REQUIRED: 'Password reset required',
} as const;

// ============================================================================
// Success Messages
// ============================================================================
export const SuccessMessage = {
  CREATED: (entity: string) => `${entity} created successfully`,
  UPDATED: (entity: string) => `${entity} updated successfully`,
  DELETED: (entity: string) => `${entity} deleted successfully`,
} as const;

// ============================================================================
// Cache Configuration
// ============================================================================
export const CacheConfig = {
  TTL_MS: 30000, // 30 seconds
  MAX_SIZE: 1000,
  MAX_KEY_LENGTH: 500,
  VERSION: 'v2',
} as const;

// ============================================================================
// Rate Limiting
// ============================================================================
export const RateLimitConfig = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 500,
  AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  AUTH_MAX_REQUESTS: 5,
  PASSWORD_RESET_MAX: 3,
} as const;

// ============================================================================
// JWT Configuration
// ============================================================================
export const JWTConfig = {
  DEFAULT_EXPIRES_IN: '7d',
  REFRESH_EXPIRES_IN: '30d',
  BCRYPT_ROUNDS: 10,
} as const;

// ============================================================================
// Pagination
// ============================================================================
export const Pagination = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
} as const;

// ============================================================================
// Email Settings
// ============================================================================
export const EmailConfig = {
  DEFAULT_FROM: 'Asia CM Team <notifications@asia-cm.team>',
  TEST_MODE_RECIPIENT: 'admin@example.com',
} as const;

// ============================================================================
// Validation Limits
// ============================================================================
export const ValidationLimits = {
  MAX_NAME_LENGTH: 255,
  MAX_EMAIL_LENGTH: 255,
  MAX_POSITION_LENGTH: 100,
  MAX_DEPARTMENT_LENGTH: 100,
  MAX_STATUS_LENGTH: 50,
  MAX_CATEGORY_LENGTH: 100,
  MAX_NOTES_LENGTH: 5000,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  BULK_ASSIGNMENTS_MAX: 100,
} as const;
