/**
 * Billing API Client
 */

import apiClient from './client';
import type { BigIntLike, PaginationMeta } from '../types';

export interface BillingProject {
  project_id: BigIntLike;
  project_name: string;
  client_name: string;
  attorney_in_charge: string;
  cm_numbers: string;
  bc_attorney_staff_id: BigIntLike | null;
  bc_attorney_name: string | null;
  bc_attorney_position: string | null;
  is_auto_mapped: boolean;
  match_confidence: number | null;
  fee_arrangement_text: string | null;
  lsd_date: string | null;
  agreed_fee_usd: number;
  billing_usd: number;
  collection_usd: number;
  billing_credit_usd: number;
  ubt_usd: number;
  bonus_usd: number;
  agreed_fee_cny: number;
  billing_cny: number;
  collection_cny: number;
  billing_credit_cny: number;
  ubt_cny: number;
  bonus_cny: number;
  total_milestones: number;
  completed_milestones: number;
  staffing_project_id: BigIntLike | null;
  staffing_project_name: string | null;
  staffing_project_status: string | null;
  linked_at: string | null;
  financials_last_updated_at: string | null;
  financials_last_updated_by_username: string | null;
}

export interface BillingProjectSummaryResponse {
  project: BillingProject & {
    ubt_usd?: number | null;
    ubt_cny?: number | null;
    billing_credit_usd?: number | null;
    billing_credit_cny?: number | null;
  };
  cmNumbers: BillingProjectCM[];
  eventCount: number;
  viewMode: 'summary' | 'full';
}

export interface BillingProjectCM {
  cm_id: BigIntLike;
  cm_no: string | null;
  is_primary: boolean;
  open_date: string | null;
  closed_date: string | null;
  status: string | null;
  engagement_count: number;
  milestone_count: number;
  completed_milestone_count: number;
  engagements?: EngagementDetailResponse[];
}

export interface ProjectActivityResponse {
  events: BillingEvent[];
  financeComments: FinanceComment[];
  eventCount: number;
}

export interface BillingEvent {
  event_id: BigIntLike;
  engagement_id: BigIntLike;
  event_type: string | null;
  event_date: string | null;
  description: string | null;
  amount_usd: number | null;
  amount_cny: number | null;
  created_at: string | null;
  created_by: string | null;
}

export interface FinanceComment {
  comment_id: BigIntLike;
  engagement_id: BigIntLike;
  milestone_id: number | null;
  comment_text: string | null;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
}

export interface CMEngagementSummary {
  engagement_id: BigIntLike;
  cm_id: BigIntLike;
  engagement_code: string | null;
  engagement_title: string | null;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  total_agreed_fee_value: number | null;
  total_agreed_fee_currency: string | null;
  milestone_count: number;
  completed_milestone_count: number;
}

export interface EngagementDetailResponse {
  engagement_id: BigIntLike;
  cm_id: BigIntLike;
  engagement_code: string | null;
  engagement_title: string | null;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  total_agreed_fee_value: number | null;
  total_agreed_fee_currency: string | null;
  ubt_usd: number | null;
  ubt_cny: number | null;
  billing_credit_usd: number | null;
  billing_credit_cny: number | null;
  financials_last_updated_at: string | null;
  financials_last_updated_by: string | null;
  billing_usd: number | null;
  collection_usd: number | null;
  efs_billing_credit_usd: number | null;
  efs_ubt_usd: number | null;
  billing_cny: number | null;
  collection_cny: number | null;
  efs_billing_credit_cny: number | null;
  efs_ubt_cny: number | null;
  agreed_fee_usd: number | null;
  agreed_fee_cny: number | null;
  efs_financials_last_updated_at: string | null;
  efs_financials_last_updated_by: string | null;
  feeArrangement: {
    fee_id: number;
    raw_text: string | null;
    lsd_date: string | null;
    lsd_raw: string | null;
  } | null;
  milestones: Array<{
    milestone_id: BigIntLike;
    ordinal: number | null;
    title: string | null;
    description: string | null;
    trigger_type: string | null;
    trigger_text: string | null;
    amount_value: number | null;
    amount_currency: string | null;
    is_percent: boolean | null;
    percent_value: number | null;
    due_date: string | null;
    completed: boolean | null;
    completion_date: string | null;
    completion_source: string | null;
    invoice_sent_date: string | null;
    payment_received_date: string | null;
    notes: string | null;
    raw_fragment: string | null;
  }>;
  financeComments: FinanceComment[];
  events: BillingEvent[];
}

export interface BillingAccessSettings {
  billing_module_enabled: boolean;
  access_level: 'admin_only' | 'admin_and_bc_attorney';
  updated_by: number | null;
  updated_at: string | null;
}

export interface BillingTriggerRow {
  id: number;
  milestoneId: BigIntLike;
  staffingProjectId: number;
  oldStatus: string;
  newStatus: string;
  matchConfidence: number;
  triggerReason: string | null;
  status: 'pending' | 'confirmed' | 'rejected';
  confirmedBy?: number | null;
  confirmedAt?: string | null;
  actionTaken?: string | null;
  createdAt: string;
  milestone?: {
    title: string | null;
    triggerText: string | null;
    amountValue: number | null;
    dueDate: string | null;
  } | null;
  project?: {
    name: string;
    status: string;
  } | null;
  actionItem?: BillingTriggerActionItem | null;
}

export interface BillingTriggerActionItem {
  id: number;
  actionType: string;
  description: string;
  dueDate: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: string | null;
  assignedTo?: {
    id: number;
    name: string;
    position: string | null;
  } | null;
}

export interface BillingOverdueRow {
  staffId: number;
  attorneyName: string;
  attorneyPosition: string | null;
  overdueMilestones: number;
  overdueAmount: number;
  nextDueDate: string | null;
  billingProjectId: BigIntLike;
  billingProjectName: string;
  staffingProjectId: number | null;
  staffingProjectName: string | null;
  staffingProjectStatus: string | null;
  milestoneId: BigIntLike;
  milestoneTitle: string | null;
  milestoneAmount: number | null;
  milestoneDueDate: string | null;
}

// Get all billing projects
export interface BillingProjectsResponse {
  data: BillingProject[];
  pagination: PaginationMeta;
}

export interface BillingProjectsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  bcAttorney?: string;
}

export const getBillingProjects = async (params?: BillingProjectsQueryParams): Promise<BillingProjectsResponse> => {
  const response = await apiClient.get('/billing/projects', { params });
  return response.data;
};

export interface BillingAttorneyOption {
  staff_id: BigIntLike;
  name: string;
  position: string | null;
}

export const getBillingAttorneys = async (): Promise<BillingAttorneyOption[]> => {
  const response = await apiClient.get('/billing/bc-attorneys');
  return response.data;
};

// Get billing project summary (lazy-load friendly)
export const getBillingProjectSummary = async (
  id: number,
  options?: { view?: 'summary' | 'full' }
): Promise<BillingProjectSummaryResponse> => {
  const response = await apiClient.get(`/billing/projects/${id}`, {
    params: { view: options?.view ?? 'summary' },
  });
  return response.data;
};

// Get billing project activity (events + finance comments)
export const getBillingProjectActivity = async (id: number): Promise<ProjectActivityResponse> => {
  const response = await apiClient.get(`/billing/projects/${id}/activity`);
  return response.data;
};

// Get engagements for a CM (lazy-loaded)
export const getProjectCMEngagements = async (
  projectId: number,
  cmId: number
): Promise<CMEngagementSummary[]> => {
  const response = await apiClient.get(`/billing/projects/${projectId}/cm/${cmId}/engagements`);
  return response.data;
};

// Get detailed engagement data
export const getEngagementDetail = async (
  projectId: number,
  engagementId: number
): Promise<EngagementDetailResponse> => {
  const response = await apiClient.get(`/billing/projects/${projectId}/engagement/${engagementId}`);
  return response.data;
};

// Update financials (UBT and Billing Credits)
export const updateFinancials = async (
  projectId: number,
  data: Partial<{
    ubt_usd: number;
    ubt_cny: number;
    billing_credit_usd: number;
    billing_credit_cny: number;
  }>
) => {
  const response = await apiClient.patch(`/billing/projects/${projectId}/financials`, data);
  return response.data;
};

// Update fee arrangement for an engagement
export const updateFeeArrangement = async (
  engagementId: number,
  data: {
    raw_text: string;
    lsd_date?: string | null;
  }
) => {
  const response = await apiClient.patch(`/billing/engagements/${engagementId}/fee-arrangement`, data);
  return response.data;
};

// Bulk update milestones
export const updateMilestones = async (
  payload: {
    milestones: Array<{
      milestone_id: number;
      completed?: boolean;
      invoice_sent_date?: string | null;
      payment_received_date?: string | null;
      notes?: string | null;
      due_date?: string | null;
      title?: string | null;
      trigger_text?: string | null;
      amount_value?: number | null;
      amount_currency?: string | null;
      ordinal?: number | null;
    }>;
  }
) => {
  const response = await apiClient.patch('/billing/milestones', payload);
  return response.data;
};

export const createMilestone = async (
  engagementId: number,
  data: {
    title?: string | null;
    trigger_text?: string | null;
    notes?: string | null;
    due_date?: string | null;
    invoice_sent_date?: string | null;
    payment_received_date?: string | null;
    amount_value?: number | null;
    amount_currency?: string | null;
    ordinal?: number | null;
    completed?: boolean | null;
  }
) => {
  const response = await apiClient.post(`/billing/engagements/${engagementId}/milestones`, data);
  return response.data;
};

export const deleteMilestone = async (milestoneId: number) => {
  const response = await apiClient.delete(`/billing/milestones/${milestoneId}`);
  return response.data;
};

// Get billing access settings
export const getBillingAccessSettings = async (): Promise<BillingAccessSettings> => {
  const response = await apiClient.get('/billing/settings/access');
  return response.data;
};

// Update billing access settings
export const updateBillingAccessSettings = async (
  data: Partial<BillingAccessSettings>
) => {
  const response = await apiClient.patch('/billing/settings/access', data);
  return response.data;
};

// Get project mapping suggestions
export const getMappingSuggestions = async () => {
  const response = await apiClient.get('/billing/mapping/suggestions');
  return response.data;
};

// Link billing project to staffing project
export const linkProjects = async (data: {
  billing_project_id: number;
  staffing_project_id: number;
  notes?: string;
}) => {
  const response = await apiClient.post('/billing/mapping/link', data);
  return response.data;
};

// Get unmapped B&C attorneys
export const getUnmappedAttorneys = async () => {
  const response = await apiClient.get('/billing/bc-attorneys/unmapped');
  return response.data;
};

export const getBillingTriggers = async (params?: {
  status?: 'pending' | 'confirmed' | 'rejected';
  staffingProjectId?: number;
  startDate?: string;
  endDate?: string;
}): Promise<BillingTriggerRow[]> => {
  const response = await apiClient.get('/billing/triggers', { params });
  return response.data;
};

export const getPendingBillingTriggers = async (): Promise<BillingTriggerRow[]> => {
  const response = await apiClient.get('/billing/triggers/pending');
  return response.data;
};

export const confirmBillingTrigger = async (id: number) => {
  const response = await apiClient.post(`/billing/triggers/${id}/confirm`);
  return response.data;
};

export const rejectBillingTrigger = async (id: number) => {
  const response = await apiClient.post(`/billing/triggers/${id}/reject`);
  return response.data;
};

export const updateTriggerActionItem = async (
  id: number,
  data: Partial<{
    actionType: string;
    description: string;
    dueDate: string | null;
    status: 'pending' | 'completed' | 'cancelled';
    assignedTo: number | null;
  }>
) => {
  const response = await apiClient.patch(`/billing/triggers/${id}/action-item`, data);
  return response.data;
};

// Excel sync (finance upload)
export interface ExcelSyncValidationIssue {
  cmNo: string;
  engagementTitle: string;
  severity: 'warning' | 'error';
  issue: string;
  suggestion: string;
}

export interface ExcelSyncPreview {
  totalExcelRows: number;
  matchedCmNumbers: number;
  unmatchedCmNumbers: string[];
  projectsToUpdate: number;
  milestonesToCreate: number;
  milestonesToMarkCompleted: number;
  financialsToUpdate: number;
  matched: Array<{
    cmNo: string;
    projectName: string;
    engagementCount: number;
    milestoneCount: number;
    completedCount: number;
    financialChanges: string[];
  }>;
  aiValidation?: {
    validated: boolean;
    issues: ExcelSyncValidationIssue[];
  };
}

export interface ExcelSyncResult {
  projectsUpdated: number;
  financialsUpdated: number;
  engagementsUpserted: number;
  milestonesCreated: number;
  milestonesUpdated: number;
  milestonesMarkedCompleted: number;
  unmatchedCmNumbers: string[];
  syncRunId?: number;
}

export interface SyncRunSummary {
  id: number;
  uploaded_at: string;
  uploaded_by: number | null;
  excel_filename: string;
  status: string;
  summary_json: {
    projectsUpdated: number;
    financialsUpdated: number;
    engagementsUpserted: number;
    milestonesCreated: number;
    milestonesUpdated: number;
    milestonesMarkedCompleted: number;
    newCmCount: number;
    updatedCmCount: number;
    staffingLinksCount: number;
    unmatchedCount: number;
    skippedCount: number;
  };
  username: string | null;
}

export interface SyncRunDetail extends SyncRunSummary {
  changes_json: {
    updatedCms: Array<{
      cmNo: string;
      projectName: string;
      financialChanges: Array<{ field: string; oldValue: string | null; newValue: string | null }>;
      engagements: Array<{ title: string; milestoneCount: number; completedCount: number }>;
    }>;
    newCms: Array<{
      cmNo: string;
      projectName: string;
      clientName: string;
      engagements: Array<{ title: string; milestoneCount: number }>;
    }>;
    staffingLinks: Array<{
      cmNo: string;
      billingProjectName: string;
      staffingProjectId: number;
      staffingProjectName: string;
      matchMethod: string;
      cmNumberSet: boolean;
    }>;
    unmatchedNewCms: Array<{ cmNo: string; projectName: string }>;
    skippedCms: string[];
  };
  staffing_links_json: unknown;
  error_message: string | null;
}

export const previewExcelSync = async (fileBase64: string): Promise<ExcelSyncPreview> => {
  const response = await apiClient.post('/billing/excel-sync/preview', { file: fileBase64 });
  return response.data;
};

export const applyExcelSync = async (fileBase64: string, filename?: string): Promise<ExcelSyncResult> => {
  const response = await apiClient.post('/billing/excel-sync/apply', { file: fileBase64, filename });
  return response.data;
};

export const getSyncHistory = async (): Promise<SyncRunSummary[]> => {
  const response = await apiClient.get('/billing/excel-sync/history');
  return response.data;
};

export const getSyncRunDetail = async (id: number): Promise<SyncRunDetail> => {
  const response = await apiClient.get(`/billing/excel-sync/history/${id}`);
  return response.data;
};

export const getSyncExcelDownloadUrl = (id: number): string => {
  return `/billing/excel-sync/history/${id}/download`;
};

export const getOverdueByAttorney = async (params?: {
  attorneyId?: number;
  minAmount?: number;
  startDate?: string;
  endDate?: string;
}): Promise<BillingOverdueRow[]> => {
  const response = await apiClient.get('/billing/overdue-by-attorney', { params });
  return response.data;
};
