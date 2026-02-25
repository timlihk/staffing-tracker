/**
 * Billing Data Hooks
 *
 * TanStack Query hooks for billing data
 */

import { useMemo } from 'react';
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
  triggers: (params?: Record<string, unknown>) => [...billingKeys.all, 'triggers', params ?? {}] as const,
  overdueByAttorney: (params?: Record<string, unknown>) => [...billingKeys.all, 'overdue-by-attorney', params ?? {}] as const,
  changeLog: (id: number) => [...billingKeys.all, 'project', id, 'change-log'] as const,
  pipelineInsights: () => [...billingKeys.all, 'pipeline-insights'] as const,
  financeSummary: (params?: Record<string, unknown>) => [...billingKeys.all, 'finance-summary', params ?? {}] as const,
  longStopRisks: (params?: Record<string, unknown>) => [...billingKeys.all, 'long-stop-risks', params ?? {}] as const,
  unpaidInvoices: (params?: Record<string, unknown>) => [...billingKeys.all, 'unpaid-invoices', params ?? {}] as const,
  notes: (id: number, engagementId?: number) => [...billingKeys.all, 'project', id, 'notes', engagementId ?? 'all'] as const,
};

// Get all billing projects
export function useBillingProjects(params?: { page?: number; limit?: number; search?: string; bcAttorney?: string }) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 100;
  const search = params?.search;
  const bcAttorney = params?.bcAttorney;

  const keyParams = useMemo(
    () => ({ page, limit, search: search ?? null, bcAttorney: bcAttorney ?? null }),
    [page, limit, search, bcAttorney]
  );

  return useQuery({
    queryKey: [...billingKeys.projects(), keyParams],
    queryFn: () => billingApi.getBillingProjects({ page, limit, search, bcAttorney }),
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

export function useBillingProjectChangeLog(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: billingKeys.changeLog(id),
    queryFn: () => billingApi.getBillingProjectChangeLog(id),
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

// Update billing project (C/M number, attorneys, etc.)
export function useUpdateBillingProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: Record<string, unknown> }) =>
      billingApi.updateBillingProject(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.projects() });
      queryClient.invalidateQueries({ queryKey: billingKeys.projectSummary(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: billingKeys.projectActivity(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: billingKeys.changeLog(variables.projectId) });
      toast.success('Billing information updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to update billing information'));
    },
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

type CreateEngagementArgs = {
  projectId: number;
  cmId: number;
  data: billingApi.CreateEngagementPayload;
};

export function useCreateEngagement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, cmId, data }: CreateEngagementArgs) =>
      billingApi.createEngagement(projectId, cmId, data),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: billingKeys.projectSummary(variables.projectId),
      });
      await queryClient.invalidateQueries({
        queryKey: billingKeys.cmEngagements(variables.projectId, variables.cmId),
      });
      toast.success('Engagement created successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to create engagement'));
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

type DeleteProjectArgs = {
  projectId: number;
};

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId }: DeleteProjectArgs) => billingApi.deleteProject(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: billingKeys.projects() });
      toast.success('Project deleted successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to delete project'));
    },
  });
}

type DeleteEngagementArgs = {
  projectId: number;
  cmId?: number;
  engagementId: number;
};

export function useDeleteEngagement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ engagementId }: DeleteEngagementArgs) => billingApi.deleteEngagement(engagementId),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: billingKeys.projectSummary(variables.projectId),
      });
      if (variables.cmId) {
        await queryClient.invalidateQueries({
          queryKey: billingKeys.cmEngagements(variables.projectId, variables.cmId),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: billingKeys.projects(),
      });
      toast.success('Engagement deleted successfully');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to delete engagement'));
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

export function useBillingTriggers(params?: {
  status?: 'pending' | 'confirmed' | 'rejected';
  staffingProjectId?: number;
  attorneyId?: number;
  startDate?: string;
  endDate?: string;
}) {
  const stableParams = useMemo(
    () => ({
      status: params?.status ?? null,
      staffingProjectId: params?.staffingProjectId ?? null,
      attorneyId: params?.attorneyId ?? null,
      startDate: params?.startDate ?? null,
      endDate: params?.endDate ?? null,
    }),
    [params?.status, params?.staffingProjectId, params?.attorneyId, params?.startDate, params?.endDate]
  );

  return useQuery({
    queryKey: billingKeys.triggers(stableParams),
    queryFn: () => billingApi.getBillingTriggers(params),
    staleTime: 30 * 1000,
  });
}

export function useOverdueByAttorney(params?: {
  attorneyId?: number;
  minAmount?: number;
  startDate?: string;
  endDate?: string;
}) {
  const stableParams = useMemo(
    () => ({
      attorneyId: params?.attorneyId ?? null,
      minAmount: params?.minAmount ?? null,
      startDate: params?.startDate ?? null,
      endDate: params?.endDate ?? null,
    }),
    [params?.attorneyId, params?.minAmount, params?.startDate, params?.endDate]
  );

  return useQuery({
    queryKey: billingKeys.overdueByAttorney(stableParams),
    queryFn: () => billingApi.getOverdueByAttorney(params),
    staleTime: 30 * 1000,
  });
}

export function useBillingPipelineInsights() {
  return useQuery({
    queryKey: billingKeys.pipelineInsights(),
    queryFn: () => billingApi.getBillingPipelineInsights(),
    staleTime: 30 * 1000,
  });
}

export function useBillingFinanceSummary(params?: {
  attorneyId?: number;
}) {
  const stableParams = useMemo(
    () => ({
      attorneyId: params?.attorneyId ?? null,
    }),
    [params?.attorneyId]
  );

  return useQuery({
    queryKey: billingKeys.financeSummary(stableParams),
    queryFn: () => billingApi.getBillingFinanceSummary(params),
    staleTime: 30 * 1000,
  });
}

export function useLongStopRisks(params?: {
  attorneyId?: number;
  windowDays?: number;
  minUbtAmount?: number;
  limit?: number;
}) {
  const stableParams = useMemo(
    () => ({
      attorneyId: params?.attorneyId ?? null,
      windowDays: params?.windowDays ?? 30,
      minUbtAmount: params?.minUbtAmount ?? null,
      limit: params?.limit ?? 500,
    }),
    [params?.attorneyId, params?.windowDays, params?.minUbtAmount, params?.limit]
  );

  return useQuery({
    queryKey: billingKeys.longStopRisks(stableParams),
    queryFn: () => billingApi.getLongStopRisks(params),
    staleTime: 30 * 1000,
  });
}

export function useUnpaidInvoices(params?: {
  attorneyId?: number;
  thresholdDays?: number;
  minAmount?: number;
  limit?: number;
}) {
  const stableParams = useMemo(
    () => ({
      attorneyId: params?.attorneyId ?? null,
      thresholdDays: params?.thresholdDays ?? 30,
      minAmount: params?.minAmount ?? null,
      limit: params?.limit ?? 1000,
    }),
    [params?.attorneyId, params?.thresholdDays, params?.minAmount, params?.limit]
  );

  return useQuery({
    queryKey: billingKeys.unpaidInvoices(stableParams),
    queryFn: () => billingApi.getUnpaidInvoices(params),
    staleTime: 30 * 1000,
  });
}

export function useTimeWindowedMetrics() {
  return useQuery({
    queryKey: [...billingKeys.all, 'time-windowed-metrics'] as const,
    queryFn: billingApi.getTimeWindowedMetrics,
    staleTime: 60 * 1000,
  });
}

export function useConfirmBillingTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: billingApi.confirmBillingTrigger,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.triggers() });
      queryClient.invalidateQueries({ queryKey: billingKeys.overdueByAttorney() });
      queryClient.invalidateQueries({ queryKey: billingKeys.projects() });
      queryClient.invalidateQueries({ queryKey: billingKeys.pipelineInsights() });
      queryClient.invalidateQueries({ queryKey: billingKeys.financeSummary() });
      queryClient.invalidateQueries({ queryKey: billingKeys.unpaidInvoices() });
      toast.success('Trigger confirmed');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to confirm trigger'));
    },
  });
}

export function useRejectBillingTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: billingApi.rejectBillingTrigger,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.triggers() });
      queryClient.invalidateQueries({ queryKey: billingKeys.overdueByAttorney() });
      queryClient.invalidateQueries({ queryKey: billingKeys.pipelineInsights() });
      queryClient.invalidateQueries({ queryKey: billingKeys.financeSummary() });
      toast.success('Trigger rejected');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to reject trigger'));
    },
  });
}

export function useUpdateTriggerActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: {
      id: number;
      data: Partial<{
        actionType: string;
        description: string;
        dueDate: string | null;
        status: 'pending' | 'completed' | 'cancelled';
        assignedTo: number | null;
      }>;
    }) => billingApi.updateTriggerActionItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.triggers() });
      queryClient.invalidateQueries({ queryKey: billingKeys.pipelineInsights() });
      queryClient.invalidateQueries({ queryKey: billingKeys.financeSummary() });
      queryClient.invalidateQueries({ queryKey: billingKeys.unpaidInvoices() });
      toast.success('Trigger action updated');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to update trigger action'));
    },
  });
}

export function useBillingNotes(projectId: number, engagementId?: number) {
  return useQuery({
    queryKey: billingKeys.notes(projectId, engagementId),
    queryFn: () => billingApi.getBillingNotes(projectId, engagementId),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

export function useCreateBillingNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, content, engagementId }: { projectId: number; content: string; engagementId?: number }) =>
      billingApi.createBillingNote(projectId, content, engagementId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.notes(variables.projectId, variables.engagementId) });
      toast.success('Note added');
    },
    onError: (error: unknown) => {
      toast.error(extractBillingError(error, 'Failed to add note'));
    },
  });
}

const extractBillingError = (error: unknown, fallback: string): string => {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
};
