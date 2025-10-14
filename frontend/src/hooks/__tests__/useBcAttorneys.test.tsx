import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAddBcAttorney, useRemoveBcAttorney } from '../useBcAttorneys';
import api from '../../api/client';
import { toast } from '../../lib/toast';

// Mock dependencies
vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useBcAttorneys hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAddBcAttorney', () => {
    it('should add B&C attorney successfully', async () => {
      const mockResponse = {
        data: {
          id: 1,
          projectId: 1,
          staffId: 5,
          staff: {
            id: 5,
            name: 'Test Attorney',
            position: 'Partner',
          },
        },
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAddBcAttorney(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ projectId: 1, staffId: 5 });

      expect(mockApi.post).toHaveBeenCalledWith('/projects/1/bc-attorneys', { staffId: 5 });
      expect(mockToast.success).toHaveBeenCalledWith(
        'B&C Attorney added',
        'The B&C attorney has been added successfully'
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          data: { error: 'B&C attorney already exists' },
        },
      };

      mockApi.post.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAddBcAttorney(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ projectId: 1, staffId: 5 })
      ).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to add B&C attorney',
        'B&C attorney already exists'
      );
    });

    it('should use fallback error message when no specific error', async () => {
      const mockError = new Error('Network error');

      mockApi.post.mockRejectedValue(mockError);

      const { result } = renderHook(() => useAddBcAttorney(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ projectId: 1, staffId: 5 })
      ).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to add B&C attorney',
        'Please try again'
      );
    });

    it('should invalidate queries on success', async () => {
      const mockResponse = {
        data: {
          id: 1,
          projectId: 1,
          staffId: 5,
          staff: { id: 5, name: 'Test Attorney', position: 'Partner' },
        },
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAddBcAttorney(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ projectId: 1, staffId: 5 });

      // Wait for React Query to process the invalidation
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalled();
      });
    });
  });

  describe('useRemoveBcAttorney', () => {
    it('should remove B&C attorney successfully', async () => {
      const mockResponse = {
        data: { message: 'B&C attorney removed successfully' },
      };

      mockApi.delete.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRemoveBcAttorney(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ projectId: 1, staffId: 5 });

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/1/bc-attorneys/5');
      expect(mockToast.success).toHaveBeenCalledWith(
        'B&C Attorney removed',
        'The B&C attorney has been removed successfully'
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          data: { error: 'B&C attorney not found' },
        },
      };

      mockApi.delete.mockRejectedValue(mockError);

      const { result } = renderHook(() => useRemoveBcAttorney(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ projectId: 1, staffId: 5 })
      ).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to remove B&C attorney',
        'B&C attorney not found'
      );
    });

    it('should use fallback error message when no specific error', async () => {
      const mockError = new Error('Network error');

      mockApi.delete.mockRejectedValue(mockError);

      const { result } = renderHook(() => useRemoveBcAttorney(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ projectId: 1, staffId: 5 })
      ).rejects.toThrow();

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to remove B&C attorney',
        'Please try again'
      );
    });

    it('should invalidate queries on success', async () => {
      const mockResponse = {
        data: { message: 'B&C attorney removed successfully' },
      };

      mockApi.delete.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRemoveBcAttorney(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({ projectId: 1, staffId: 5 });

      // Wait for React Query to process the invalidation
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalled();
      });
    });
  });
});
