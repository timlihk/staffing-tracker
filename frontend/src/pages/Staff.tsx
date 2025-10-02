import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Button,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { Staff as StaffType } from '../types';
import { Page, StaffListSkeleton } from '../components/ui';
import StyledDataGrid from '../components/ui/StyledDataGrid';
import EmptyState from '../components/ui/EmptyState';
import { useStaff, useDeleteStaff } from '../hooks/useStaff';

const Staff: React.FC = () => {
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const navigate = useNavigate();

  // Build params for the query
  const params = {
    ...(roleFilter !== 'all' && { role: roleFilter }),
    ...(departmentFilter !== 'all' && { department: departmentFilter }),
  };

  const { data: staff = [], isLoading, error } = useStaff(params);
  const deleteStaff = useDeleteStaff();

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await deleteStaff.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete staff:', error);
      }
    }
  };

  const columns: GridColDef<StaffType>[] = [
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      renderCell: (params) => (
        <Box
          sx={{ fontWeight: 600, color: 'primary.main', cursor: 'pointer' }}
          onClick={() => navigate(`/staff/${params.row.id}`)}
        >
          {params.value}
        </Box>
      ),
    },
    { field: 'role', headerName: 'Role', width: 200 },
    { field: 'department', headerName: 'Department', width: 150 },
    { field: 'email', headerName: 'Email', width: 250 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === 'active' ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      renderCell: (params) => (
        <Box onClick={(e) => e.stopPropagation()}>
          <IconButton size="small" onClick={() => navigate(`/staff/${params.row.id}`)}>
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => navigate(`/staff/${params.row.id}/edit`)}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(params.row.id)}
            disabled={deleteStaff.isPending}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Page
      title="Staff"
      actions={
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/staff/new')}>
          New Staff
        </Button>
      }
    >
      {isLoading ? (
        <StaffListSkeleton />
      ) : error ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Box sx={{ textAlign: 'center' }}>
            <Typography color="error" variant="h6" gutterBottom>
              Failed to load staff
            </Typography>
            <Typography color="text.secondary">
              Please try again later or contact support if the problem persists.
            </Typography>
          </Box>
        </Box>
      ) : (
        <>
      {/* Filters */}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <TextField
            select
            label="Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="Partner">Partner</MenuItem>
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
        </Stack>
      </Paper>

      {/* Data Grid */}
      {staff.length === 0 ? (
        <Paper>
          <EmptyState
            title="No staff found"
            subtitle="Add your first staff member to get started"
            actionLabel="New Staff"
            onAction={() => navigate('/staff/new')}
          />
        </Paper>
      ) : (
        <Paper sx={{ p: 1 }}>
          <StyledDataGrid
            rows={staff}
            columns={columns}
            autoHeight
            initialState={{
              pagination: { paginationModel: { pageSize: 50 } },
            }}
            pageSizeOptions={[25, 50, 100]}
            onRowClick={(params) => navigate(`/staff/${params.row.id}`)}
            sx={{ cursor: 'pointer' }}
          />
        </Paper>
      )}
      </>
      )}
    </Page>
  );
};

export default Staff;
