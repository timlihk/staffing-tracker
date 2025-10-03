import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Add,
  Update,
  Delete as DeleteIcon,
  ChangeCircle,
} from '@mui/icons-material';
import api from '../api/client';
import { Project, ChangeHistory } from '../types';
import { Page, Section, PageHeader } from '../components/ui';

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

  const teamAssignments = (project.assignments || []).filter(
    (assignment) => assignment.jurisdiction !== 'B&C' && assignment.roleInProject !== 'B&C Working Attorney'
  );

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

        {/* Project Details Grid */}
        <Grid container spacing={2}>
          {/* Left Column - Project Info */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Project Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={6}>
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
                      CATEGORY
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                      {project.category || '-'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
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
                      PRIORITY
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                      {project.priority || '-'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
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
                      EL STATUS
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                      {project.elStatus || '-'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
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
                      TIMETABLE
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                      {project.timetable ? project.timetable.replace('_', '-').replace('PRE-A1', 'Pre-A1') : '-'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
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
                      FILING DATE
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                      {project.filingDate ? project.filingDate.slice(0, 10) : '-'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
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
                      LISTING DATE
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                      {project.listingDate ? project.listingDate.slice(0, 10) : '-'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
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
                      B&C ATTORNEY
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                      {project.bcAttorney || '-'}
                    </Typography>
                  </Box>
                </Grid>
                {project.notes && (
                  <Grid item xs={12}>
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
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>

          {/* Team Members */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Team Members
              </Typography>
              {teamAssignments.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Jurisdiction</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamAssignments.map((assignment) => (
                        <TableRow
                          key={assignment.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/staff/${assignment.staffId}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} color="primary.main">
                              {assignment.staff?.name || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>{assignment.roleInProject}</TableCell>
                          <TableCell>{assignment.jurisdiction || '—'}</TableCell>
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
          </Grid>
        </Grid>

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
    </Page>
  );
};

export default ProjectDetail;
