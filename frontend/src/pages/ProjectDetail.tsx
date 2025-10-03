import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Add,
  Update,
  Delete as DeleteIcon,
  ChangeCircle,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import api from '../api/client';
import { Project, ChangeHistory, ProjectAssignment } from '../types';
import { Page, Section, PageHeader } from '../components/ui';
import { useStaff } from '../hooks/useStaff';
import {
  useCreateAssignment,
  useUpdateAssignment,
  useDeleteAssignment,
} from '../hooks/useAssignments';

interface TeamMemberFormValues {
  staffId: number | '';
  roleInProject: string;
  jurisdiction: string;
  startDate: string;
  endDate: string;
  notes: string;
}

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'create':
      return <Add color="success" />;
    case 'update':
      return <Update color="primary" />;
    case 'delete':
      return <DeleteIcon color="error" />;
    case 'status_change':
      return <ChangeCircle color="warning" />;
    default:
      return <ChangeCircle />;
  }
};

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ProjectAssignment | null>(null);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const { data: staffList = [], isLoading: staffLoading } = useStaff({ status: 'active' });
  const staffOptions = useMemo(
    () =>
      staffList.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        department: member.department,
      })),
    [staffList]
  );

  const createAssignment = useCreateAssignment();
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectResponse, changeHistoryResponse] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get(`/projects/${id}/change-history`),
        ]);
        setProject(projectResponse.data);
        setChangeHistory(changeHistoryResponse.data);
      } catch (error) {
        console.error('Failed to fetch project:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return <Typography>Project not found</Typography>;
  }

  const statusColor =
    project.status === 'Active'
      ? 'success'
      : project.status === 'Slow-down'
      ? 'warning'
      : 'error';

  const getPriorityColor = (priority: string | null) => {
    if (!priority) return 'default';
    switch (priority) {
      case 'High':
        return 'error';
      case 'Medium':
        return 'warning';
      case 'Low':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : '-');
  const formatTimetable = (value?: string | null) => {
    if (!value) return '-';
    if (value === 'PRE_A1') return 'Pre-A1';
    return value.replace('_', ' ');
  };

  const teamAssignments = (project.assignments ?? []).filter(
    (assignment) => assignment.jurisdiction !== 'B&C' && assignment.roleInProject !== 'B&C Working Attorney'
  );

  const handleOpenAdd = () => {
    setEditingAssignment(null);
    setDialogOpen(true);
  };

  const handleEditAssignment = (assignment: ProjectAssignment) => {
    setEditingAssignment(assignment);
    setDialogOpen(true);
  };

  const handleDeleteAssignment = async (assignment: ProjectAssignment) => {
    const confirmed = window.confirm(
      `Remove ${assignment.staff?.name ?? 'this staff member'} from the project?`
    );
    if (!confirmed) return;

    try {
      await deleteAssignment.mutateAsync({
        id: assignment.id,
        projectId: assignment.projectId,
        staffId: assignment.staffId,
      });
      setProject((prev) =>
        prev
          ? {
              ...prev,
              assignments: prev.assignments
                ? prev.assignments.filter((item) => item.id !== assignment.id)
                : prev.assignments,
            }
          : prev
      );
    } catch (error) {
      console.error('Failed to delete assignment', error);
    }
  };

  const handleSaveAssignment = async (values: TeamMemberFormValues) => {
    if (!project) return;
    try {
      setSavingAssignment(true);
      if (editingAssignment) {
        const updated = await updateAssignment.mutateAsync({
          id: editingAssignment.id,
          data: {
            roleInProject: values.roleInProject,
            jurisdiction: values.jurisdiction || null,
            startDate: values.startDate || null,
            endDate: values.endDate || null,
            notes: values.notes || null,
          },
        });
        setProject((prev) =>
          prev
            ? {
                ...prev,
                assignments: prev.assignments
                  ? prev.assignments.map((item) => (item.id === updated.id ? updated : item))
                  : prev.assignments,
              }
            : prev
        );
      } else {
        const created = await createAssignment.mutateAsync({
          projectId: project.id,
          staffId: Number(values.staffId),
          roleInProject: values.roleInProject,
          jurisdiction: values.jurisdiction || undefined,
          startDate: values.startDate || undefined,
          endDate: values.endDate || undefined,
          notes: values.notes || undefined,
        });
        setProject((prev) =>
          prev
            ? {
                ...prev,
                assignments: [...(prev.assignments ?? []), created],
              }
            : prev
        );
      }
      setDialogOpen(false);
      setEditingAssignment(null);
    } catch (error) {
      console.error('Failed to save assignment', error);
    } finally {
      setSavingAssignment(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/projects')}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Project Details
            </Typography>
          </Stack>
        }
        actions={
          <Button variant="contained" startIcon={<Edit />} onClick={() => navigate(`/projects/${id}/edit`)}>
            Edit Project
          </Button>
        }
      />
      <Stack spacing={3}>
        {/* Project Header */}
        <Paper sx={{ p: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>
            {project.name}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={project.status} color={statusColor} sx={{ fontWeight: 600 }} />
            {project.priority && (
              <Chip
                label={`Priority: ${project.priority}`}
                color={getPriorityColor(project.priority)}
                sx={{ fontWeight: 600 }}
              />
            )}
            {project.category && <Chip label={project.category} variant="outlined" sx={{ bgcolor: 'white' }} />}
          </Stack>
        </Paper>

        {/* Project Details & Team */}
        <Stack spacing={2}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Project Information
            </Typography>
            <Stack spacing={1.5}>
              {[{
                label: 'CATEGORY',
                value: project.category || '-',
              },
              {
                label: 'PRIORITY',
                value: project.priority || '-',
              },
              {
                label: 'EL STATUS',
                value: project.elStatus || '-',
              },
              {
                label: 'TIMETABLE',
                value: formatTimetable(project.timetable),
              },
              {
                label: 'FILING DATE',
                value: formatDate(project.filingDate),
              },
              {
                label: 'LISTING DATE',
                value: formatDate(project.listingDate),
              },
              {
                label: 'B&C ATTORNEY',
                value: project.bcAttorney || '-',
              }].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
              {project.notes && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    NOTES
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                    {project.notes}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Team Members
              </Typography>
              <Button
                startIcon={<Add />}
                variant="outlined"
                size="small"
                onClick={handleOpenAdd}
                disabled={
                  staffLoading ||
                  staffOptions.length === 0 ||
                  createAssignment.isPending ||
                  updateAssignment.isPending
                }
              >
                Add team member
              </Button>
            </Stack>
            {teamAssignments.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Jurisdiction</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teamAssignments.map((assignment) => (
                      <TableRow key={assignment.id} hover>
                        <TableCell sx={{ cursor: 'pointer' }} onClick={() => navigate(`/staff/${assignment.staffId}`)}>
                          <Typography variant="body2" fontWeight={600} color="primary.main">
                            {assignment.staff?.name || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>{assignment.roleInProject}</TableCell>
                        <TableCell>{assignment.jurisdiction || '—'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleEditAssignment(assignment)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteAssignment(assignment)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box
                sx={{
                  p: 3,
                  textAlign: 'center',
                  bgcolor: 'grey.50',
                  borderRadius: 2,
                  border: '1px dashed',
                  borderColor: 'grey.300',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No team members assigned
                </Typography>
              </Box>
            )}
          </Paper>
        </Stack>

        {/* Change History */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Change History
          </Typography>
          {changeHistory.length > 0 ? (
            <Stack spacing={1}>
              {changeHistory.map((change) => (
                <Box
                  key={change.id}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ mt: 0.5 }}>{getActionIcon(change.changeType)}</Box>
                    <Box flex={1}>
                      <Box display="flex" gap={1} flexWrap="wrap" alignItems="baseline">
                        <Typography variant="body2" fontWeight={600}>
                          {change.fieldName}:
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {change.oldValue || '(empty)'}
                        </Typography>
                        <Typography variant="body2">→</Typography>
                        <Typography variant="body2" color="primary.main" fontWeight={600}>
                          {change.newValue || '(empty)'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(change.changedAt).toLocaleString()}
                        {change.username && ` • by ${change.username}`}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : (
            <Box
              sx={{
                p: 3,
                textAlign: 'center',
                bgcolor: 'grey.50',
                borderRadius: 2,
                border: '1px dashed',
                borderColor: 'grey.300',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No changes recorded
              </Typography>
            </Box>
          )}
        </Paper>
      </Stack>
      <TeamMemberDialog
        open={dialogOpen}
        onClose={() => {
          if (savingAssignment) return;
          setDialogOpen(false);
          setEditingAssignment(null);
        }}
        initialData={editingAssignment}
        staffOptions={staffOptions}
        staffLoading={staffLoading}
        onSave={handleSaveAssignment}
        isSaving={savingAssignment || createAssignment.isPending || updateAssignment.isPending}
      />
    </Page>
  );
};

interface TeamMemberDialogProps {
  open: boolean;
  onClose: () => void;
  initialData: ProjectAssignment | null;
  staffOptions: Array<{ id: number; name: string; role: string; department?: string | null }>;
  staffLoading: boolean;
  onSave: (values: TeamMemberFormValues) => Promise<void>;
  isSaving: boolean;
}

const TeamMemberDialog = ({
  open,
  onClose,
  initialData,
  staffOptions,
  staffLoading,
  onSave,
  isSaving,
}: TeamMemberDialogProps) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeamMemberFormValues>({
    defaultValues: {
      staffId: '',
      roleInProject: '',
      jurisdiction: '',
      startDate: '',
      endDate: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        staffId: initialData.staffId,
        roleInProject: initialData.roleInProject,
        jurisdiction: initialData.jurisdiction || '',
        startDate: initialData.startDate ? initialData.startDate.slice(0, 10) : '',
        endDate: initialData.endDate ? initialData.endDate.slice(0, 10) : '',
        notes: initialData.notes || '',
      });
    } else {
      reset({
        staffId: '',
        roleInProject: '',
        jurisdiction: '',
        startDate: '',
        endDate: '',
        notes: '',
      });
    }
  }, [initialData, reset, open]);

  const submit = handleSubmit(async (values) => {
    await onSave(values);
  });

  const disableSave = isSaving || staffLoading;

  return (
    <Dialog open={open} onClose={disableSave ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initialData ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2} mt={1}>
          <Controller
            name="staffId"
            control={control}
            rules={{ required: 'Staff member is required' }}
            render={({ field }) => (
              <TextField
                {...field}
                select
                fullWidth
                label="Staff"
                error={!!errors.staffId}
                helperText={errors.staffId?.message}
                disabled={!!initialData || staffLoading}
              >
                <MenuItem value="">
                  {staffLoading ? 'Loading…' : 'Select staff'}
                </MenuItem>
                {staffOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.name} {option.role ? `• ${option.role}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          <Controller
            name="roleInProject"
            control={control}
            rules={{ required: 'Role is required' }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Role"
                placeholder="Partner, Associate, etc."
                error={!!errors.roleInProject}
                helperText={errors.roleInProject?.message}
              />
            )}
          />

          <Controller
            name="jurisdiction"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Jurisdiction"
                placeholder="HK, US, etc."
                error={!!errors.jurisdiction}
                helperText={errors.jurisdiction?.message}
              />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Start date"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              )}
            />
            <Controller
              name="endDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="End date"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              )}
            />
          </Stack>

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                multiline
                minRows={3}
                label="Notes"
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={disableSave}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          disabled={disableSave}
          startIcon={isSaving ? <CircularProgress size={20} /> : undefined}
        >
          {initialData ? 'Save changes' : 'Add member'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectDetail;
