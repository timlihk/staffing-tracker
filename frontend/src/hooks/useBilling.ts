/**
 * Billing Data Hooks
 *
 * TanStack Query hooks for billing data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import * as billingApi from '../api/billing';
import { toast } from 'sonner';

type FinancialUpdatePayload = Partial<{
  ubt_usd: number;
  ubt_cny: number;
  billing_credit_usd: number;
  billing_credit_cny: number;
  billing_usd: number;
  billing_cny: number;
  collection_usd: number;
  collection_cny: number;
}>;

// Query keys
export const billingKeys = {
  all: ['billing'] as const,
  projects: () => [...billingKeys.all, 'projects'] as const,
  projectSummary: (id: number) => [...billingKeys.all, 'project', id, 'summary'] as const,
  projectActivity: (id: number) => [...billingKeys.all, 'project', id, 'activity'] as const,
  cmEngagements: (projectId: number, cmId: number) =>
    [...billingKeys.all, 'project', projectId, 'cm', cmId] as const,
  engagement: (projectId: number, engagementId: number) =>
    [...billingKeys.all, 'project', projectId, 'engagement', engagementId] as const,
  settings: () => [...billingKeys.all, 'settings'] as const,
  mappingSuggestions: () => [...billingKeys.all, 'mapping-suggestions'] as const,
  unmappedAttorneys: () => [...billingKeys.all, 'unmapped-attorneys'] as const,
};

// Get all billing projects
export function useBillingProjects() {
  return useQuery({
    queryKey: billingKeys.projects(),
    queryFn: billingApi.getBillingProjects,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get billing project detail
export function useBillingProjectSummary(
  id: number,
  options?: { view?: 'summary' | 'full'; enabled?: boolean }
) {
  const view = options?.view ?? 'summary';
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: [...billingKeys.projectSummary(id), view],
    queryFn: () => billingApi.getBillingProjectSummary(id, { view }),
    enabled: enabled && !!id,
    staleTime: 60 * 1000,
  });
}

export function useBillingProjectActivity(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: billingKeys.projectActivity(id),
    queryFn: () => billingApi.getBillingProjectActivity(id),
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: 60 * 1000,
  });
}

export function useCMEngagements(projectId: number, cmId: number, enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.cmEngagements(projectId, cmId),
    queryFn: () => billingApi.getProjectCMEngagements(projectId, cmId),
    enabled: enabled && !!projectId && !!cmId,
    staleTime: 30 * 1000,
  });
}

export function useEngagementDetail(projectId: number, engagementId: number, enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.engagement(projectId, engagementId),
    queryFn: () => billingApi.getEngagementDetail(projectId, engagementId),
    enabled: enabled && !!projectId && !!engagementId,
    staleTime: 30 * 1000,
  });
}

// Update financials mutation
export function useUpdateFinancials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: FinancialUpdatePayload }) =>
      billingApi.updateFinancials(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.projects() });
      queryClient.invalidateQueries({ queryKey: billingKeys.projectSummary(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: billingKeys.projectActivity(variables.projectId) });
      toast.success('Financial data updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to update financial data'));
    },
  });
}

// Update fee arrangement
type UpdateFeeArrangementArgs = {
  projectId: number;
  engagementId: number;
  data: { raw_text: string; lsd_date?: string | null };
};

export function useUpdateFeeArrangement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ engagementId, data }: UpdateFeeArrangementArgs) =>
      billingApi.updateFeeArrangement(engagementId, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.projects() });
      queryClient.invalidateQueries({ queryKey: billingKeys.projectSummary(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: billingKeys.engagement(variables.projectId, variables.engagementId) });
      toast.success('Fee arrangement updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to update fee arrangement'));
    },
  });
}

// Update milestones
type UpdateMilestonesArgs = {
  projectId: number;
  cmId?: number;
  engagementId: number;
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
};

export function useUpdateMilestones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: UpdateMilestonesArgs) =>
      billingApi.updateMilestones({ milestones: variables.milestones }),
    onSuccess: async (_result, variables) => {
      // Simply invalidate and refetch the queries to get fresh data from the server
      // Remove optimistic update to avoid cache conflicts

      await queryClient.invalidateQueries({
        queryKey: billingKeys.engagement(variables.projectId, variables.engagementId),
      });
      if (variables.cmId) {
        await queryClient.invalidateQueries({
          queryKey: billingKeys.cmEngagements(variables.projectId, variables.cmId),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: billingKeys.projectSummary(variables.projectId),
      });
      await queryClient.invalidateQueries({
        queryKey: billingKeys.projects(),
      });

      toast.success('Milestones updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to update milestones'));
    },
  });
}

type CreateMilestoneArgs = {
  projectId: number;
  cmId?: number;
  engagementId: number;
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
  };
};

export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ engagementId, data }: CreateMilestoneArgs) =>
      billingApi.createMilestone(engagementId, data),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: billingKeys.engagement(variables.projectId, variables.engagementId),
      });
      if (variables.cmId) {
        await queryClient.invalidateQueries({
          queryKey: billingKeys.cmEngagements(variables.projectId, variables.cmId),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: billingKeys.projectSummary(variables.projectId),
      });
      toast.success('Milestone added successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to add milestone'));
    },
  });
}

type DeleteMilestoneArgs = {
  projectId: number;
  cmId?: number;
  engagementId: number;
  milestoneId: number;
};

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ milestoneId }: DeleteMilestoneArgs) => billingApi.deleteMilestone(milestoneId),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: billingKeys.engagement(variables.projectId, variables.engagementId),
      });
      if (variables.cmId) {
        await queryClient.invalidateQueries({
          queryKey: billingKeys.cmEngagements(variables.projectId, variables.cmId),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: billingKeys.projectSummary(variables.projectId),
      });
      toast.success('Milestone removed successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to remove milestone'));
    },
  });
}

// Get billing access settings
export function useBillingSettings() {
  return useQuery({
    queryKey: billingKeys.settings(),
    queryFn: billingApi.getBillingAccessSettings,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Update billing access settings
export function useUpdateBillingSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: billingApi.updateBillingAccessSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.settings() });
      toast.success('Billing settings updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to update billing settings'));
    },
  });
}

// Get mapping suggestions
export function useMappingSuggestions() {
  return useQuery({
    queryKey: billingKeys.mappingSuggestions(),
    queryFn: billingApi.getMappingSuggestions,
    staleTime: 5 * 60 * 1000,
  });
}

// Link projects mutation
export function useLinkProjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: billingApi.linkProjects,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.projects() });
      queryClient.invalidateQueries({ queryKey: billingKeys.mappingSuggestions() });
      toast.success('Projects linked successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to link projects'));
    },
  });
}

// Get unmapped attorneys
export function useUnmappedAttorneys() {
  return useQuery({
    queryKey: billingKeys.unmappedAttorneys(),
    queryFn: billingApi.getUnmappedAttorneys,
    staleTime: 5 * 60 * 1000,
  });
}

const extractBillingError = (error: unknown, fallback: string): string => {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
};
