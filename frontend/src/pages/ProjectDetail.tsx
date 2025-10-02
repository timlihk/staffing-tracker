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
import { Page, Section } from '../components/ui';

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

  return (
    <Page
      title={
        <Stack direction="row" spacing={2} alignItems="center">
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/projects')}>
            Back
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {project.name}
          </Typography>
          <Chip label={project.status} color={statusColor} />
        </Stack>
      }
      actions={
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={() => navigate(`/projects/${id}/edit`)}
        >
          Edit
        </Button>
      }
    >
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Section title="Project Information">
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Category
                </Typography>
                <Typography>{project.category || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Priority
                </Typography>
                <Typography>{project.priority || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  EL Status
                </Typography>
                <Typography>{project.elStatus || '-'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Start Date
                </Typography>
                <Typography>
                  {project.startDate ? new Date(project.startDate).toLocaleDateString() : '-'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Timetable
                </Typography>
                <Typography>{project.timetable || '-'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Notes
                </Typography>
                <Typography>{project.notes || 'No notes available'}</Typography>
              </Grid>
            </Grid>
          </Section>
        </Grid>

        <Grid item xs={12} md={4}>
          <Section title="Team Members">
            {project.assignments && project.assignments.length > 0 ? (
              <List dense>
                {project.assignments.map((assignment) => (
                  <ListItem
                    key={assignment.id}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                    onClick={() => navigate(`/staff/${assignment.staffId}`)}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            sx={{
                              color: 'primary.main',
                              '&:hover': {
                                textDecoration: 'underline',
                              },
                            }}
                          >
                            {assignment.staff?.name}
                          </Typography>
                          {assignment.isLead && <Chip label="Lead" size="small" color="primary" />}
                        </Box>
                      }
                      secondary={
                        <>
                          {assignment.roleInProject}
                          {assignment.jurisdiction && ` • ${assignment.jurisdiction}`}
                          {assignment.allocationPercentage &&
                            ` • ${assignment.allocationPercentage}%`}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No team members assigned
              </Typography>
            )}
          </Section>
        </Grid>

        <Grid item xs={12}>
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
        </Grid>
      </Grid>
    </Page>
  );
};

export default ProjectDetail;
