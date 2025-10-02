import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import api from '../api/client';
import { Staff } from '../types';

const Staff: React.FC = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchStaff();
  }, [roleFilter, departmentFilter]);

  const fetchStaff = async () => {
    try {
      const params: any = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      if (departmentFilter !== 'all') params.department = departmentFilter;

      const response = await api.get('/staff', { params });
      setStaff(response.data);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await api.delete(`/staff/${id}`);
        fetchStaff();
      } catch (error) {
        console.error('Failed to delete staff:', error);
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Staff</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/staff/new')}
        >
          New Staff
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            select
            label="Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="Income Partner">Income Partner</MenuItem>
            <MenuItem value="Associate">Associate</MenuItem>
            <MenuItem value="Senior FLIC">Senior FLIC</MenuItem>
            <MenuItem value="Junior FLIC">Junior FLIC</MenuItem>
            <MenuItem value="Intern">Intern</MenuItem>
          </TextField>
          <TextField
            select
            label="Department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Departments</MenuItem>
            <MenuItem value="US Law">US Law</MenuItem>
            <MenuItem value="HK Law">HK Law</MenuItem>
            <MenuItem value="B&C">B&C</MenuItem>
          </TextField>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No staff found
                </TableCell>
              </TableRow>
            ) : (
              staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                    onClick={() => navigate(`/staff/${member.id}`)}
                  >
                    <Typography variant="body2" color="primary" fontWeight="medium">
                      {member.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>{member.department || '-'}</TableCell>
                  <TableCell>{member.email || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={member.status}
                      color={member.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/staff/${member.id}`)}
                    >
                      <Visibility />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/staff/${member.id}/edit`)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(member.id)}
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Staff;
