import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSmartBack } from '../hooks/useSmartBack';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Add,
  Update,
  Delete as DeleteIcon,
  ChangeCircle,
  CheckCircle,
} from '@mui/icons-material';
import api from '../api/client';
import { Staff, ChangeHistory, Project } from '../types';
import { Page, Section, PageHeader, StyledDataGrid } from '../components/ui';
import { GridColDef } from '@mui/x-data-grid';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirmProject } from '../hooks/useProjects';
import { DateHelpers } from '../lib/date';
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

const TIMELINE_WEEKS_BACK = 6;
const TIMELINE_WEEKS_FORWARD = 6;

type AssignmentLike = {
  id: number;
  jurisdiction?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  projectId?: number | null;
  project?: Project | null;
};

const parseDateValue = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfWeek = (value: Date): Date => {
  const date = new Date(value);
  const weekday = (date.getDay() + 6) % 7; // Monday as start
  date.setDate(date.getDate() - weekday);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (value: Date, days: number): Date => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

const formatCompactDate = (value: Date): string =>
  value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const StaffDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useSmartBack('/staff');
  const permissions = usePermissions();
  const confirmProject = useConfirmProject();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStaff = useCallback(
    async (showSpinner = false) => {
      if (!id) return;
      if (showSpinner) {
        setLoading(true);
      }
      try {
        const [staffResponse, changeHistoryResponse] = await Promise.all([
          api.get(`/staff/${id}`),
          api.get(`/staff/${id}/change-history`),
        ]);
        setStaff(staffResponse.data);
        setChangeHistory(changeHistoryResponse.data);
      } catch (error) {
        toast.error('Failed to load staff details', 'Please try again later');
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [id]
  );

  useEffect(() => {
    loadStaff(true).catch(() => {
      // Error is already handled in loadStaff with toast
    });
  }, [loadStaff]);

  const assignments = useMemo<AssignmentLike[]>(
    () => ((staff?.assignments ?? []) as AssignmentLike[]),
    [staff]
  );

  // Group assignments by project
  const groupedAssignments = assignments.reduce((acc, assignment) => {
    const projectId = assignment.projectId ?? assignment.project?.id;
    if (!projectId) return acc;

    if (!acc[projectId]) {
      acc[projectId] = {
        project: assignment.project,
        projectId,
        jurisdictions: [],
        assignments: [] as AssignmentLike[],
      };
    }
    if (assignment.jurisdiction) {
      acc[projectId].jurisdictions.push(assignment.jurisdiction);
    }
    acc[projectId].assignments.push(assignment);
    return acc;
  }, {} as Record<number, { project: Project | null | undefined; projectId: number; jurisdictions: string[]; assignments: AssignmentLike[] }>);

  const groupedList = Object.values(groupedAssignments);

  type ProjectRow = {
    id: number;
    projectId: number;
    name: string;
    status: string;
    category: string;
    side: string;
    sector: string;
    priority: string;
    jurisdictions: string[];
    assignmentWindow: string;
  };

  const projectRows: ProjectRow[] = useMemo(() => {
    return groupedList
      .map((item) => {
        if (!item.project) return null;

        const assignmentStarts = item.assignments
          .map((assignment) => parseDateValue(assignment.startDate) ?? parseDateValue(assignment.createdAt))
          .filter((value): value is Date => value !== null);
        const assignmentEnds = item.assignments
          .map((assignment) => parseDateValue(assignment.endDate))
          .filter((value): value is Date => value !== null);

        const firstAssignedAt = assignmentStarts.length
          ? new Date(Math.min(...assignmentStarts.map((date) => date.getTime())))
          : null;
        const lastAssignedAt = assignmentEnds.length
          ? new Date(Math.max(...assignmentEnds.map((date) => date.getTime())))
          : null;

        const assignmentWindow = firstAssignedAt
          ? (lastAssignedAt
            ? `${formatCompactDate(firstAssignedAt)} - ${formatCompactDate(lastAssignedAt)}`
            : `Since ${formatCompactDate(firstAssignedAt)}`)
          : 'Ongoing';

        return {
          id: item.projectId,
          projectId: item.projectId,
          name: item.project.name ?? '—',
          status: item.project.status ?? '—',
          category: item.project.category ?? '—',
          side: item.project.side ?? '—',
          sector: item.project.sector ?? '—',
          priority: item.project.priority ?? '—',
          jurisdictions: item.jurisdictions ?? [],
          assignmentWindow,
        } as ProjectRow;
      })
      .filter((row): row is ProjectRow => row !== null);
  }, [groupedList]);

  const workloadTimeline = useMemo(() => {
    const currentWeekStart = startOfWeek(new Date());
    const dedupedProjectWindows = groupedList
      .map((item) => {
        if (!item.project) return null;

        const starts = item.assignments
          .map((assignment) => parseDateValue(assignment.startDate) ?? parseDateValue(assignment.createdAt))
          .filter((value): value is Date => value !== null);
        const explicitEnds = item.assignments
          .map((assignment) => parseDateValue(assignment.endDate))
          .filter((value): value is Date => value !== null);

        if (starts.length === 0) return null;

        const start = new Date(Math.min(...starts.map((date) => date.getTime())));
        const status = item.project.status ?? '';
        const fallbackEnd =
          status === 'Closed' || status === 'Terminated'
            ? parseDateValue(item.project.updatedAt ?? null)
            : null;
        const end =
          explicitEnds.length > 0
            ? new Date(Math.max(...explicitEnds.map((date) => date.getTime())))
            : fallbackEnd;

        return {
          projectId: item.projectId,
          start,
          end,
        };
      })
      .filter((value): value is { projectId: number; start: Date; end: Date | null } => value !== null);

    const points = [];
    for (let offset = -TIMELINE_WEEKS_BACK; offset <= TIMELINE_WEEKS_FORWARD; offset += 1) {
      const weekStart = addDays(currentWeekStart, offset * 7);
      const weekEnd = addDays(weekStart, 6);
      const count = dedupedProjectWindows.filter((window) => {
        const startsBeforeWeekEnds = window.start.getTime() <= weekEnd.getTime();
        const hasNotEndedBeforeWeek = !window.end || window.end.getTime() >= weekStart.getTime();
        return startsBeforeWeekEnds && hasNotEndedBeforeWeek;
      }).length;

      points.push({
        key: weekStart.toISOString(),
        offset,
        weekStart,
        weekEnd,
        count,
        isCurrent: offset === 0,
        shortLabel: offset === 0 ? 'Now' : offset < 0 ? `${Math.abs(offset)}w` : `+${offset}w`,
      });
    }
    return points;
  }, [groupedList]);

  const workloadStats = useMemo(() => {
    if (!workloadTimeline.length) {
      return { now: 0, peak: 0, avgPast: 0, avgForward: 0 };
    }

    const now = workloadTimeline.find((point) => point.isCurrent)?.count ?? 0;
    const peak = Math.max(...workloadTimeline.map((point) => point.count), 0);

    const past = workloadTimeline.filter((point) => point.offset < 0);
    const forward = workloadTimeline.filter((point) => point.offset > 0);

    const avgPast = past.length ? past.reduce((sum, point) => sum + point.count, 0) / past.length : now;
    const avgForward = forward.length ? forward.reduce((sum, point) => sum + point.count, 0) / forward.length : now;

    return { now, peak, avgPast, avgForward };
  }, [workloadTimeline]);

  const handleConfirmProject = useCallback(
    async (projectId: number) => {
      try {
        await confirmProject.mutateAsync(projectId);
        await loadStaff();
      } catch (error) {
        // Error is handled by confirmProject mutation hook with toast notifications
      }
    },
    [confirmProject, loadStaff]
  );

  const projectColumns = useMemo<GridColDef<ProjectRow>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Project Code',
        flex: 1,
        minWidth: 200,
        renderCell: (params) => (
          <Box
            sx={{ fontWeight: 600, color: 'primary.main', cursor: 'pointer' }}
            onClick={() => navigate(`/projects/${params.row.projectId}`)}
          >
            {params.row.name}
          </Box>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 0.5,
        minWidth: 120,
        renderCell: (params) => (
          <Chip
            label={params.row.status}
            color={STATUS_COLORS[params.row.status] || 'default'}
            size="small"
          />
        ),
      },
      { field: 'category', headerName: 'Category', flex: 0.5, minWidth: 110 },
      { field: 'side', headerName: 'Side', flex: 0.4, minWidth: 100 },
      { field: 'sector', headerName: 'Sector', flex: 0.5, minWidth: 120 },
      { field: 'priority', headerName: 'Priority', flex: 0.4, minWidth: 100 },
      {
        field: 'jurisdictions',
        headerName: 'Jurisdictions',
        flex: 0.6,
        minWidth: 140,
        valueGetter: (_value, row) => (row.jurisdictions ?? []).join(', '),
        renderCell: (params) => (
          <Typography variant="body2">
            {(params.row?.jurisdictions ?? []).length > 0
              ? (params.row?.jurisdictions ?? []).join(', ')
              : '—'}
          </Typography>
        ),
      },
      {
        field: 'assignmentWindow',
        headerName: 'Assignment Window',
        flex: 0.8,
        minWidth: 170,
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 110,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Confirm project">
              <span>
                <IconButton
                  size="small"
                  color="success"
                  disabled={!permissions.canEditProject || confirmProject.isPending}
                  onClick={() => handleConfirmProject(params.row.projectId)}
                >
                  <CheckCircle fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {permissions.canEditProject && (
              <Tooltip title="Edit project">
                <IconButton
                  size="small"
                  onClick={() => navigate(`/projects/${params.row.projectId}/edit`)}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
      },
    ],
    [navigate, permissions.canEditProject, confirmProject.isPending, handleConfirmProject]
  );

  const activeProjects = useMemo(
    () => groupedList.filter((item) => item.project?.status === 'Active' || item.project?.status === 'Slow-down'),
    [groupedList]
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!staff) {
    return <Typography>Staff member not found</Typography>;
  }

  return (
    <Page>
      <PageHeader
        title={
          <Stack direction="row" spacing={2} alignItems="center">
            <Button startIcon={<ArrowBack />} onClick={goBack}>
              Back
            </Button>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {staff.name}
            </Typography>
            <Chip label={staff.status} color={staff.status === 'active' ? 'success' : 'default'} size="small" />
          </Stack>
        }
        actions={
          permissions.canEditStaff && (
            <Button
              variant="contained"
              size="small"
              startIcon={<Edit />}
              onClick={() => navigate(`/staff/${id}/edit`)}
              sx={{ height: 36 }}
            >
              Edit
            </Button>
          )
        }
      />
      <Stack spacing={2}>
        {/* Staff Information */}
        <Paper sx={{ p: 2, borderRadius: 1.5 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Position
              </Typography>
              <Typography>{staff.position}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Department
              </Typography>
              <Typography>{staff.department || '-'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Email
              </Typography>
              <Typography>{staff.email || '-'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Active Projects
              </Typography>
              <Typography variant="h6">{activeProjects.length}</Typography>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Notes
              </Typography>
              <Typography>{staff.notes || 'No notes available'}</Typography>
            </Grid>
          </Grid>
        </Paper>

        <Section title="Project Load Timeline" sx={{ borderRadius: 1.5 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              {[
                { label: 'Now', value: workloadStats.now.toFixed(0) },
                { label: 'Peak (13 weeks)', value: workloadStats.peak.toFixed(0) },
                { label: 'Avg Past', value: workloadStats.avgPast.toFixed(1) },
                { label: 'Avg Forward', value: workloadStats.avgForward.toFixed(1) },
              ].map((item) => (
                <Paper key={item.label} variant="outlined" sx={{ p: 1.5, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {item.value}
                  </Typography>
                </Paper>
              ))}
            </Stack>

            <Paper variant="outlined" sx={{ p: 2 }}>
              {workloadTimeline.length > 0 ? (
                <>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${workloadTimeline.length}, minmax(0, 1fr))`,
                      gap: 1,
                      alignItems: 'end',
                      height: 170,
                    }}
                  >
                    {(() => {
                      const maxCount = Math.max(...workloadTimeline.map((point) => point.count), 1);

                      return workloadTimeline.map((point) => {
                        const barHeight = Math.max(10, (point.count / maxCount) * 95);
                        return (
                          <Stack key={point.key} spacing={0.5} alignItems="center" justifyContent="flex-end">
                            <Typography variant="caption" color="text.secondary">
                              {point.count}
                            </Typography>
                            <Tooltip title={`${formatCompactDate(point.weekStart)} - ${formatCompactDate(point.weekEnd)}: ${point.count} projects`}>
                              <Box
                                sx={{
                                  width: { xs: 10, sm: 14 },
                                  height: `${barHeight}px`,
                                  borderRadius: 1.5,
                                  bgcolor: point.isCurrent ? 'primary.main' : 'grey.400',
                                  opacity: point.isCurrent ? 1 : 0.85,
                                  transition: 'all 0.2s ease',
                                }}
                              />
                            </Tooltip>
                            <Typography
                              variant="caption"
                              sx={{ color: point.isCurrent ? 'primary.main' : 'text.secondary', fontWeight: point.isCurrent ? 700 : 500 }}
                            >
                              {point.shortLabel}
                            </Typography>
                          </Stack>
                        );
                      });
                    })()}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                    Weekly distinct project count. Forward view assumes ongoing assignments unless an assignment end date is set.
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No assignment history available to render timeline.
                </Typography>
              )}
            </Paper>
          </Stack>
        </Section>

        {/* Projects Table and Change History */}
        <Box>
          <Stack spacing={3}>
            <Section title="Project Assignments" sx={{ p: { xs: 0.5, md: 1 }, overflow: 'hidden', borderRadius: 1.5 }}>
              {projectRows.length > 0 ? (
                <Box sx={{ width: '100%', overflow: 'auto' }}>
                  <StyledDataGrid
                    rows={projectRows}
                    columns={projectColumns}
                    autoHeight
                    disableRowSelectionOnClick
                    pageSizeOptions={[5, 10, 25]}
                    initialState={{
                      pagination: { paginationModel: { pageSize: 10 } },
                      sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
                    }}
                    onRowClick={(params) => navigate(`/projects/${params.row.projectId}`)}
                    loading={loading}
                  />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No project assignments
                </Typography>
              )}
            </Section>

            <Section title="Change History" sx={{ borderRadius: 1.5 }}>
              {changeHistory.length > 0 ? (
                <List>
                  {changeHistory.map((change) => (
                    <ListItem key={change.id}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {getActionIcon(change.changeType)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="body2" component="span" fontWeight="medium">
                              {change.fieldName}:{' '}
                            </Typography>
                            <Typography variant="body2" component="span" color="text.secondary">
                              {change.oldValue || '(empty)'}
                            </Typography>
                            <Typography variant="body2" component="span">
                              {' '}
                              →{' '}
                            </Typography>
                            <Typography variant="body2" component="span" color="primary">
                              {change.newValue || '(empty)'}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <>
                            {DateHelpers.formatDateTime(change.changedAt)}
                            {change.username && ` • by ${change.username}`}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No changes recorded
                </Typography>
              )}
            </Section>
          </Stack>
        </Box>
      </Stack>
    </Page>
  );
};

export default StaffDetail;
