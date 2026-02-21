import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSmartBack } from '../hooks/useSmartBack';
import { isAxiosError } from 'axios';
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
  Tooltip,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
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
import api from '../api/client';
import { Project, ChangeHistory, ProjectAssignment, ProjectBcAttorney } from '../types';
import { Page, PageHeader } from '../components/ui';
import { TeamMemberDialog, type TeamMemberFormValues } from '../components/projects';
import { useStaff } from '../hooks/useStaff';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirmProject } from '../hooks/useProjects';
import { useCreateAssignment, useUpdateAssignment, useDeleteAssignment } from '../hooks/useAssignments';
import { useAddBcAttorney, useRemoveBcAttorney } from '../hooks/useBcAttorneys';
import { toast } from '../lib/toast';

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  Active: 'success',
  'Slow-down': 'warning',
  Suspended: 'error',
  Closed: 'default',
  Terminated: 'error',
};

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

interface ProjectEventRecord {
  id: number;
  event_type: string;
  event_key?: string | null;
  occurred_at: string;
  status_from?: string | null;
  status_to?: string | null;
  lifecycle_stage_from?: string | null;
  lifecycle_stage_to?: string | null;
  source?: string | null;
  payload?: Record<string, unknown> | null;
}

interface CreateProjectEventResponse {
  event: ProjectEventRecord;
  triggersCreated: number;
  triggerIds: number[];
}

const CANONICAL_EVENT_OPTIONS = [
  'PROJECT_CLOSED',
  'PROJECT_TERMINATED',
  'PROJECT_PAUSED',
  'PROJECT_RESUMED',
  'EL_SIGNED',
  'PROJECT_KICKOFF',
  'CONFIDENTIAL_FILING_SUBMITTED',
  'A1_SUBMITTED',
  'HEARING_PASSED',
  'LISTING_COMPLETED',
  'RENEWAL_CYCLE_STARTED',
];

const formatLifecycleStage = (stage?: string | null) => {
  if (!stage) return '—';
  return stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatEventType = (eventType: string) =>
  eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useSmartBack('/projects');
  const permissions = usePermissions();
  const [project, setProject] = useState<Project | null>(null);
  const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([]);
  const [projectEvents, setProjectEvents] = useState<ProjectEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ProjectAssignment | null>(null);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventTypeInput, setEventTypeInput] = useState('');
  const [eventOccurredAt, setEventOccurredAt] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);

  const { data: staffResponse, isLoading: staffLoading } = useStaff({ status: 'active', limit: 100 });
  const staffList = staffResponse?.data || [];
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
  const addBcAttorney = useAddBcAttorney();
  const removeBcAttorney = useRemoveBcAttorney();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setEventsLoading(true);
      try {
        const [projectResponse, changeHistoryResponse, eventsResponse] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get(`/projects/${id}/change-history`),
          api.get<ProjectEventRecord[]>(`/projects/${id}/events`, { params: { limit: 100 } }),
        ]);
        setProject(projectResponse.data);
        setChangeHistory(changeHistoryResponse.data);
        setProjectEvents(eventsResponse.data);
      } catch (error) {
        toast.error('Failed to load project details', 'Please try again later');
      } finally {
        setEventsLoading(false);
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const refreshProjectEvents = async () => {
    if (!id) return;
    setEventsLoading(true);
    try {
      const response = await api.get<ProjectEventRecord[]>(`/projects/${id}/events`, {
        params: { limit: 100 },
      });
      setProjectEvents(response.data);
    } catch (error) {
      toast.error('Failed to refresh project events', 'Please try again later');
    } finally {
      setEventsLoading(false);
    }
  };

  const resetEventForm = () => {
    setEventTypeInput('');
    setEventOccurredAt('');
    setEventNotes('');
  };

  const handleCreateProjectEvent = async () => {
    if (!id) return;
    const eventType = eventTypeInput.trim();
    if (!eventType) {
      toast.error('Event type is required');
      return;
    }

    try {
      setCreatingEvent(true);

      const payload = eventNotes.trim()
        ? { notes: eventNotes.trim() }
        : undefined;

      const occurredAt = eventOccurredAt
        ? new Date(eventOccurredAt).toISOString()
        : undefined;

      const response = await api.post<CreateProjectEventResponse>(`/projects/${id}/events`, {
        eventType,
        occurredAt,
        source: 'manual_ui',
        payload,
      });

      const triggersCreated = response.data?.triggersCreated ?? 0;
      const triggerMessage =
        triggersCreated > 0
          ? `${triggersCreated} billing trigger${triggersCreated === 1 ? '' : 's'} queued`
          : 'No milestone trigger matched immediately';

      toast.success('Project event added', triggerMessage);
      setEventDialogOpen(false);
      resetEventForm();
      await refreshProjectEvents();
    } catch (error) {
      const message = isAxiosError<{ error?: string }>(error)
        ? (error.response?.data?.error ?? 'Please try again')
        : 'Please try again';
      toast.error('Failed to add project event', message);
    } finally {
      setCreatingEvent(false);
    }
  };

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

  const statusColor = STATUS_COLORS[project.status] || 'default';

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
      // Error is handled by deleteAssignment mutation hook with toast notifications
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
      // Error is handled by create/update assignment mutation hooks with toast notifications
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleToggleBcAttorney = async (assignment: ProjectAssignment, isBcAttorney: boolean) => {
    if (!project) return;

    const previousBcAttorneys = (project.bcAttorneys ?? []).map((bcAttorney) => ({
      ...bcAttorney,
      staff: bcAttorney.staff ? { ...bcAttorney.staff } : undefined,
    }));

    try {
      if (isBcAttorney) {
        const optimisticBcAttorney: ProjectBcAttorney = {
          id: -Date.now(), // Temporary ID to help replace the optimistic record
          projectId: project.id,
          staffId: assignment.staffId,
          createdAt: new Date().toISOString(),
          staff: assignment.staff
            ? {
                ...assignment.staff,
              }
            : undefined,
        };

        setProject((prev) =>
          prev
            ? {
                ...prev,
                bcAttorneys: [...(prev.bcAttorneys ?? []), optimisticBcAttorney],
              }
            : prev
        );

        const newBcAttorney = await addBcAttorney.mutateAsync({
          projectId: project.id,
          staffId: assignment.staffId,
        });

        setProject((prev) =>
          prev
            ? {
                ...prev,
                bcAttorneys: (prev.bcAttorneys ?? []).map((bcAttorney) =>
                  bcAttorney.id === optimisticBcAttorney.id ? newBcAttorney : bcAttorney
                ),
              }
            : prev
        );
      } else {
        setProject((prev) =>
          prev
            ? {
                ...prev,
                bcAttorneys: (prev.bcAttorneys ?? []).filter(
                  (bcAttorney) => bcAttorney.staffId !== assignment.staffId
                ),
              }
            : prev
        );

        await removeBcAttorney.mutateAsync({
          projectId: project.id,
          staffId: assignment.staffId,
        });
      }
    } catch (error: any) {
      // Rollback optimistic update on error
      setProject((prev) =>
        prev
          ? {
              ...prev,
              bcAttorneys: previousBcAttorneys,
            }
          : prev
      );
      // Error is handled by add/remove B&C attorney mutation hooks with toast notifications
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
              {project.lifecycleStage && (
                <Chip
                  label={`Lifecycle: ${formatLifecycleStage(project.lifecycleStage)}`}
                  variant="outlined"
                  sx={{ bgcolor: 'white' }}
                />
              )}
              {project.priority && (
                <Chip
                  label={`Priority: ${project.priority}`}
                  color={getPriorityColor(project.priority)}
                  sx={{ fontWeight: 600 }}
                />
              )}
              {project.category && <Chip label={project.category} variant="outlined" sx={{ bgcolor: 'white' }} />}
              {project.cmNumber && <Chip label={`C/M: ${project.cmNumber}`} variant="outlined" sx={{ bgcolor: 'white' }} />}
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
                label: 'STATUS',
                value: project.status || '-',
              },
              {
                label: 'LIFECYCLE STAGE',
                value: formatLifecycleStage(project.lifecycleStage),
              },
              {
                label: 'LIFECYCLE VERSION',
                value:
                  typeof project.stageVersion === 'number'
                    ? String(project.stageVersion)
                    : '-',
              },
              {
                label: 'CATEGORY',
                value: project.category || '-',
              },
              {
                label: 'C/M NUMBER',
                value: project.cmNumber || '-',
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
                label: 'FILING DATE',
                value: formatDate(project.filingDate),
              },
              {
                label: 'LISTING DATE',
                value: formatDate(project.listingDate),
              },
              {
                label: 'B&C ATTORNEY',
                value: project.bcAttorneys && project.bcAttorneys.length > 0
                  ? project.bcAttorneys.map(bcAttorney => bcAttorney.staff?.name).filter(Boolean).join(', ')
                  : '-',
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
                      <TableCell>B&C Attorney</TableCell>
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
                        <TableCell>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={project?.bcAttorneys?.some(bcAttorney => bcAttorney.staff?.id === assignment.staffId) || false}
                                onChange={(e) => handleToggleBcAttorney(assignment, e.target.checked)}
                                disabled={addBcAttorney.isPending || removeBcAttorney.isPending || !permissions.canEditAssignment}
                                size="small"
                              />
                            }
                            label=""
                          />
                        </TableCell>
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

        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Trigger Events
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status/lifecycle changes and manual events feed milestone triggers.
              </Typography>
            </Box>
            {permissions.canEditProject && (
              <Button
                startIcon={<Add />}
                variant="outlined"
                onClick={() => setEventDialogOpen(true)}
              >
                Add Trigger Event
              </Button>
            )}
          </Stack>

          {eventsLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={24} />
            </Box>
          ) : projectEvents.length > 0 ? (
            <Stack spacing={1.5}>
              {projectEvents.map((event) => {
                const notesValue =
                  event.payload && typeof event.payload === 'object' && event.payload.notes
                    ? String(event.payload.notes)
                    : null;

                return (
                  <Box
                    key={event.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" color="primary" label={formatEventType(event.event_type)} />
                        <Chip size="small" variant="outlined" label={event.source || 'system'} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(event.occurred_at).toLocaleString()}
                      </Typography>
                    </Stack>

                    {(event.status_from || event.status_to) && (
                      <Typography variant="body2" color="text.secondary" mt={1}>
                        Status: {event.status_from || '—'} {' -> '} {event.status_to || '—'}
                      </Typography>
                    )}

                    {(event.lifecycle_stage_from || event.lifecycle_stage_to) && (
                      <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Lifecycle: {formatLifecycleStage(event.lifecycle_stage_from)} {' -> '}{' '}
                        {formatLifecycleStage(event.lifecycle_stage_to)}
                      </Typography>
                    )}

                    {notesValue && (
                      <Typography variant="body2" mt={0.75}>
                        {notesValue}
                      </Typography>
                    )}
                  </Box>
                );
              })}
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
                No trigger events recorded yet
              </Typography>
            </Box>
          )}
        </Paper>

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
      <Dialog
        open={eventDialogOpen}
        onClose={() => {
          if (!creatingEvent) {
            setEventDialogOpen(false);
            resetEventForm();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Trigger Event</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Autocomplete
              freeSolo
              options={CANONICAL_EVENT_OPTIONS}
              value={eventTypeInput}
              inputValue={eventTypeInput}
              onInputChange={(_, value) => setEventTypeInput(value)}
              onChange={(_, value) => setEventTypeInput(typeof value === 'string' ? value : value || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Event Type"
                  required
                  helperText="Use canonical event names or enter a bespoke event label."
                />
              )}
            />

            <TextField
              label="Occurred At"
              type="datetime-local"
              value={eventOccurredAt}
              onChange={(e) => setEventOccurredAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Notes"
              multiline
              minRows={3}
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              placeholder="Optional context for reviewers"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!creatingEvent) {
                setEventDialogOpen(false);
                resetEventForm();
              }
            }}
            disabled={creatingEvent}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateProjectEvent}
            disabled={creatingEvent || !eventTypeInput.trim()}
          >
            {creatingEvent ? 'Adding...' : 'Add Event'}
          </Button>
        </DialogActions>
      </Dialog>
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

// TeamMemberDialog has been extracted to components/projects/TeamMemberDialog.tsx

export default ProjectDetail;
