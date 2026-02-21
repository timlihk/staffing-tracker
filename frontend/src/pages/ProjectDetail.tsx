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
  Timeline,
  History,
  Group,
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

interface ProjectBillingMilestoneRow {
  billingProjectId: number;
  billingProjectName: string | null;
  cmNumber: string | null;
  engagementId: number;
  engagementTitle: string | null;
  milestoneId: number;
  ordinal: string | null;
  title: string | null;
  triggerText: string | null;
  dueDate: string | null;
  amountValue: number | null;
  amountCurrency: string | null;
  completed: boolean;
  completionDate: string | null;
  invoiceSentDate: string | null;
  paymentReceivedDate: string | null;
  notes: string | null;
  milestoneStatus: 'pending' | 'overdue' | 'completed' | 'invoiced' | 'collected';
}

interface ProjectBillingMilestoneResponse {
  projectId: number;
  linked: boolean;
  cmNumbers: string[];
  milestones: ProjectBillingMilestoneRow[];
}

interface MilestoneEdit {
  completed?: boolean;
  dueDate?: string;
  amountValue?: string;
  invoiceSentDate?: string;
  paymentReceivedDate?: string;
  notes?: string;
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

const BILLING_STATUS_COLORS: Record<ProjectBillingMilestoneRow['milestoneStatus'], 'default' | 'error' | 'warning' | 'success' | 'info'> = {
  pending: 'default',
  overdue: 'error',
  completed: 'success',
  invoiced: 'warning',
  collected: 'info',
};

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
  const [billingMilestoneData, setBillingMilestoneData] = useState<ProjectBillingMilestoneResponse | null>(null);
  const [milestoneEdits, setMilestoneEdits] = useState<Record<number, MilestoneEdit>>({});
  const [savingMilestoneIds, setSavingMilestoneIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [billingMilestonesLoading, setBillingMilestonesLoading] = useState(false);
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
      setBillingMilestonesLoading(true);
      try {
        const [projectResponse, changeHistoryResponse, eventsResponse, billingMilestonesResponse] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get(`/projects/${id}/change-history`),
          api.get<ProjectEventRecord[]>(`/projects/${id}/events`, { params: { limit: 100 } }),
          api.get<ProjectBillingMilestoneResponse>(`/projects/${id}/billing-milestones`),
        ]);
        setProject(projectResponse.data);
        setChangeHistory(changeHistoryResponse.data);
        setProjectEvents(eventsResponse.data);
        setBillingMilestoneData(billingMilestonesResponse.data);
      } catch (error) {
        toast.error('Failed to load project details', 'Please try again later');
      } finally {
        setEventsLoading(false);
        setBillingMilestonesLoading(false);
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

  const refreshBillingMilestones = async () => {
    if (!id) return;
    setBillingMilestonesLoading(true);
    try {
      const response = await api.get<ProjectBillingMilestoneResponse>(`/projects/${id}/billing-milestones`);
      setBillingMilestoneData(response.data);
    } catch (error) {
      toast.error('Failed to refresh billing milestones', 'Please try again later');
    } finally {
      setBillingMilestonesLoading(false);
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

  const handleMilestoneFieldChange = (milestoneId: number, changes: MilestoneEdit) => {
    setMilestoneEdits((prev) => ({
      ...prev,
      [milestoneId]: {
        ...(prev[milestoneId] || {}),
        ...changes,
      },
    }));
  };

  const clearMilestoneEdit = (milestoneId: number) => {
    setMilestoneEdits((prev) => {
      const next = { ...prev };
      delete next[milestoneId];
      return next;
    });
  };

  const handleSaveMilestone = async (milestone: ProjectBillingMilestoneRow) => {
    if (!id) return;
    const edit = milestoneEdits[milestone.milestoneId];
    if (!edit) return;

    const payload: Record<string, unknown> = {
      milestone_id: milestone.milestoneId,
    };

    if (Object.prototype.hasOwnProperty.call(edit, 'completed')) {
      payload.completed = Boolean(edit.completed);
    }
    if (Object.prototype.hasOwnProperty.call(edit, 'dueDate')) {
      payload.due_date = edit.dueDate ? edit.dueDate : null;
    }
    if (Object.prototype.hasOwnProperty.call(edit, 'invoiceSentDate')) {
      payload.invoice_sent_date = edit.invoiceSentDate ? edit.invoiceSentDate : null;
    }
    if (Object.prototype.hasOwnProperty.call(edit, 'paymentReceivedDate')) {
      payload.payment_received_date = edit.paymentReceivedDate ? edit.paymentReceivedDate : null;
    }
    if (Object.prototype.hasOwnProperty.call(edit, 'notes')) {
      const note = edit.notes?.trim();
      payload.notes = note ? note : null;
    }
    if (Object.prototype.hasOwnProperty.call(edit, 'amountValue')) {
      if (edit.amountValue === '' || edit.amountValue === undefined) {
        payload.amount_value = null;
      } else {
        const amount = Number(edit.amountValue);
        if (!Number.isFinite(amount)) {
          toast.error('Invalid amount value', 'Please enter a valid number');
          return;
        }
        payload.amount_value = amount;
      }
    }

    setSavingMilestoneIds((prev) => [...prev, milestone.milestoneId]);
    try {
      await api.patch(`/projects/${id}/billing-milestones`, {
        milestones: [payload],
      });
      clearMilestoneEdit(milestone.milestoneId);
      await Promise.all([refreshBillingMilestones(), refreshProjectEvents()]);
      toast.success('Milestone updated');
    } catch (error) {
      const message = isAxiosError<{ error?: string }>(error)
        ? (error.response?.data?.error ?? 'Please try again')
        : 'Please try again';
      toast.error('Failed to update milestone', message);
    } finally {
      setSavingMilestoneIds((prev) => prev.filter((item) => item !== milestone.milestoneId));
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
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
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
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
              {project.notes && (
                <Box
                  sx={{
                    gridColumn: { xs: '1', sm: '1 / -1' },
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    NOTES
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>
                    {project.notes}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Group color="action" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Team Members
                </Typography>
              </Box>
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
                  Add
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
                Billing Milestones
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Linked by C/M: {billingMilestoneData?.cmNumbers?.length ? billingMilestoneData.cmNumbers.join(', ') : 'Not linked'}
              </Typography>
            </Box>
          </Stack>

          {billingMilestonesLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={24} />
            </Box>
          ) : !billingMilestoneData?.linked ? (
            <Box
              sx={{
                p: 2,
                textAlign: 'center',
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'grey.300',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No linked billing milestones yet. Link this project to billing by C/M first.
              </Typography>
            </Box>
          ) : billingMilestoneData.milestones.length === 0 ? (
            <Box
              sx={{
                p: 2,
                textAlign: 'center',
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'grey.300',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No billing milestones found for linked C/M numbers.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Milestone</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Invoice Sent</TableCell>
                    <TableCell>Payment Received</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {billingMilestoneData.milestones.map((milestone) => {
                    const edit = milestoneEdits[milestone.milestoneId] || {};
                    const dueDateValue = edit.dueDate ?? (milestone.dueDate ? milestone.dueDate.slice(0, 10) : '');
                    const amountValue = edit.amountValue ?? (milestone.amountValue !== null ? String(milestone.amountValue) : '');
                    const invoiceDateValue = edit.invoiceSentDate ?? (milestone.invoiceSentDate ? milestone.invoiceSentDate.slice(0, 10) : '');
                    const paymentDateValue = edit.paymentReceivedDate ?? (milestone.paymentReceivedDate ? milestone.paymentReceivedDate.slice(0, 10) : '');
                    const notesValue = edit.notes ?? (milestone.notes || '');
                    const completedValue = edit.completed ?? milestone.completed;
                    const hasChanges = Object.keys(edit).length > 0;
                    const isSaving = savingMilestoneIds.includes(milestone.milestoneId);

                    return (
                      <TableRow key={milestone.milestoneId} hover>
                        <TableCell sx={{ minWidth: 260 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {milestone.title || `Milestone #${milestone.milestoneId}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {milestone.billingProjectName || 'Billing project'} · {milestone.cmNumber || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="date"
                            size="small"
                            value={dueDateValue}
                            onChange={(e) => handleMilestoneFieldChange(milestone.milestoneId, { dueDate: e.target.value })}
                            disabled={!permissions.canEditProject || isSaving}
                            InputLabelProps={{ shrink: true }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ minWidth: 130 }}>
                          <TextField
                            size="small"
                            type="number"
                            value={amountValue}
                            onChange={(e) => handleMilestoneFieldChange(milestone.milestoneId, { amountValue: e.target.value })}
                            disabled={!permissions.canEditProject || isSaving}
                            inputProps={{ step: '0.01', min: 0 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={completedValue}
                            onChange={(e) => handleMilestoneFieldChange(milestone.milestoneId, { completed: e.target.checked })}
                            disabled={!permissions.canEditProject || isSaving}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="date"
                            size="small"
                            value={invoiceDateValue}
                            onChange={(e) => handleMilestoneFieldChange(milestone.milestoneId, { invoiceSentDate: e.target.value })}
                            disabled={!permissions.canEditProject || isSaving}
                            InputLabelProps={{ shrink: true }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="date"
                            size="small"
                            value={paymentDateValue}
                            onChange={(e) => handleMilestoneFieldChange(milestone.milestoneId, { paymentReceivedDate: e.target.value })}
                            disabled={!permissions.canEditProject || isSaving}
                            InputLabelProps={{ shrink: true }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={milestone.milestoneStatus}
                            color={BILLING_STATUS_COLORS[milestone.milestoneStatus]}
                            variant={milestone.milestoneStatus === 'pending' ? 'outlined' : 'filled'}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 220 }}>
                          <TextField
                            size="small"
                            value={notesValue}
                            onChange={(e) => handleMilestoneFieldChange(milestone.milestoneId, { notes: e.target.value })}
                            disabled={!permissions.canEditProject || isSaving}
                            placeholder="Notes"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell align="right">
                          {permissions.canEditProject ? (
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleSaveMilestone(milestone)}
                                disabled={!hasChanges || isSaving}
                              >
                                Save
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => clearMilestoneEdit(milestone.milestoneId)}
                                disabled={!hasChanges || isSaving}
                              >
                                Reset
                              </Button>
                            </Stack>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timeline color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Trigger Events
              </Typography>
            </Box>
            {permissions.canEditProject && (
              <Button
                startIcon={<Add />}
                variant="outlined"
                size="small"
                onClick={() => setEventDialogOpen(true)}
              >
                Add
              </Button>
            )}
          </Stack>

          {eventsLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={24} />
            </Box>
          ) : projectEvents.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {projectEvents.slice(0, 10).map((event) => {
                const notesValue =
                  event.payload && typeof event.payload === 'object' && event.payload.notes
                    ? String(event.payload.notes)
                    : null;

                return (
                  <Box
                    key={event.id}
                    sx={{
                      display: 'flex',
                      gap: 2,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.100',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ minWidth: 90, flexShrink: 0 }}>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(event.occurred_at).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {new Date(event.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                        <Chip size="small" color="primary" label={formatEventType(event.event_type)} sx={{ height: 20 }} />
                        <Chip size="small" variant="outlined" label={event.source || 'system'} sx={{ height: 20 }} />
                      </Stack>
                      {(event.status_from || event.status_to) && (
                        <Typography variant="caption" color="text.secondary">
                          Status: {event.status_from || '—'} → {event.status_to || '—'}
                        </Typography>
                      )}
                      {(event.lifecycle_stage_from || event.lifecycle_stage_to) && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Lifecycle: {formatLifecycleStage(event.lifecycle_stage_from)} → {formatLifecycleStage(event.lifecycle_stage_to)}
                        </Typography>
                      )}
                      {notesValue && (
                        <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                          {notesValue}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
              {projectEvents.length > 10 && (
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block', mt: 1 }}>
                  +{projectEvents.length - 10} more events
                </Typography>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                p: 2,
                textAlign: 'center',
                bgcolor: 'grey.50',
                borderRadius: 1,
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <History color="action" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Change History
            </Typography>
          </Box>
          {changeHistory.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {changeHistory.slice(0, 10).map((change) => (
                <Box
                  key={change.id}
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.100',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ minWidth: 32, flexShrink: 0 }}>{getActionIcon(change.changeType)}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box display="flex" gap={1} flexWrap="wrap" alignItems="baseline">
                      <Typography variant="caption" fontWeight={600}>
                        {change.fieldName}:
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {change.oldValue || '(empty)'}
                      </Typography>
                      <Typography variant="caption">→</Typography>
                      <Typography variant="caption" color="primary.main" fontWeight={600}>
                        {change.newValue || '(empty)'}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                      {new Date(change.changedAt).toLocaleDateString()} {new Date(change.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {change.username && ` • ${change.username}`}
                    </Typography>
                  </Box>
                </Box>
              ))}
              {changeHistory.length > 10 && (
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block', mt: 1 }}>
                  +{changeHistory.length - 10} more changes
                </Typography>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                p: 2,
                textAlign: 'center',
                bgcolor: 'grey.50',
                borderRadius: 1,
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
