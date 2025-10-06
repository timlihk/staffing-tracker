import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Button, TextField, MenuItem, Chip, IconButton, Typography, Autocomplete } from '@mui/material';
import { Add, Edit } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { Project, Staff } from '../types';
import { Page, ProjectListSkeleton, PageHeader, PageToolbar, StyledDataGrid, EmptyState } from '../components/ui';
import { useProjects } from '../hooks/useProjects';
import { usePermissions } from '../hooks/usePermissions';
import { useStaff } from '../hooks/useStaff';

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  Active: 'success',
  'Slow-down': 'warning',
  Suspended: 'error',
};

const Projects: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const navigate = useNavigate();
  const permissions = usePermissions();

  const { data: allStaff = [] } = useStaff({});

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build params for the query
  const params = {
    limit: 1000,
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(categoryFilter !== 'all' && { category: categoryFilter }),
    ...(sideFilter !== 'all' && { side: sideFilter }),
    ...(sectorFilter !== 'all' && { sector: sectorFilter }),
    ...(searchTerm && { search: searchTerm }),
    ...(selectedStaff && { staffId: selectedStaff.id.toString() }),
  };

  const { data, isLoading, error } = useProjects(params);

  const projects = data?.data || [];

  const columns: GridColDef<Project>[] = [
    {
      field: 'name',
      headerName: 'Project Code',
      flex: 1,
      minWidth: 200,
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
      flex: 0.5,
      minWidth: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={statusColors[params.value] || 'default'}
          size="small"
        />
      ),
    },
    { field: 'category', headerName: 'Category', flex: 0.5, minWidth: 100 },
    { field: 'side', headerName: 'Side', flex: 0.5, minWidth: 100 },
    { field: 'sector', headerName: 'Sector', flex: 0.5, minWidth: 100 },
    { field: 'priority', headerName: 'Priority', flex: 0.4, minWidth: 90 },
    { field: 'elStatus', headerName: 'EL Status', flex: 0.5, minWidth: 100 },
    { field: 'timetable', headerName: 'Timetable', flex: 0.5, minWidth: 100 },
    {
      field: 'lastConfirmedAt',
      headerName: 'Last Confirmed',
      flex: 0.7,
      minWidth: 150,
      renderCell: (params) => {
        if (!params.row.lastConfirmedAt) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography variant="body2" color="warning.main" fontWeight={600}>Never confirmed</Typography>
            </Box>
          );
        }
        const daysAgo = Math.floor((Date.now() - new Date(params.row.lastConfirmedAt).getTime()) / (1000 * 60 * 60 * 24));
        const color = daysAgo > 7 ? 'warning.main' : daysAgo > 14 ? 'error.main' : 'text.secondary';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" color={color}>
              {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Box onClick={(e) => e.stopPropagation()}>
          {permissions.canEditProject && (
            <IconButton size="small" onClick={() => navigate(`/projects/${params.row.id}/edit`)}>
              <Edit fontSize="small" />
            </IconButton>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Projects" />
      {/* Filters */}
      <Paper sx={{ px: 0, py: 2 }}>
        <Box sx={{ px: 2 }}>
          <PageToolbar>
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ flex: 1, minWidth: 160 }}
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
            sx={{ flex: 1, minWidth: 100 }}
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
            sx={{ flex: 1, minWidth: 115 }}
          >
            <MenuItem value="all">All Categories</MenuItem>
            <MenuItem value="HK Trx">HK Trx</MenuItem>
            <MenuItem value="US Trx">US Trx</MenuItem>
            <MenuItem value="HK Comp">HK Comp</MenuItem>
            <MenuItem value="US Comp">US Comp</MenuItem>
          </TextField>
          <TextField
            select
            label="Side"
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 100 }}
          >
            <MenuItem value="all">All Sides</MenuItem>
            <MenuItem value="Issuer">Issuer</MenuItem>
            <MenuItem value="Underwriter">Underwriter</MenuItem>
          </TextField>
          <TextField
            select
            label="Sector"
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 100 }}
          >
            <MenuItem value="all">All Sectors</MenuItem>
            <MenuItem value="Healthcare">Healthcare</MenuItem>
            <MenuItem value="TMT">TMT</MenuItem>
            <MenuItem value="Consumer">Consumer</MenuItem>
            <MenuItem value="Industrial">Industrial</MenuItem>
          </TextField>
          <Autocomplete
            size="small"
            options={allStaff}
            value={selectedStaff}
            onChange={(_, v) => setSelectedStaff(v)}
            getOptionLabel={(option) => option.name}
            renderInput={(params) => <TextField {...params} label="Team Member" />}
            sx={{ flex: 1, minWidth: 135 }}
          />
        </PageToolbar>
        </Box>
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
        <Paper sx={{ p: 1, width: '100%', overflow: 'hidden' }}>
          <Box sx={{ width: '100%', overflow: 'auto' }}>
            <StyledDataGrid
              rows={projects}
              columns={columns}
              autoHeight
              initialState={{
                pagination: { paginationModel: { pageSize: 100 } },
              }}
              pageSizeOptions={[25, 50, 100, 200]}
              onRowClick={(params) => navigate(`/projects/${params.row.id}`)}
              getRowClassName={(params) => params.indexRelativeToCurrentPage % 2 === 0 ? 'even-row' : 'odd-row'}
              sx={{
                cursor: 'pointer',
                width: '100%',
                '& .even-row': {
                  bgcolor: 'grey.100',
                },
                '& .odd-row': {
                  bgcolor: 'white',
                },
                '& .even-row:hover': {
                  bgcolor: 'grey.200',
                },
                '& .odd-row:hover': {
                  bgcolor: 'grey.200',
                },
              }}
            />
          </Box>
        </Paper>
      )}
    </Page>
  );
};

export default Projects;
