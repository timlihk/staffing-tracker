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
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/projects')}
          >
            Back
          </Button>
          <Typography variant="h4">{project.name}</Typography>
          <Chip label={project.status} color={statusColor} />
        </Box>
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={() => navigate(`/projects/${id}/edit`)}
        >
          Edit
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Project Information
            </Typography>
            <Divider sx={{ mb: 2 }} />

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
                  Start Date
                </Typography>
                <Typography>
                  {project.startDate
                    ? new Date(project.startDate).toLocaleDateString()
                    : '-'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Target Filing Date
                </Typography>
                <Typography>
                  {project.targetFilingDate
                    ? new Date(project.targetFilingDate).toLocaleDateString()
                    : '-'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Notes
                </Typography>
                <Typography>{project.notes || 'No notes available'}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Team Members
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {project.assignments && project.assignments.length > 0 ? (
              <List dense>
                {project.assignments.map((assignment) => (
                  <ListItem key={assignment.id}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight="medium">
                            {assignment.staff?.name}
                          </Typography>
                          {assignment.isLead && (
                            <Chip label="Lead" size="small" color="primary" />
                          )}
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
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Status History
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {project.statusHistory && project.statusHistory.length > 0 ? (
              <List>
                {project.statusHistory.map((history) => (
                  <ListItem key={history.id}>
                    <ListItemText
                      primary={
                        history.oldStatus
                          ? `${history.oldStatus} → ${history.newStatus}`
                          : history.newStatus
                      }
                      secondary={
                        <>
                          {new Date(history.changedAt).toLocaleString()}
                          {history.user?.username && ` • by ${history.user.username}`}
                          {history.changeReason && ` • ${history.changeReason}`}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <List>
                <ListItem>
                  <ListItemText
                    primary={`Status: ${project.status}`}
                    secondary={`Updated: ${new Date(project.updatedAt).toLocaleString()}`}
                  />
                </ListItem>
              </List>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Change History
            </Typography>
            <Divider sx={{ mb: 2 }} />
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
                          <Typography variant="body2" component="span"> → </Typography>
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
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProjectDetail;
