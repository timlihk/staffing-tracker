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
import { Staff } from '../types';

const StaffForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    department: '',
    status: 'active',
    notes: '',
  });

  const isEdit = id !== 'new';

  useEffect(() => {
    if (isEdit) {
      fetchStaff();
    }
  }, [id]);

  const fetchStaff = async () => {
    try {
      const response = await api.get(`/staff/${id}`);
      const staff: Staff = response.data;
      setFormData({
        name: staff.name,
        email: staff.email || '',
        role: staff.role,
        department: staff.department || '',
        status: staff.status,
        notes: staff.notes || '',
      });
    } catch (error) {
      console.error('Failed to fetch staff:', error);
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
        await api.put(`/staff/${id}`, formData);
      } else {
        await api.post('/staff', formData);
      }
      navigate('/staff');
    } catch (error) {
      console.error('Failed to save staff:', error);
      alert('Failed to save staff member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/staff')}>
          Back
        </Button>
        <Typography variant="h4">
          {isEdit ? 'Edit Staff' : 'New Staff'}
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="email"
                label="Email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                required
                fullWidth
                label="Role"
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <MenuItem value="Income Partner">Income Partner</MenuItem>
                <MenuItem value="Associate">Associate</MenuItem>
                <MenuItem value="Senior FLIC">Senior FLIC</MenuItem>
                <MenuItem value="Junior FLIC">Junior FLIC</MenuItem>
                <MenuItem value="Intern">Intern</MenuItem>
                <MenuItem value="B&C Working Attorney">B&C Working Attorney</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleChange}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="US Law">US Law</MenuItem>
                <MenuItem value="HK Law">HK Law</MenuItem>
                <MenuItem value="B&C">B&C</MenuItem>
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
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="leaving">Leaving</MenuItem>
              </TextField>
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
                  {isEdit ? 'Update' : 'Create'} Staff
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/staff')}
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

export default StaffForm;
