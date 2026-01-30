import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, MenuItem, Chip, IconButton, Typography, Autocomplete } from '@mui/material';
import { Add, Edit } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { Project, Staff } from '../types';
import { Page, ProjectListSkeleton, PageHeader, PageToolbar, StyledDataGrid, EmptyState, Section } from '../components/ui';
import { ExportButton, type ExportFormat } from '../components/ExportButton';
import { useProjects } from '../hooks/useProjects';
import { usePermissions } from '../hooks/usePermissions';
import { useStaff } from '../hooks/useStaff';
import { DateHelpers } from '../lib/date';
import { downloadCsv, downloadJson, type CsvColumn, Formatters } from '../lib/export';

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  Active: 'success',
  'Slow-down': 'warning',
  Suspended: 'error',
  Closed: 'default',
  Terminated: 'error',
};

const Projects: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sideFilter, setSideFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const navigate = useNavigate();
  const permissions = usePermissions();

  const { data: allStaffResponse } = useStaff({});
  const allStaff = allStaffResponse?.data || [];

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build params for the query
  const params = {
    page,
    limit: pageSize,
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(categoryFilter !== 'all' && { category: categoryFilter }),
    ...(sideFilter !== 'all' && { side: sideFilter }),
    ...(sectorFilter !== 'all' && { sector: sectorFilter }),
    ...(searchTerm && { search: searchTerm }),
    ...(selectedStaff && { staffId: selectedStaff.id.toString() }),
  };

  const { data, isLoading, error } = useProjects(params);

  const projects = data?.data || [];

  // CSV export columns
  const csvColumns: CsvColumn<Project>[] = [
    { header: 'Project Name', key: 'name' },
    { header: 'Status', key: 'status' },
    { header: 'Category', key: 'category' },
    { header: 'Side', key: 'side' },
    { header: 'Sector', key: 'sector' },
    { header: 'Priority', key: 'priority' },
    { header: 'EL Status', key: 'elStatus' },
    { header: 'Filing Date', key: 'filingDate', formatter: (v) => Formatters.date(v) },
    { header: 'Listing Date', key: 'listingDate', formatter: (v) => Formatters.date(v) },
    { header: 'Last Confirmed', key: 'lastConfirmedAt', formatter: (v) => Formatters.date(v) },
    { header: 'Notes', key: 'notes' },
  ];

  // Handle export
  const handleExport = (format: ExportFormat) => {
    if (projects.length === 0) return;

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `projects-${timestamp}`;

    switch (format) {
      case 'csv':
        downloadCsv(projects, csvColumns, filename);
        break;
      case 'json':
        downloadJson(projects, filename);
        break;
      case 'print':
        window.print();
        break;
      default:
        break;
    }
  };

  const columns: GridColDef<Project>[] = [
    {
      field: 'name',
      headerName: 'Project Name',
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
    {
      field: 'filingDate',
      headerName: 'Filing Date',
      flex: 0.6,
      minWidth: 120,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {DateHelpers.formatDate(params.row.filingDate)}
        </Typography>
      ),
    },
    {
      field: 'listingDate',
      headerName: 'Listing Date',
      flex: 0.6,
      minWidth: 120,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {DateHelpers.formatDate(params.row.listingDate)}
        </Typography>
      ),
    },
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
        const daysAgo = DateHelpers.daysAgo(params.row.lastConfirmedAt);
        const color = daysAgo && daysAgo > 14 ? 'error.main' : daysAgo && daysAgo > 7 ? 'warning.main' : 'text.secondary';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" color={color}>
              {DateHelpers.formatDaysAgo(params.row.lastConfirmedAt)}
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
      <Section sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 1.5 }}>
        <PageToolbar>
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ flex: 1, minWidth: 160 }}
          />
          <ExportButton
            onExport={handleExport}
            disabled={projects.length === 0}
            showExcel={false}
            tooltipText="Export projects"
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
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Slow-down">Slow-down</MenuItem>
            <MenuItem value="Suspended">Suspended</MenuItem>
            <MenuItem value="Closed">Closed</MenuItem>
            <MenuItem value="Terminated">Terminated</MenuItem>
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
      </Section>

      {/* Data Grid */}
      {isLoading ? (
        <Section>
          <ProjectListSkeleton />
        </Section>
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
        <Section>
          <EmptyState
            title="No projects found"
            subtitle="Create your first project to get started"
            actionLabel="New Project"
            onAction={() => navigate('/projects/new')}
          />
        </Section>
      ) : (
        <Section sx={{ p: { xs: 0.5, md: 1 }, overflow: 'hidden', borderRadius: 1.5 }}>
          <Box sx={{ width: '100%', overflow: 'auto' }}>
            <StyledDataGrid
              rows={projects}
              columns={columns}
              autoHeight
              pagination
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: {
                  paginationModel: { page: page - 1, pageSize },
                },
              }}
              onPaginationModelChange={(model) => {
                setPage(model.page + 1);
                setPageSize(model.pageSize);
              }}
              onRowClick={(params) => navigate(`/projects/${params.row.id}`)}
              getRowClassName={(params) => (params.indexRelativeToCurrentPage % 2 === 0 ? 'even-row' : 'odd-row')}
              sx={{
                cursor: 'pointer',
                width: '100%',
                '& .even-row, & .odd-row': {
                  bgcolor: 'background.paper',
                },
                '& .even-row:hover, & .odd-row:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            />
          </Box>
        </Section>
      )}
    </Page>
  );
};

export default Projects;
