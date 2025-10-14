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

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  Active: 'success',
  'Slow-down': 'warning',
  Suspended: 'error',
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
        console.error('Failed to fetch staff:', error);
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [id]
  );

  useEffect(() => {
    loadStaff(true).catch((error) => console.error('Failed to initialize staff detail:', error));
  }, [loadStaff]);

  const assignments = useMemo(() => staff?.assignments ?? [], [staff]);

  // Group assignments by project
  const groupedAssignments = assignments.reduce((acc, assignment) => {
    const projectId = assignment.projectId ?? assignment.project?.id;
    if (!projectId) return acc;

    if (!acc[projectId]) {
      acc[projectId] = {
        project: assignment.project,
        projectId,
        jurisdictions: [],
      };
    }
    if (assignment.jurisdiction) {
      acc[projectId].jurisdictions.push(assignment.jurisdiction);
    }
    return acc;
  }, {} as Record<number, { project: Project | null | undefined; projectId: number; jurisdictions: string[] }>);

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
    elStatus: string;
    timetable: string;
    lastConfirmedAt: string | null | undefined;
    updatedAt: string | null | undefined;
    confirmedByName: string | null;
    jurisdictions: string[];
  };

  const projectRows: ProjectRow[] = useMemo(() => {
    return groupedList
      .map((item) => {
        if (!item.project) return null;
        return {
          id: item.projectId,
          projectId: item.projectId,
          name: item.project.name ?? '—',
          status: item.project.status ?? '—',
          category: item.project.category ?? '—',
          side: item.project.side ?? '—',
          sector: item.project.sector ?? '—',
          priority: item.project.priority ?? '—',
          elStatus: item.project.elStatus ?? '—',
          timetable: item.project.timetable ?? '—',
          lastConfirmedAt: item.project.lastConfirmedAt ?? null,
          updatedAt: item.project.updatedAt ?? null,
          confirmedByName: item.project.confirmedBy?.staff?.name || item.project.confirmedBy?.username || null,
          jurisdictions: item.jurisdictions ?? [],
        } as ProjectRow;
      })
      .filter((row): row is ProjectRow => row !== null);
  }, [groupedList]);

  const handleConfirmProject = useCallback(
    async (projectId: number) => {
      try {
        await confirmProject.mutateAsync(projectId);
        await loadStaff();
      } catch (error) {
        console.error('Failed to confirm project from staff detail:', error);
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
      { field: 'elStatus', headerName: 'EL Status', flex: 0.5, minWidth: 110 },
      { field: 'timetable', headerName: 'Timetable', flex: 0.5, minWidth: 110 },
      {
        field: 'lastConfirmedAt',
        headerName: 'Last Confirmed',
        flex: 0.8,
        minWidth: 170,
        renderCell: (params) => {
          const lastActivity = params.row.lastConfirmedAt ?? params.row.updatedAt ?? null;
          const isOverdue = !lastActivity
            ? true
            : Date.now() - new Date(lastActivity).getTime() > 7 * 24 * 60 * 60 * 1000;
          let label = '—';
          if (lastActivity) {
            const daysAgo = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
            label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
          }
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              {isOverdue && (
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                  }}
                />
              )}
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {label}
                </Typography>
                {params.row.confirmedByName && (
                  <Typography variant="caption" color="text.secondary">
                    {params.row.confirmedByName}
                  </Typography>
                )}
              </Box>
            </Stack>
          );
        },
      },
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
    () =>
      assignments.filter(
        (a) => a.project?.status === 'Active' || a.project?.status === 'Slow-down'
      ),
    [assignments]
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
        <Paper sx={{ p: 2 }}>
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

            <Section title="Change History">
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
                            {new Date(change.changedAt).toLocaleString()}
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
