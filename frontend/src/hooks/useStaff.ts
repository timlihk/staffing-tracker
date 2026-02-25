import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../api/client';
import type { Staff } from '../types';
import { toast } from '../lib/toast';

interface StaffParams {
  position?: string;
  department?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface StaffResponse {
  data: Staff[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const useStaff = (params: StaffParams = {}) => {
  const { enabled, ...queryParams } = params;
  return useQuery({
    queryKey: ['staff', queryParams],
    queryFn: async () => {
      const response = await api.get<StaffResponse>('/staff', { params: queryParams });
      return response.data;
    },
    enabled: enabled ?? true,
    staleTime: 10 * 60 * 1000, // 10 minutes — staff data rarely changes
  });
};

export const useStaffMember = (id: string | number) => {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: async () => {
      const response = await api.get<Staff>(`/staff/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Staff>) => {
      // Convert empty strings to null for optional fields
      const cleanedData = {
        ...data,
        email: data.email === '' ? null : data.email,
        department: data.department === '' ? null : data.department,
        notes: data.notes === '' ? null : data.notes,
      };
      const response = await api.post<Staff>('/staff', cleanedData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Staff member created', 'The staff member has been created successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to create staff member', extractStaffError(error, 'Please try again'));
    },
  });
};

export const useUpdateStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Staff> }) => {
      // Convert empty strings to null for optional fields
      const cleanedData = {
        ...data,
        email: data.email === '' ? null : data.email,
        department: data.department === '' ? null : data.department,
        notes: data.notes === '' ? null : data.notes,
      };
      const response = await api.put<Staff>(`/staff/${id}`, cleanedData);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Staff member updated', 'The staff member has been updated successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to update staff member', extractStaffError(error, 'Please try again'));
    },
  });
};

export const useDeleteStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Staff member deleted', 'The staff member has been deleted successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete staff member', extractStaffError(error, 'Please try again'));
    },
  });
};

const extractStaffError = (error: unknown, fallback: string): string => {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }
  return fallback;
};
