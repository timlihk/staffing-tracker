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
  Autocomplete,
  Divider,
  IconButton,
  Stack,
} from '@mui/material';
import { ArrowBack, Save, Delete, Add } from '@mui/icons-material';
import api from '../api/client';
import { Project, Staff } from '../types';
import { Page } from '../components/ui';

interface TeamMember {
  staffId: number;
  roleInProject: string;
  jurisdiction: string;
  allocationPercentage: number;
  isLead: boolean;
}

const ProjectForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    projectCode: '',
    category: '',
    status: 'Active',
    priority: 'Medium',
    elStatus: '',
    startDate: '',
    timetable: '',
    notes: '',
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const isEdit = id !== 'new';

  useEffect(() => {
    fetchStaff();
    if (isEdit) {
      fetchProject();
    }
  }, [id]);

  const fetchStaff = async () => {
    try {
      const response = await api.get('/staff');
      setStaffList(response.data);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    }
  };

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
        elStatus: project.elStatus || '',
        startDate: project.startDate
          ? new Date(project.startDate).toISOString().split('T')[0]
          : '',
        timetable: project.timetable || '',
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
      let projectId = id;

      if (isEdit) {
        await api.put(`/projects/${id}`, formData);
      } else {
        const response = await api.post('/projects', formData);
        projectId = response.data.id;
      }

      // Create team assignments
      if (teamMembers.length > 0 && projectId) {
        const assignments = teamMembers.map(member => ({
          projectId: parseInt(projectId as string),
          ...member
        }));
        await api.post('/assignments/bulk', { assignments });
      }

      navigate('/projects');
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const addTeamMember = () => {
    setTeamMembers([
      ...teamMembers,
      {
        staffId: 0,
        roleInProject: 'Associate',
        jurisdiction: 'US Law',
        allocationPercentage: 100,
        isLead: false,
      },
    ]);
  };

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: any) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  return (
    <Page
      title={
        <Stack direction="row" spacing={2} alignItems="center">
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/projects')}>
            Back
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {isEdit ? 'Edit Project' : 'New Project'}
          </Typography>
        </Stack>
      }
    >
      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
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
                label="EL Status"
                name="elStatus"
                value={formData.elStatus}
                onChange={handleChange}
              />
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
                label="Timetable"
                name="timetable"
                value={formData.timetable}
                onChange={handleChange}
                placeholder="e.g., Q1 2025, March 15, etc."
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
              <Divider sx={{ my: 2 }} />
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Team Members</Typography>
                <Button
                  startIcon={<Add />}
                  onClick={addTeamMember}
                  variant="outlined"
                  size="small"
                >
                  Add Team Member
                </Button>
              </Box>

              {teamMembers.map((member, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={3}>
                      <Autocomplete
                        options={staffList}
                        getOptionLabel={(option) => option.name}
                        value={staffList.find(s => s.id === member.staffId) || null}
                        onChange={(_, newValue) => {
                          updateTeamMember(index, 'staffId', newValue?.id || 0);
                        }}
                        renderInput={(params) => (
                          <TextField {...params} label="Staff Member" size="small" required />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Role"
                        value={member.roleInProject}
                        onChange={(e) => updateTeamMember(index, 'roleInProject', e.target.value)}
                      >
                        <MenuItem value="IP">Income Partner</MenuItem>
                        <MenuItem value="Associate">Associate</MenuItem>
                        <MenuItem value="Senior FLIC">Senior FLIC</MenuItem>
                        <MenuItem value="Junior FLIC">Junior FLIC</MenuItem>
                        <MenuItem value="Intern">Intern</MenuItem>
                        <MenuItem value="B&C Working Attorney">B&C Working Attorney</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Jurisdiction"
                        value={member.jurisdiction}
                        onChange={(e) => updateTeamMember(index, 'jurisdiction', e.target.value)}
                      >
                        <MenuItem value="US Law">US Law</MenuItem>
                        <MenuItem value="HK Law">HK Law</MenuItem>
                        <MenuItem value="B&C">B&C</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Allocation %"
                        value={member.allocationPercentage}
                        onChange={(e) => updateTeamMember(index, 'allocationPercentage', parseInt(e.target.value))}
                        inputProps={{ min: 0, max: 100 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Lead"
                        value={member.isLead ? 'Yes' : 'No'}
                        onChange={(e) => updateTeamMember(index, 'isLead', e.target.value === 'Yes')}
                      >
                        <MenuItem value="Yes">Yes</MenuItem>
                        <MenuItem value="No">No</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={1}>
                      <IconButton
                        onClick={() => removeTeamMember(index)}
                        color="error"
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
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
    </Page>
  );
};

export default ProjectForm;
