import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Button,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  CircularProgress,
  Stack,
} from '@mui/material';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import api from '../api/client';
import { Project } from '../types';
import { Page } from '../components/ui';
import StyledDataGrid from '../components/ui/StyledDataGrid';
import EmptyState from '../components/ui/EmptyState';

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  Active: 'success',
  'Slow-down': 'warning',
  Suspended: 'error',
};

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, [statusFilter, categoryFilter]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (searchTerm) params.search = searchTerm;

      const response = await api.get('/projects', { params });
      setProjects(response.data.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await api.delete(`/projects/${id}`);
        fetchProjects();
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const handleSearch = () => {
    fetchProjects();
  };

  const columns: GridColDef<Project>[] = [
    {
      field: 'projectCode',
      headerName: 'Project Code',
      flex: 1,
      minWidth: 250,
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
          <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
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
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            sx={{ flexGrow: 1, minWidth: 200 }}
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
          <Button variant="contained" onClick={handleSearch}>
            Search
          </Button>
        </Stack>
      </Paper>

      {/* Data Grid */}
      {projects.length === 0 ? (
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
            loading={loading}
            autoHeight
            initialState={{
              pagination: { paginationModel: { pageSize: 50 } },
            }}
            pageSizeOptions={[25, 50, 100]}
            onRowClick={(params) => navigate(`/projects/${params.row.id}`)}
            sx={{ cursor: 'pointer' }}
          />
        </Paper>
      )}
    </Page>
  );
};

export default Projects;
