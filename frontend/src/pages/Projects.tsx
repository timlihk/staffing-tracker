import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Button, TextField, MenuItem, Chip, IconButton, Typography } from '@mui/material';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { Project } from '../types';
import { Page, ProjectListSkeleton, PageHeader, PageToolbar, StyledDataGrid, EmptyState } from '../components/ui';
import { useProjects, useDeleteProject } from '../hooks/useProjects';
import { usePermissions } from '../hooks/usePermissions';

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
  const permissions = usePermissions();

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
  const projectCountLabel = data ? `${projects.length} project${projects.length === 1 ? '' : 's'}` : undefined;

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
          {permissions.canEditProject && (
            <IconButton size="small" onClick={() => navigate(`/projects/${params.row.id}/edit`)}>
              <Edit fontSize="small" />
            </IconButton>
          )}
          {permissions.canDeleteProject && (
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDelete(params.row.id)}
              disabled={deleteProject.isPending}
            >
              <Delete fontSize="small" />
            </IconButton>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Projects" subtitle={projectCountLabel} />
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
          {permissions.canCreateProject && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/projects/new')}
              sx={{ flexShrink: 0 }}
            >
              New Project
            </Button>
          )}
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
            <MenuItem value="HK Trx">HK Trx</MenuItem>
            <MenuItem value="US Trx">US Trx</MenuItem>
            <MenuItem value="HK Comp">HK Comp</MenuItem>
            <MenuItem value="US Comp">US Comp</MenuItem>
          </TextField>
        </PageToolbar>
      </Paper>

      {/* Data Grid */}
      {isLoading ? (
        <ProjectListSkeleton />
      ) : error ? (
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
