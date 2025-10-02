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

const ProjectForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = id !== 'new';

  const { data: project, isLoading: projectLoading } = useProject(isEdit ? id! : '');
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
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Project Code"
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message}
                disabled={isSubmitting}
              />
            </Grid>
            <Grid item xs={12} md={6}>
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
                    <MenuItem value="HK Transaction Projects">HK Transaction</MenuItem>
                    <MenuItem value="US Transaction Projects">US Transaction</MenuItem>
                    <MenuItem value="HK Compliance Projects">HK Compliance</MenuItem>
                    <MenuItem value="US Compliance Projects">US Compliance</MenuItem>
                    <MenuItem value="Others">Others</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
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
            </Grid>
            <Grid item xs={12} md={6}>
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
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="EL Status"
                {...register('elStatus')}
                error={!!errors.elStatus}
                helperText={errors.elStatus?.message}
                disabled={isSubmitting}
              />
            </Grid>
            <Grid item xs={12} md={6}>
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
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="B&C Attorney"
                {...register('bcAttorney')}
                error={!!errors.bcAttorney}
                helperText={errors.bcAttorney?.message}
                disabled={isSubmitting}
              />
            </Grid>
            <Grid item xs={12}>
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
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" gap={2}>
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
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Page>
  );
};

export default ProjectForm;
