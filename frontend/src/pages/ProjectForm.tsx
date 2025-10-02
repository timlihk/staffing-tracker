import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import api from '../api/client';
import { Project } from '../types';

const ProjectForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    projectCode: '',
    category: '',
    status: 'Active',
    priority: 'Medium',
    startDate: '',
    targetFilingDate: '',
    notes: '',
  });

  const isEdit = id !== 'new';

  useEffect(() => {
    if (isEdit) {
      fetchProject();
    }
  }, [id]);

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      const project: Project = response.data;
      setFormData({
        name: project.name,
        projectCode: project.projectCode || '',
        category: project.category || '',
        status: project.status,
        priority: project.priority || 'Medium',
        startDate: project.startDate
          ? new Date(project.startDate).toISOString().split('T')[0]
          : '',
        targetFilingDate: project.targetFilingDate
          ? new Date(project.targetFilingDate).toISOString().split('T')[0]
          : '',
        notes: project.notes || '',
      });
    } catch (error) {
      console.error('Failed to fetch project:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await api.put(`/projects/${id}`, formData);
      } else {
        await api.post('/projects', formData);
      }
      navigate('/projects');
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/projects')}>
          Back
        </Button>
        <Typography variant="h4">
          {isEdit ? 'Edit Project' : 'New Project'}
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                label="Project Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Project Code"
                name="projectCode"
                value={formData.projectCode}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Category"
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                <MenuItem value="HK Transaction Projects">HK Transaction</MenuItem>
                <MenuItem value="US Transaction Projects">US Transaction</MenuItem>
                <MenuItem value="HK Compliance Projects">HK Compliance</MenuItem>
                <MenuItem value="US Compliance Projects">US Compliance</MenuItem>
                <MenuItem value="Others">Others</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Slow-down">Slow-down</MenuItem>
                <MenuItem value="Suspended">Suspended</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
              >
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Start Date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Target Filing Date"
                name="targetFilingDate"
                value={formData.targetFilingDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                  disabled={loading}
                >
                  {isEdit ? 'Update' : 'Create'} Project
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/projects')}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default ProjectForm;
