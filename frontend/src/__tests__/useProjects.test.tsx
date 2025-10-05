import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useConfirmProject,
} from '../hooks/useProjects';
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

describe('useProjects Hook', () => {
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

  describe('useProjects', () => {
    it('should fetch all projects successfully', async () => {
      const mockProjects = {
        data: [
          {
            id: 1,
            name: 'Project Alpha',
            category: 'HK Trx',
            status: 'Active',
          },
          {
            id: 2,
            name: 'Project Beta',
            category: 'US Trx',
            status: 'Active',
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          totalPages: 1,
        },
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockProjects });

      const { result } = renderHook(() => useProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toHaveLength(2);
      expect(result.current.data?.pagination.total).toBe(2);
      expect(mockApiClient.get).toHaveBeenCalledWith('/projects', { params: {} });
    });

    it('should fetch projects with filters', async () => {
      const mockProjects = {
        data: [
          {
            id: 1,
            name: 'Project Alpha',
            category: 'HK Trx',
            status: 'Active',
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockProjects });

      const { result } = renderHook(
        () => useProjects({ status: 'Active', category: 'HK Trx' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiClient.get).toHaveBeenCalledWith('/projects', {
        params: { status: 'Active', category: 'HK Trx' },
      });
    });

    it('should handle error state', async () => {
      const mockError = {
        response: {
          data: { error: 'Failed to fetch projects' },
          status: 500,
        },
      };

      mockApiClient.get.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useProjects(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('useProject', () => {
    it('should fetch a single project by id', async () => {
      const mockProject = {
        id: 1,
        name: 'Project Alpha',
        category: 'HK Trx',
        status: 'Active',
        assignments: [],
      };

      mockApiClient.get.mockResolvedValueOnce({ data: mockProject });

      const { result } = renderHook(() => useProject(1), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toMatchObject({
        id: 1,
        name: 'Project Alpha',
      });
      expect(mockApiClient.get).toHaveBeenCalledWith('/projects/1');
    });

    it('should not fetch when id is not provided', () => {
      const { result } = renderHook(() => useProject(''), { wrapper });

      expect(result.current.isFetching).toBe(false);
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('should handle 404 error', async () => {
      const mockError = {
        response: {
          data: { error: 'Project not found' },
          status: 404,
        },
      };

      mockApiClient.get.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useProject(999), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useCreateProject', () => {
    it('should create a new project', async () => {
      const newProject = {
        name: 'New Project',
        category: 'HK Trx',
        status: 'Active',
      };

      const mockCreatedProject = {
        id: 3,
        ...newProject,
        createdAt: new Date().toISOString(),
      };

      mockApiClient.post.mockResolvedValueOnce({ data: mockCreatedProject });

      const { result } = renderHook(() => useCreateProject(), { wrapper });

      await result.current.mutateAsync(newProject);

      expect(mockApiClient.post).toHaveBeenCalledWith('/projects', newProject);
      expect(mockToast.success).toHaveBeenCalledWith(
        'Project created',
        'The project has been created successfully'
      );
    });

    it('should invalidate queries after successful creation', async () => {
      const newProject = { name: 'New Project' };
      const mockCreatedProject = { id: 3, ...newProject };

      mockApiClient.post.mockResolvedValueOnce({ data: mockCreatedProject });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateProject(), { wrapper });

      await result.current.mutateAsync(newProject);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should handle creation errors', async () => {
      const mockError = {
        response: {
          data: { error: 'Validation failed' },
          status: 400,
        },
      };

      mockApiClient.post.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useCreateProject(), { wrapper });

      await expect(
        result.current.mutateAsync({ name: 'New Project' })
      ).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to create project',
        'Validation failed'
      );
    });
  });

  describe('useUpdateProject', () => {
    it('should update a project', async () => {
      const updateData = {
        id: 1,
        data: { name: 'Updated Name', status: 'Suspended' },
      };

      const mockUpdatedProject = {
        id: 1,
        name: 'Updated Name',
        status: 'Suspended',
      };

      mockApiClient.put.mockResolvedValueOnce({ data: mockUpdatedProject });

      const { result } = renderHook(() => useUpdateProject(), { wrapper });

      await result.current.mutateAsync(updateData);

      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/projects/1',
        updateData.data
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Project updated',
        'The project has been updated successfully'
      );
    });

    it('should invalidate project-specific queries', async () => {
      const updateData = {
        id: 1,
        data: { name: 'Updated' },
      };

      mockApiClient.put.mockResolvedValueOnce({ data: { id: 1 } });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateProject(), { wrapper });

      await result.current.mutateAsync(updateData);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project', 1] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should handle update errors', async () => {
      const mockError = {
        response: {
          data: { error: 'Project not found' },
          status: 404,
        },
      };

      mockApiClient.put.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useUpdateProject(), { wrapper });

      await expect(
        result.current.mutateAsync({ id: 999, data: { name: 'Updated' } })
      ).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to update project',
        'Project not found'
      );
    });
  });

  describe('useDeleteProject', () => {
    it('should delete a project', async () => {
      mockApiClient.delete.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useDeleteProject(), { wrapper });

      await result.current.mutateAsync(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/projects/1');
      expect(mockToast.success).toHaveBeenCalledWith(
        'Project deleted',
        'The project has been deleted successfully'
      );
    });

    it('should invalidate queries after deletion', async () => {
      mockApiClient.delete.mockResolvedValueOnce({ data: {} });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteProject(), { wrapper });

      await result.current.mutateAsync(1);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });

    it('should handle deletion errors', async () => {
      const mockError = {
        response: {
          data: { error: 'Cannot delete project with assignments' },
          status: 400,
        },
      };

      mockApiClient.delete.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useDeleteProject(), { wrapper });

      await expect(result.current.mutateAsync(1)).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to delete project',
        'Cannot delete project with assignments'
      );
    });
  });

  describe('useConfirmProject', () => {
    it('should confirm a project', async () => {
      const mockResponse = {
        message: 'Project confirmed',
        project: {
          id: 1,
          name: 'Project Alpha',
          lastConfirmedAt: new Date().toISOString(),
        },
      };

      mockApiClient.post.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useConfirmProject(), { wrapper });

      await result.current.mutateAsync(1);

      expect(mockApiClient.post).toHaveBeenCalledWith('/projects/1/confirm');
      expect(mockToast.success).toHaveBeenCalledWith(
        'Project confirmed',
        'Project details have been confirmed'
      );
    });

    it('should invalidate needing-attention queries', async () => {
      const mockResponse = {
        message: 'Project confirmed',
        project: { id: 1 },
      };

      mockApiClient.post.mockResolvedValueOnce({ data: mockResponse });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useConfirmProject(), { wrapper });

      await result.current.mutateAsync(1);

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project', 1] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['projects-needing-attention'],
      });
    });

    it('should handle confirmation errors', async () => {
      const mockError = {
        response: {
          data: { error: 'Project not found' },
          status: 404,
        },
      };

      mockApiClient.post.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useConfirmProject(), { wrapper });

      await expect(result.current.mutateAsync(1)).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to confirm project',
        'Project not found'
      );
    });
  });
});
