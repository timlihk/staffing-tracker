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
} from '@mui/material';
import { ArrowBack, Edit } from '@mui/icons-material';
import api from '../api/client';
import { Project } from '../types';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await api.get(`/projects/${id}`);
        setProject(response.data);
      } catch (error) {
        console.error('Failed to fetch project:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
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
            <Typography variant="body2" color="text.secondary">
              Team assignment information will be displayed here
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Status History
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              <ListItem>
                <ListItemText
                  primary={`Status: ${project.status}`}
                  secondary={`Updated: ${new Date(project.updatedAt).toLocaleString()}`}
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProjectDetail;
