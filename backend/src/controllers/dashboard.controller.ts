/**
 * Dashboard Controller - Re-export hub for backwards compatibility
 * 
 * This file has been refactored into smaller, focused modules:
 * - dashboard-summary.controller.ts - Summary-related endpoints
 * - dashboard-activity.controller.ts - Activity log endpoints  
 * - dashboard-history.controller.ts - Change history endpoints
 * - dashboard-workload.controller.ts - Workload report endpoints
 * - dashboard-heatmap.controller.ts - Staffing heatmap endpoints
 * - dashboard.utils.ts - Shared utilities
 * 
 * All exports are maintained here for backwards compatibility.
 */

export * from './dashboard-summary.controller';
export * from './dashboard-activity.controller';
export * from './dashboard-history.controller';
export * from './dashboard-workload.controller';
export * from './dashboard-heatmap.controller';
