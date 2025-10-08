import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSmartBack } from '../hooks/useSmartBack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  MenuItem,
  CircularProgress,
  Stack,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import { Page } from '../components/ui';
import { staffSchema, type StaffFormData } from '../lib/validations';
import { useStaffMember, useCreateStaff, useUpdateStaff } from '../hooks/useStaff';

const StaffForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const goBack = useSmartBack('/staff');
  const isEdit = !!id && id !== 'new';

  console.log('[STAFF FORM] ID from params:', id, 'isEdit:', isEdit);

  const { data: staff, isLoading: staffLoading } = useStaffMember(isEdit ? id! : '');
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
      department: '',
      status: 'active',
      notes: '',
    },
  });

  useEffect(() => {
    if (isEdit && staff) {
      reset({
        name: staff.name,
        email: staff.email || '',
        role: staff.position,
        department: staff.department || '',
        status: staff.status,
        notes: staff.notes || '',
      });
    }
  }, [staff, isEdit, reset]);

  const onSubmit = async (data: StaffFormData) => {
    try {
      console.log('[STAFF FORM] onSubmit called', { isEdit, id, data });
      if (isEdit) {
        console.log('[STAFF FORM] Calling updateStaff with id:', Number(id));
        await updateStaff.mutateAsync({ id: Number(id), data });
      } else {
        console.log('[STAFF FORM] Calling createStaff');
        await createStaff.mutateAsync(data);
      }
      navigate('/staff');
    } catch (error) {
      // Error handling is done in the mutation hooks with toast notifications
      console.error('Failed to save staff:', error);
    }
  };

  if (staffLoading) {
    return (
      <Page title="Loading...">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Page>
    );
  }

  return (
    <Page
      title={
        <Stack direction="row" spacing={2} alignItems="center">
          <Button startIcon={<ArrowBack />} onClick={goBack}>
            Back
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {isEdit ? 'Edit Staff' : 'New Staff'}
          </Typography>
        </Stack>
      }
    >
      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Name"
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              disabled={isSubmitting}
            />

            <TextField
              fullWidth
              type="email"
              label="Email"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
              disabled={isSubmitting}
            />

            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Role"
                  error={!!errors.role}
                  helperText={errors.role?.message}
                  disabled={isSubmitting}
                >
                  <MenuItem value="Partner">Partner</MenuItem>
                  <MenuItem value="Associate">Associate</MenuItem>
                  <MenuItem value="Senior FLIC">Senior FLIC</MenuItem>
                  <MenuItem value="Junior FLIC">Junior FLIC</MenuItem>
                  <MenuItem value="Intern">Intern</MenuItem>
                  <MenuItem value="B&C Working Attorney">B&C Working Attorney</MenuItem>
                </TextField>
              )}
            />

            <Controller
              name="department"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  select
                  fullWidth
                  label="Department"
                  error={!!errors.department}
                  helperText={errors.department?.message}
                  disabled={isSubmitting}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="US Law">US Law</MenuItem>
                  <MenuItem value="HK Law">HK Law</MenuItem>
                </TextField>
              )}
            />

            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Status"
                  error={!!errors.status}
                  helperText={errors.status?.message}
                  disabled={isSubmitting}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="leaving">Leaving</MenuItem>
                </TextField>
              )}
            />

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Notes"
              {...register('notes')}
              error={!!errors.notes}
              helperText={errors.notes?.message}
              disabled={isSubmitting}
            />

            <Box display="flex" gap={2} pt={1}>
              <Button
                type="submit"
                variant="contained"
                startIcon={isSubmitting ? <CircularProgress size={20} /> : <Save />}
                disabled={isSubmitting}
              >
                {isEdit ? 'Update' : 'Create'} Staff
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/staff')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Page>
  );
};

export default StaffForm;
