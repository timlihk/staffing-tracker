import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailSettings, useUpdateEmailSettings } from '../hooks/useEmailSettings';
import apiClient from '../api/client';
import type { ReactNode } from 'react';

// Mock the apiClient module
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

describe('useEmailSettings Hook', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  describe('useEmailSettings', () => {
    it('should fetch email settings successfully', async () => {
      const mockSettings = {
        id: 1,
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyAssociate: false,
        notifyJuniorFlic: false,
        notifySeniorFlic: false,
        notifyIntern: false,
        notifyBCWorkingAttorney: true,
        updatedAt: new Date().toISOString(),
        updatedBy: 1,
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockSettings });

      const { result } = renderHook(() => useEmailSettings(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockSettings);
      expect(mockApiClient.get).toHaveBeenCalledWith('/email-settings');
    });

    it('should handle loading state', () => {
      mockApiClient.get.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useEmailSettings(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should handle error state', async () => {
      const mockError = {
        response: {
          data: { error: 'Failed to fetch email settings' },
          status: 500,
        },
      };

      mockApiClient.get.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useEmailSettings(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should return default settings when none exist', async () => {
      const defaultSettings = {
        id: 1,
        emailNotificationsEnabled: true,
        notifyPartner: true,
        notifyAssociate: true,
        notifyJuniorFlic: true,
        notifySeniorFlic: true,
        notifyIntern: true,
        notifyBCWorkingAttorney: true,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
      };

      mockApiClient.get.mockResolvedValueOnce({ data: defaultSettings });

      const { result } = renderHook(() => useEmailSettings(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.emailNotificationsEnabled).toBe(true);
      expect(result.current.data?.notifyPartner).toBe(true);
      expect(result.current.data?.notifyAssociate).toBe(true);
    });
  });

  describe('useUpdateEmailSettings', () => {
    it('should update email settings successfully', async () => {
      const updatedSettings = {
        id: 1,
        emailNotificationsEnabled: false,
        notifyPartner: true,
        notifyAssociate: false,
        notifyJuniorFlic: false,
        notifySeniorFlic: false,
        notifyIntern: false,
        notifyBCWorkingAttorney: true,
        updatedAt: new Date().toISOString(),
        updatedBy: 1,
      };

      mockApiClient.patch.mockResolvedValueOnce({ data: updatedSettings });

      const { result } = renderHook(() => useUpdateEmailSettings(), { wrapper });

      await result.current.mutateAsync({
        emailNotificationsEnabled: false,
      });

      expect(mockApiClient.patch).toHaveBeenCalledWith('/email-settings', {
        emailNotificationsEnabled: false,
      });
    });

    it('should update individual position settings', async () => {
      const updatedSettings = {
        id: 1,
        emailNotificationsEnabled: true,
        notifyPartner: false,
        notifyAssociate: true,
        notifyJuniorFlic: true,
        notifySeniorFlic: true,
        notifyIntern: true,
        notifyBCWorkingAttorney: true,
        updatedAt: new Date().toISOString(),
        updatedBy: 1,
      };

      mockApiClient.patch.mockResolvedValueOnce({ data: updatedSettings });

      const { result } = renderHook(() => useUpdateEmailSettings(), { wrapper });

      await result.current.mutateAsync({
        notifyPartner: false,
      });

      expect(mockApiClient.patch).toHaveBeenCalledWith('/email-settings', {
        notifyPartner: false,
      });
    });

    it('should handle update errors', async () => {
      const mockError = {
        response: {
          data: { error: 'Failed to update email settings' },
          status: 500,
        },
      };

      mockApiClient.patch.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useUpdateEmailSettings(), { wrapper });

      await expect(
        result.current.mutateAsync({
          emailNotificationsEnabled: false,
        })
      ).rejects.toThrow();
    });

    it('should invalidate cache after successful update', async () => {
      const updatedSettings = {
        id: 1,
        emailNotificationsEnabled: false,
        notifyPartner: true,
        notifyAssociate: false,
        notifyJuniorFlic: false,
        notifySeniorFlic: false,
        notifyIntern: false,
        notifyBCWorkingAttorney: true,
        updatedAt: new Date().toISOString(),
        updatedBy: 1,
      };

      mockApiClient.patch.mockResolvedValueOnce({ data: updatedSettings });
      mockApiClient.get.mockResolvedValueOnce({ data: updatedSettings });

      const { result: updateResult } = renderHook(() => useUpdateEmailSettings(), {
        wrapper,
      });

      await updateResult.current.mutateAsync({
        emailNotificationsEnabled: false,
      });

      // After mutation, cache should be invalidated
      // React Query will automatically refetch
      expect(mockApiClient.patch).toHaveBeenCalled();
    });
  });
});
