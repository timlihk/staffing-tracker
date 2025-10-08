/**
 * Billing API Client
 */

import apiClient from './client';

export interface BillingProject {
  project_id: number;
  project_name: string;
  client_name: string;
  attorney_in_charge: string;
  cm_numbers: string;
  bc_attorney_staff_id: number | null;
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
  staffing_project_id: number | null;
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
  cm_id: number;
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
  event_id: number;
  engagement_id: number;
  event_type: string | null;
  event_date: string | null;
  description: string | null;
  amount_usd: number | null;
  amount_cny: number | null;
  created_at: string | null;
  created_by: string | null;
}

export interface FinanceComment {
  comment_id: number;
  engagement_id: number;
  milestone_id: number | null;
  comment_text: string | null;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
}

export interface CMEngagementSummary {
  engagement_id: number;
  cm_id: number;
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
  engagement_id: number;
  cm_id: number;
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
    milestone_id: number;
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

// Get all billing projects
export const getBillingProjects = async (): Promise<BillingProject[]> => {
  const response = await apiClient.get('/billing/projects');
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
  data: {
    ubt_usd: number;
    ubt_cny: number;
    billing_credit_usd: number;
    billing_credit_cny: number;
  }
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
