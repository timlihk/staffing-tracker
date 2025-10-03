import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Button, TextField, MenuItem, Chip, IconButton, Typography } from '@mui/material';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { Staff as StaffType } from '../types';
import { Page, StaffListSkeleton, PageHeader, PageToolbar, StyledDataGrid, EmptyState } from '../components/ui';
import { useStaff, useDeleteStaff } from '../hooks/useStaff';

const Staff: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const navigate = useNavigate();

  // Build params for the query
  const params = {
    ...(roleFilter !== 'all' && { role: roleFilter }),
    ...(departmentFilter !== 'all' && { department: departmentFilter }),
    ...(searchTerm && { search: searchTerm }),
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

  const staffCountLabel = !isLoading && !error ? `${staff.length} staff` : undefined;

  return (
    <Page>
      <PageHeader title="Staff" subtitle={staffCountLabel} />
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
            <PageToolbar>
              <TextField
                label="Search"
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ width: { xs: '100%', sm: 300 } }}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/staff/new')}
                sx={{ flexShrink: 0 }}
              >
                New Staff
              </Button>
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
            </PageToolbar>
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
