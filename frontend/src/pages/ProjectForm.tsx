import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSmartBack } from '../hooks/useSmartBack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  MenuItem,
  CircularProgress,
  Stack,
  Autocomplete,
  Chip,
  Divider,
} from '@mui/material';
import { ArrowBack, Save, PersonAdd } from '@mui/icons-material';
import { Page } from '../components/ui';
import { LifecycleChangeDialog } from '../components/projects';
import { projectSchema, type ProjectFormData } from '../lib/validations';
import { useProject, useCreateProject, useUpdateProject } from '../hooks/useProjects';
import { useStaff } from '../hooks/useStaff';
import api from '../api/client';
import type { Project, Staff } from '../types';
import { toast } from '../lib/toast';

interface TeamMember {
  staffId: number;
  staffName: string;
  position: string;
  jurisdiction: string;
}

const ProjectForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useSmartBack('/projects');
  const isEdit = Boolean(id && id !== 'new' && !isNaN(Number(id)));

  const { data: project, isLoading: projectLoading } = useProject(isEdit ? id! : '');
  const { data: staffResponse, isLoading: staffLoading } = useStaff({ limit: 100 });
  const staffList = staffResponse?.data || [];
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [jurisdiction, setJurisdiction] = useState('HK Law');

  // Lifecycle change dialog state
  const [lifecycleDialogOpen, setLifecycleDialogOpen] = useState(false);
  const [lifecycleDialogCmNumber, setLifecycleDialogCmNumber] = useState('');
  const [lifecycleDialogIsNewEngagement, setLifecycleDialogIsNewEngagement] = useState(false);

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
      lifecycleStage: '',
      priority: 'Medium',
      bcAttorney: '',
      filingDate: '',
      listingDate: '',
      side: '',
      sector: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (isEdit && project) {
      reset({
        name: project.name,
        category: project.category,
        status: project.status,
        lifecycleStage: project.lifecycleStage || '',
        priority: project.priority || 'Medium',
        bcAttorney: project.bcAttorney || '',
        filingDate: project.filingDate ? project.filingDate.slice(0, 10) : '',
        listingDate: project.listingDate ? project.listingDate.slice(0, 10) : '',
        side: project.side || '',
        sector: project.sector || '',
        notes: project.notes || '',
      });
    }
  }, [project, isEdit, reset]);

  const handleAddTeamMember = () => {
    if (selectedStaff && !teamMembers.find(m => m.staffId === selectedStaff.id)) {
      setTeamMembers([...teamMembers, {
        staffId: selectedStaff.id,
        staffName: selectedStaff.name,
        position: selectedStaff.position || 'Staff',
        jurisdiction,
      }]);
      setSelectedStaff(null);
    }
  };

  const handleRemoveTeamMember = (staffId: number) => {
    setTeamMembers(teamMembers.filter(m => m.staffId !== staffId));
  };

  const onSubmit = async (data: ProjectFormData) => {
    try {
      const cleanedData: Partial<Project> = { ...data };

      const normalize = (value?: string | null) =>
        value && value.trim().length > 0 ? value.trim() : undefined;

      cleanedData.bcAttorney = normalize(cleanedData.bcAttorney);
      cleanedData.lifecycleStage = normalize(cleanedData.lifecycleStage);
      cleanedData.filingDate = normalize(cleanedData.filingDate);
      cleanedData.listingDate = normalize(cleanedData.listingDate);
      cleanedData.side = normalize(cleanedData.side);
      cleanedData.sector = normalize(cleanedData.sector);
      cleanedData.notes = normalize(cleanedData.notes);

      if (cleanedData.priority && cleanedData.priority.trim() === '') {
        cleanedData.priority = undefined;
      }

      let projectId: number;

      if (isEdit) {
        await updateProject.mutateAsync({ id: Number(id), data: cleanedData });
        projectId = Number(id);

        // Check if lifecycle/status changed and project has a C/M number
        const previousLifecycle = (project?.lifecycleStage || '').trim();
        const newLifecycle = (cleanedData.lifecycleStage || '').trim();
        const lifecycleChanged = newLifecycle !== previousLifecycle;
        const previousStatus = (project?.status || '').trim();
        const newStatus = (cleanedData.status || '').trim();
        const statusChanged = newStatus !== previousStatus;
        const cmNumber = project?.cmNumber;

        if ((lifecycleChanged || statusChanged) && cmNumber) {
          // Show lifecycle change dialog instead of navigating
          setLifecycleDialogCmNumber(cmNumber);
          setLifecycleDialogIsNewEngagement(newLifecycle === 'new_engagement');
          setLifecycleDialogOpen(true);
          return; // Don't navigate yet
        }
      } else {
        const createdProject = await createProject.mutateAsync(cleanedData);
        projectId = createdProject.id;

        // Add team members if any
        if (teamMembers.length > 0) {
          try {
            const bulkResponse = await api.post('/assignments/bulk', {
              assignments: teamMembers.map(member => ({
                projectId,
                staffId: member.staffId,
                jurisdiction: member.jurisdiction,
              })),
            });

            // Check for errors in the response (partial failures)
            if (bulkResponse.data.errors && bulkResponse.data.errors.length > 0) {
              const errorCount = bulkResponse.data.errors.length;
              const successCount = bulkResponse.data.count || 0;

              // Partial failure - some succeeded, some failed
              toast.warning(`Partial team assignment failure`,
                `${successCount} of ${successCount + errorCount} team members added. ${errorCount} failed.`
              );
            }
            // Note: No toast for all-success case since useCreateProject already shows "Project created" toast
          } catch (bulkError: unknown) {
            // Handle 400 error when all assignments fail
            if (isAxiosError<{ errors?: unknown[] }>(bulkError) && bulkError.response?.status === 400) {
              const errorData = bulkError.response.data;
              const errorCount = Array.isArray(errorData?.errors)
                ? errorData.errors.length
                : teamMembers.length;

              toast.error('Failed to add team members',
                `All ${errorCount} team member assignments failed. Please add them manually from the project detail page.`
              );
            } else {
              // Unexpected error
              toast.error('Failed to add team members',
                'An unexpected error occurred while adding team members. Please add them manually.'
              );
            }
            // Still navigate since project was created, but user is warned
          }
        }
      }
      navigate('/projects');
    } catch {
      // Error is handled by mutation hooks with toast notifications
      // No additional action needed - error is logged for debugging only
    }
  };

  const handleLifecycleDialogClose = () => {
    setLifecycleDialogOpen(false);
    navigate('/projects');
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
          <Button startIcon={<ArrowBack />} onClick={goBack}>
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
              label="Project Name"
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
                  helperText={errors.status?.message || 'Operational state of the project.'}
                  disabled={isSubmitting}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Slow-down">Slow-down</MenuItem>
                  <MenuItem value="Suspended">Suspended</MenuItem>
                  <MenuItem value="Closed">Closed</MenuItem>
                  <MenuItem value="Terminated">Terminated</MenuItem>
                </TextField>
              )}
            />

            <Controller
              name="lifecycleStage"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Lifecycle Stage"
                  error={!!errors.lifecycleStage}
                  helperText={
                    errors.lifecycleStage?.message ||
                    'Single stage source (includes former timetable/EL-signed progression).'
                  }
                  disabled={isSubmitting}
                  value={field.value || ''}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="new_engagement">New Engagement</MenuItem>
                  <MenuItem value="kickoff">Kickoff</MenuItem>
                  <MenuItem value="confidential_filed">Confidential Filed</MenuItem>
                  <MenuItem value="a1_filed">A1 Filed</MenuItem>
                  <MenuItem value="hearing_passed">Hearing Passed</MenuItem>
                  <MenuItem value="listed">Listed</MenuItem>
                  <MenuItem value="renewal_cycle">Renewal Cycle</MenuItem>
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
              name="side"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Side"
                  error={!!errors.side}
                  helperText={errors.side?.message}
                  disabled={isSubmitting}
                  value={field.value || ''}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="Issuer">Issuer</MenuItem>
                  <MenuItem value="Underwriter">Underwriter</MenuItem>
                </TextField>
              )}
            />

            <Controller
              name="sector"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="Sector"
                  error={!!errors.sector}
                  helperText={errors.sector?.message}
                  disabled={isSubmitting}
                  value={field.value || ''}
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="Healthcare">Healthcare</MenuItem>
                  <MenuItem value="TMT">TMT</MenuItem>
                  <MenuItem value="Consumer">Consumer</MenuItem>
                  <MenuItem value="Industrial">Industrial</MenuItem>
                </TextField>
              )}
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

            {!isEdit && (
              <>
                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Team Members
                </Typography>

                <Stack direction="row" spacing={2} alignItems="flex-end">
                  <Box sx={{ flex: 1 }}>
                    <Autocomplete
                      value={selectedStaff}
                      onChange={(_, newValue) => {
                        setSelectedStaff(newValue);
                        if (newValue) {
                          // Auto-set jurisdiction based on staff position/department
                          // You can customize this logic
                          setJurisdiction('HK Law');
                        }
                      }}
                      options={staffList.filter(s => !teamMembers.find(m => m.staffId === s.id))}
                      getOptionLabel={(option) => option.name}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Staff Member"
                          disabled={isSubmitting || staffLoading}
                        />
                      )}
                      disabled={isSubmitting}
                    />
                  </Box>
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<PersonAdd />}
                      onClick={handleAddTeamMember}
                      disabled={!selectedStaff || isSubmitting}
                      sx={{ height: 56 }}
                    >
                      Add Member
                    </Button>
                  </Box>
                </Stack>

                {teamMembers.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Team Members ({teamMembers.length}):
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {teamMembers.map((member) => (
                        <Chip
                          key={member.staffId}
                          label={`${member.staffName} - ${member.position} (${member.jurisdiction})`}
                          onDelete={() => handleRemoveTeamMember(member.staffId)}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}

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

      <LifecycleChangeDialog
        open={lifecycleDialogOpen}
        cmNumber={lifecycleDialogCmNumber}
        isNewEngagement={lifecycleDialogIsNewEngagement}
        onClose={handleLifecycleDialogClose}
      />
    </Page>
  );
};

export default ProjectForm;
