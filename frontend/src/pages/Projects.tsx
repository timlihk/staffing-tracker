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
import { Project } from '../types';
import { Page, ProjectListSkeleton } from '../components/ui';
import StyledDataGrid from '../components/ui/StyledDataGrid';
import EmptyState from '../components/ui/EmptyState';
import { useProjects, useDeleteProject } from '../hooks/useProjects';

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  Active: 'success',
  'Slow-down': 'warning',
  Suspended: 'error',
};

const Projects: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const navigate = useNavigate();

  // Build params for the query
  const params = {
    limit: 1000,
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(categoryFilter !== 'all' && { category: categoryFilter }),
    ...(searchTerm && { search: searchTerm }),
  };

  const { data, isLoading, error } = useProjects(params);
  const deleteProject = useDeleteProject();

  const projects = data?.data || [];

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const columns: GridColDef<Project>[] = [
    {
      field: 'name',
      headerName: 'Project Code',
      width: 280,
      renderCell: (params) => (
        <Box
          sx={{ fontWeight: 600, color: 'primary.main', cursor: 'pointer' }}
          onClick={() => navigate(`/projects/${params.row.id}`)}
        >
          {params.value}
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={statusColors[params.value] || 'default'}
          size="small"
        />
      ),
    },
    { field: 'category', headerName: 'Category', width: 200 },
    { field: 'priority', headerName: 'Priority', width: 100 },
    { field: 'elStatus', headerName: 'EL Status', width: 150 },
    { field: 'timetable', headerName: 'Timetable', width: 120 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      renderCell: (params) => (
        <Box onClick={(e) => e.stopPropagation()}>
          <IconButton size="small" onClick={() => navigate(`/projects/${params.row.id}`)}>
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => navigate(`/projects/${params.row.id}/edit`)}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(params.row.id)}
            disabled={deleteProject.isPending}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Box sx={{ textAlign: 'center' }}>
          <Typography color="error" variant="h6" gutterBottom>
            Failed to load projects
          </Typography>
          <Typography color="text.secondary">
            Please try again later or contact support if the problem persists.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Page
      title="Projects"
      actions={
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/projects/new')}>
          New Project
        </Button>
      }
    >
      {/* Filters */}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 300 }}
          />
          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Slow-down">Slow-down</MenuItem>
            <MenuItem value="Suspended">Suspended</MenuItem>
          </TextField>
          <TextField
            select
            label="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Categories</MenuItem>
            <MenuItem value="HK Transaction Projects">HK Transaction</MenuItem>
            <MenuItem value="US Transaction Projects">US Transaction</MenuItem>
            <MenuItem value="HK Compliance Projects">HK Compliance</MenuItem>
            <MenuItem value="US Compliance Projects">US Compliance</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      {/* Data Grid */}
      {isLoading ? (
        <ProjectListSkeleton />
      ) : projects.length === 0 ? (
        <Paper>
          <EmptyState
            title="No projects found"
            subtitle="Create your first project to get started"
            actionLabel="New Project"
            onAction={() => navigate('/projects/new')}
          />
        </Paper>
      ) : (
        <Paper sx={{ p: 1 }}>
          <StyledDataGrid
            rows={projects}
            columns={columns}
            loading={isLoading}
            autoHeight
            initialState={{
              pagination: { paginationModel: { pageSize: 100 } },
            }}
            pageSizeOptions={[25, 50, 100, 200]}
            onRowClick={(params) => navigate(`/projects/${params.row.id}`)}
            sx={{ cursor: 'pointer' }}
          />
        </Paper>
      )}
    </Page>
  );
};

export default Projects;
