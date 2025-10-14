import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSmartBack } from '../hooks/useSmartBack';
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
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Add,
  Update,
  Delete as DeleteIcon,
  ChangeCircle,
  CheckCircleOutline,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import api from '../api/client';
import { Project, ChangeHistory, ProjectAssignment, Staff } from '../types';
import { Page, PageHeader } from '../components/ui';
import { useStaff } from '../hooks/useStaff';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirmProject } from '../hooks/useProjects';
import {
  useCreateAssignment,
  useUpdateAssignment,
  useDeleteAssignment,
} from '../hooks/useAssignments';
import {
  useAddBcAttorney,
  useRemoveBcAttorney,
} from '../hooks/useBcAttorneys';

interface TeamMemberFormValues {
  staffId: number | '';
  jurisdiction: string;
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
  const goBack = useSmartBack('/projects');
  const permissions = usePermissions();
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
        role: member.position,
        department: member.department,
      })),
    [staffList]
  );

  const createAssignment = useCreateAssignment();
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const confirmProject = useConfirmProject();

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

  const roleOrder = ['Partner', 'Associate', 'Senior FLIC', 'Junior FLIC', 'Intern'];

  const teamAssignments = (project.assignments ?? [])
    .filter((assignment) => assignment.jurisdiction !== 'B&C' && assignment.staff?.position !== 'B&C Working Attorney')
    .sort((a, b) => {
      const roleA = roleOrder.indexOf(a.staff?.position || '');
      const roleB = roleOrder.indexOf(b.staff?.position || '');

      // If roles are different, sort by role order
      if (roleA !== roleB) {
        // If role not found in order array, put it at the end
        if (roleA === -1) return 1;
        if (roleB === -1) return -1;
        return roleA - roleB;
      }

      // If roles are the same, sort by name alphabetically
      const nameA = a.staff?.name || '';
      const nameB = b.staff?.name || '';
      return nameA.localeCompare(nameB);
    });

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
            jurisdiction: values.jurisdiction || null,
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
        const selectedStaff = staffList.find((s) => s.id === Number(values.staffId));
        if (!selectedStaff) return;

        const created = await createAssignment.mutateAsync({
          projectId: project.id,
          staffId: Number(values.staffId),
          jurisdiction: values.jurisdiction || selectedStaff.department || undefined,
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
              onClick={goBack}
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
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              color="success"
              startIcon={<CheckCircleOutline />}
              onClick={async () => {
                if (id) {
                  await confirmProject.mutateAsync(parseInt(id));
                  // Refetch project data
                  const projectResponse = await api.get(`/projects/${id}`);
                  setProject(projectResponse.data);
                }
              }}
              disabled={confirmProject.isPending}
            >
              {confirmProject.isPending ? 'Confirming...' : 'Confirm Details'}
            </Button>
            {permissions.canEditProject && (
              <Button variant="contained" startIcon={<Edit />} onClick={() => navigate(`/projects/${id}/edit`)}>
                Edit Project
              </Button>
            )}
          </Stack>
        }
      />
      <Stack spacing={3}>
        {/* Project Header */}
        <Paper sx={{ p: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', lineHeight: 1 }}>
              {project.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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
                label: 'SIDE',
                value: project.side || '-',
              },
              {
                label: 'SECTOR',
                value: project.sector || '-',
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
              },
              {
                label: 'LAST CONFIRMED',
                value: project.lastConfirmedAt
                  ? `${formatDate(project.lastConfirmedAt)} by ${project.confirmedBy?.username || 'Unknown'}`
                  : 'Never confirmed',
              }].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, minWidth: 120 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
              {project.notes && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, minWidth: 120, pt: 0.5 }}>
                    NOTES
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, whiteSpace: 'pre-wrap', flex: 1 }}>
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
              {permissions.canCreateAssignment && (
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
              )}
            </Stack>
            {teamAssignments.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Role</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Jurisdiction</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teamAssignments.map((assignment) => (
                      <TableRow key={assignment.id} hover>
                        <TableCell>{assignment.staff?.position || '—'}</TableCell>
                        <TableCell sx={{ cursor: 'pointer' }} onClick={() => navigate(`/staff/${assignment.staffId}`)}>
                          <Typography variant="body2" fontWeight={600} color="primary.main">
                            {assignment.staff?.name || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>{assignment.jurisdiction || '—'}</TableCell>
                        <TableCell align="right">
                          {permissions.canEditAssignment && (
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleEditAssignment(assignment)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {permissions.canDeleteAssignment && (
                            <Tooltip title="Remove">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteAssignment(assignment)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
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
        staffList={staffList}
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
  staffList: Staff[];
  staffLoading: boolean;
  onSave: (values: TeamMemberFormValues) => Promise<void>;
  isSaving: boolean;
}

const TeamMemberDialog = ({
  open,
  onClose,
  initialData,
  staffOptions,
  staffList,
  staffLoading,
  onSave,
  isSaving,
}: TeamMemberDialogProps) => {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TeamMemberFormValues>({
    defaultValues: {
      staffId: '',
      jurisdiction: '',
      notes: '',
    },
  });

  const selectedStaffId = watch('staffId');
  const selectedStaff = staffList.find((s) => s.id === Number(selectedStaffId));

  useEffect(() => {
    if (initialData) {
      reset({
        staffId: initialData.staffId,
        jurisdiction: initialData.jurisdiction || '',
        notes: initialData.notes || '',
      });
    } else {
      reset({
        staffId: '',
        jurisdiction: '',
        notes: '',
      });
    }
  }, [initialData, reset, open]);

  useEffect(() => {
    if (selectedStaff && !initialData) {
      reset((prev) => ({
        ...prev,
        jurisdiction: selectedStaff.department || '',
      }));
    }
  }, [selectedStaff, initialData, reset]);

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

          {selectedStaff && !initialData && (
            <Box
              sx={{
                p: 2,
                bgcolor: 'primary.50',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'primary.200',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Position: {selectedStaff.role}
              </Typography>
            </Box>
          )}

          <Controller
            name="jurisdiction"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Jurisdiction"
                placeholder="Auto-filled from staff department"
                helperText="Auto-populated from staff department, you can override if needed"
                error={!!errors.jurisdiction}
              />
            )}
          />

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
