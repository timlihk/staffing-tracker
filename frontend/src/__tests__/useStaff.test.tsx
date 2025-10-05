import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useStaff,
  useStaffMember,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
} from '../hooks/useStaff';
import apiClient from '../api/client';
import * as toast from '../lib/toast';
import type { ReactNode } from 'react';

// Mock the apiClient module
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock toast
vi.mock('../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);
const mockToast = vi.mocked(toast.toast);

describe('useStaff Hook', () => {
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

  describe('useStaff', () => {
    it('should fetch all staff members successfully', async () => {
      const mockStaff = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          position: 'Partner',
          department: 'US Law',
          status: 'active',
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          position: 'Associate',
          department: 'HK Law',
          status: 'active',
        },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockStaff });

      const { result } = renderHook(() => useStaff(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0]).toMatchObject({
        id: 1,
        name: 'John Doe',
        position: 'Partner',
      });
      expect(mockApiClient.get).toHaveBeenCalledWith('/staff', { params: {} });
    });

    it('should fetch staff with filters', async () => {
      const mockStaff = [
        {
          id: 1,
          name: 'John Doe',
          position: 'Partner',
          department: 'US Law',
        },
      ];

      mockApiClient.get.mockResolvedValueOnce({ data: mockStaff });

      const { result } = renderHook(
        () => useStaff({ role: 'Partner', department: 'US Law' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.get).toHaveBeenCalledWith('/staff', {
        params: { role: 'Partner', department: 'US Law' },
      });
    });

    it('should handle loading state', () => {
      mockApiClient.get.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useStaff(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should handle error state', async () => {
      const mockError = {
        response: {
          data: { error: 'Failed to fetch staff' },
          status: 500,
        },
      };

      mockApiClient.get.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useStaff(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('useStaffMember', () => {
    it('should fetch a single staff member by id', async () => {
      const mockStaffMember = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        position: 'Partner',
        department: 'US Law',
        status: 'active',
        assignments: [
          {
            id: 1,
            projectId: 5,
            project: {
              id: 5,
              name: 'Project Alpha',
              status: 'Active',
            },
          },
        ],
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockStaffMember });

      const { result } = renderHook(() => useStaffMember(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toMatchObject({
        id: 1,
        name: 'John Doe',
        position: 'Partner',
      });
      expect(result.current.data?.assignments).toHaveLength(1);
      expect(mockApiClient.get).toHaveBeenCalledWith('/staff/1');
    });

    it('should not fetch when id is not provided', () => {
      const { result } = renderHook(() => useStaffMember(''), { wrapper });

      expect(result.current.isFetching).toBe(false);
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('should handle 404 error', async () => {
      const mockError = {
        response: {
          data: { error: 'Staff member not found' },
          status: 404,
        },
      };

      mockApiClient.get.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useStaffMember(999), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useCreateStaff', () => {
    it('should create a new staff member', async () => {
      const newStaff = {
        name: 'New Staff',
        email: 'newstaff@example.com',
        role: 'Associate',
        department: 'HK Law',
      };

      const mockCreatedStaff = {
        id: 3,
        name: 'New Staff',
        email: 'newstaff@example.com',
        position: 'Associate',
        department: 'HK Law',
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      mockApiClient.post.mockResolvedValueOnce({ data: mockCreatedStaff });

      const { result } = renderHook(() => useCreateStaff(), { wrapper });

      await result.current.mutateAsync(newStaff);

      expect(mockApiClient.post).toHaveBeenCalledWith('/staff', newStaff);
      expect(mockToast.success).toHaveBeenCalledWith(
        'Staff member created',
        'The staff member has been created successfully'
      );
    });

    it('should invalidate queries after successful creation', async () => {
      const newStaff = { name: 'New Staff', role: 'Associate' };
      const mockCreatedStaff = { id: 3, ...newStaff };

      mockApiClient.post.mockResolvedValueOnce({ data: mockCreatedStaff });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateStaff(), { wrapper });

      await result.current.mutateAsync(newStaff);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['staff'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should handle creation errors', async () => {
      const mockError = {
        response: {
          data: { error: 'Name and role are required' },
          status: 400,
        },
      };

      mockApiClient.post.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useCreateStaff(), { wrapper });

      await expect(
        result.current.mutateAsync({ email: 'test@example.com' })
      ).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to create staff member',
        'Name and role are required'
      );
    });
  });

  describe('useUpdateStaff', () => {
    it('should update a staff member', async () => {
      const updateData = {
        id: 1,
        data: { name: 'Updated Name', email: 'updated@example.com' },
      };

      const mockUpdatedStaff = {
        id: 1,
        name: 'Updated Name',
        email: 'updated@example.com',
        position: 'Partner',
        department: 'US Law',
        status: 'active',
      };

      mockApiClient.put.mockResolvedValueOnce({ data: mockUpdatedStaff });

      const { result } = renderHook(() => useUpdateStaff(), { wrapper });

      await result.current.mutateAsync(updateData);

      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/staff/1',
        updateData.data
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Staff member updated',
        'The staff member has been updated successfully'
      );
    });

    it('should invalidate staff-specific queries', async () => {
      const updateData = {
        id: 1,
        data: { name: 'Updated' },
      };

      mockApiClient.put.mockResolvedValueOnce({ data: { id: 1 } });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateStaff(), { wrapper });

      await result.current.mutateAsync(updateData);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['staff'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['staff', 1] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should handle update errors', async () => {
      const mockError = {
        response: {
          data: { error: 'Staff member not found' },
          status: 404,
        },
      };

      mockApiClient.put.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useUpdateStaff(), { wrapper });

      await expect(
        result.current.mutateAsync({ id: 999, data: { name: 'Updated' } })
      ).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to update staff member',
        'Staff member not found'
      );
    });
  });

  describe('useDeleteStaff', () => {
    it('should delete a staff member', async () => {
      mockApiClient.delete.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useDeleteStaff(), { wrapper });

      await result.current.mutateAsync(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/staff/1');
      expect(mockToast.success).toHaveBeenCalledWith(
        'Staff member deleted',
        'The staff member has been deleted successfully'
      );
    });

    it('should invalidate queries after deletion', async () => {
      mockApiClient.delete.mockResolvedValueOnce({ data: {} });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteStaff(), { wrapper });

      await result.current.mutateAsync(1);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['staff'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should handle deletion errors', async () => {
      const mockError = {
        response: {
          data: { error: 'Cannot delete staff with active assignments' },
          status: 400,
        },
      };

      mockApiClient.delete.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useDeleteStaff(), { wrapper });

      await expect(result.current.mutateAsync(1)).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to delete staff member',
        'Cannot delete staff with active assignments'
      );
    });
  });
});
