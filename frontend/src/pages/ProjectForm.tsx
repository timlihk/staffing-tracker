import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  MenuItem,
  CircularProgress,
  Stack,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import { Page } from '../components/ui';
import { projectSchema, type ProjectFormData } from '../lib/validations';
import { useProject, useCreateProject, useUpdateProject } from '../hooks/useProjects';
import { useStaff } from '../hooks/useStaff';

const ProjectForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = id !== 'new';

  const { data: project, isLoading: projectLoading } = useProject(isEdit ? id! : '');
  const { data: staffList = [], isLoading: staffLoading } = useStaff();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      category: '',
      status: 'Active',
      priority: 'Medium',
      elStatus: '',
      timetable: undefined,
      bcAttorney: '',
      filingDate: '',
      listingDate: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (isEdit && project) {
      reset({
        name: project.name,
        category: project.category,
        status: project.status,
        priority: project.priority || 'Medium',
        elStatus: project.elStatus || '',
        timetable: project.timetable,
        bcAttorney: project.bcAttorney || '',
        filingDate: project.filingDate ? project.filingDate.slice(0, 10) : '',
        listingDate: project.listingDate ? project.listingDate.slice(0, 10) : '',
        notes: project.notes || '',
      });
    }
  }, [project, isEdit, reset]);

  const onSubmit = async (data: ProjectFormData) => {
    try {
      if (isEdit) {
        await updateProject.mutateAsync({ id: Number(id), data });
      } else {
        await createProject.mutateAsync(data);
      }
      navigate('/projects');
    } catch (error) {
      // Error handling is done in the mutation hooks with toast notifications
      console.error('Failed to save project:', error);
    }
  };

  if (projectLoading) {
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
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/projects')}>
            Back
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {isEdit ? 'Edit Project' : 'New Project'}
          </Typography>
        </Stack>
      }
    >
      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Project Code"
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              disabled={isSubmitting}
            />

            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Category"
                  error={!!errors.category}
                  helperText={errors.category?.message}
                  disabled={isSubmitting}
                >
                  <MenuItem value="HK Trx">HK Trx</MenuItem>
                  <MenuItem value="US Trx">US Trx</MenuItem>
                  <MenuItem value="HK Comp">HK Comp</MenuItem>
                  <MenuItem value="US Comp">US Comp</MenuItem>
                  <MenuItem value="Others">Others</MenuItem>
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
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Slow-down">Slow-down</MenuItem>
                  <MenuItem value="Suspended">Suspended</MenuItem>
                </TextField>
              )}
            />

            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Priority"
                  error={!!errors.priority}
                  helperText={errors.priority?.message}
                  disabled={isSubmitting}
                >
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="Low">Low</MenuItem>
                </TextField>
              )}
            />

            <Controller
              name="elStatus"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="EL Status"
                  error={!!errors.elStatus}
                  helperText={errors.elStatus?.message}
                  disabled={isSubmitting}
                  value={field.value || ''}
                >
                  <MenuItem value="Signed">Signed</MenuItem>
                  <MenuItem value="Not Signed">Not Signed</MenuItem>
                </TextField>
              )}
            />

            <Controller
              name="timetable"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  select
                  fullWidth
                  label="Timetable"
                  error={!!errors.timetable}
                  helperText={errors.timetable?.message}
                  disabled={isSubmitting}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="PRE_A1">Pre-A1</MenuItem>
                  <MenuItem value="A1">A1</MenuItem>
                  <MenuItem value="HEARING">Hearing</MenuItem>
                  <MenuItem value="LISTING">Listing</MenuItem>
                </TextField>
              )}
            />

            <TextField
              fullWidth
              label="Filing Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              {...register('filingDate')}
              error={!!errors.filingDate}
              helperText={errors.filingDate?.message}
              disabled={isSubmitting}
            />

            <TextField
              fullWidth
              label="Listing Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              {...register('listingDate')}
              error={!!errors.listingDate}
              helperText={errors.listingDate?.message}
              disabled={isSubmitting}
            />

            <Controller
              name="bcAttorney"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="B&C Attorney"
                  error={!!errors.bcAttorney}
                  helperText={errors.bcAttorney?.message}
                  disabled={isSubmitting || staffLoading}
                  value={field.value || ''}
                >
                  <MenuItem value="">None</MenuItem>
                  {staffList.map((staff) => (
                    <MenuItem key={staff.id} value={staff.name}>
                      {staff.name}
                    </MenuItem>
                  ))}
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
                {isEdit ? 'Update' : 'Create'} Project
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/projects')}
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

export default ProjectForm;
