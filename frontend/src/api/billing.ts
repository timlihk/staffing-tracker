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

export interface BillingProjectDetail {
  project: BillingProject;
  engagements: any[];
  feeArrangements: any[];
  events: any[];
  financeComments: any[];
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

// Get billing project detail
export const getBillingProjectDetail = async (id: number): Promise<BillingProjectDetail> => {
  const response = await apiClient.get(`/billing/projects/${id}`);
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
