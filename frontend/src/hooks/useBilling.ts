/**
 * Billing Data Hooks
 *
 * TanStack Query hooks for billing data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as billingApi from '../api/billing';
import { toast } from 'sonner';

// Query keys
export const billingKeys = {
  all: ['billing'] as const,
  projects: () => [...billingKeys.all, 'projects'] as const,
  project: (id: number) => [...billingKeys.all, 'project', id] as const,
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
export function useBillingProject(id: number) {
  return useQuery({
    queryKey: billingKeys.project(id),
    queryFn: () => billingApi.getBillingProjectDetail(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Update financials mutation
export function useUpdateFinancials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: any }) =>
      billingApi.updateFinancials(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.projects() });
      queryClient.invalidateQueries({ queryKey: billingKeys.project(variables.projectId) });
      toast.success('Financial data updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update financial data');
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
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update billing settings');
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
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to link projects');
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
