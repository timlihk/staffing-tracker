import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, MenuItem, Chip, IconButton, Typography } from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { Staff as StaffType } from '../types';
import { Page, StaffListSkeleton, PageHeader, PageToolbar, StyledDataGrid, EmptyState, Section } from '../components/ui';
import { ExportButton, type ExportFormat } from '../components/ExportButton';
import { useStaff, useDeleteStaff } from '../hooks/useStaff';
import { useAppSettings } from '../hooks/useAppSettings';
import { downloadCsv, downloadJson, type CsvColumn } from '../lib/export';

const Staff: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const navigate = useNavigate();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 800);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Build params for the query
  const params = {
    page: page + 1, // API uses 1-based indexing
    limit: pageSize,
    ...(positionFilter !== 'all' && { position: positionFilter }),
    ...(departmentFilter !== 'all' && { department: departmentFilter }),
    ...(searchTerm && { search: searchTerm }),
  };

  const { data, isLoading, error } = useStaff(params);
  const { data: appSettings } = useAppSettings();
  const enableDataExport = appSettings?.enableDataExport ?? false;

  const staff = data?.data || [];
  const totalCount = data?.pagination?.total || 0;

  // CSV export columns
  const csvColumns: CsvColumn<StaffType>[] = [
    { header: 'Name', key: 'name' },
    { header: 'Position', key: 'position' },
    { header: 'Department', key: 'department' },
    { header: 'Email', key: 'email' },
    { header: 'Status', key: 'status' },
    { header: 'Notes', key: 'notes' },
  ];

  // Handle export
  const handleExport = (format: ExportFormat) => {
    if (staff.length === 0) return;

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `staff-${timestamp}`;

    switch (format) {
      case 'csv':
        downloadCsv(staff, csvColumns, filename);
        break;
      case 'json':
        downloadJson(staff, filename);
        break;
      case 'print':
        window.print();
        break;
      default:
        break;
    }
  };

  const handlePaginationModelChange = (model: { page: number; pageSize: number }) => {
    setPage(model.page);
    setPageSize(model.pageSize);
  };
  const deleteStaff = useDeleteStaff();

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?\n\nSTRONGLY RECOMMENDED: Instead of deleting, change the status from Active to Leaving.`)) {
      await deleteStaff.mutateAsync(id);
    }
  };

  const columns: GridColDef<StaffType>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Box
          sx={{ fontWeight: 600, color: 'primary.main', cursor: 'pointer' }}
          onClick={() => navigate(`/staff/${params.row.id}`)}
        >
          {params.value}
        </Box>
      ),
    },
    { field: 'position', headerName: 'Position', flex: 1, minWidth: 150 },
    { field: 'department', headerName: 'Department', flex: 0.7, minWidth: 120 },
    { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 200 },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.5,
      minWidth: 100,
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
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: '100%' }}>
          <IconButton size="small" onClick={() => navigate(`/staff/${params.row.id}/edit`)}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id, params.row.name)}
            color="error"
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Staff" />
      {isLoading ? (
        <Section>
          <StaffListSkeleton />
        </Section>
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
              {enableDataExport && (
                <ExportButton
                  onExport={handleExport}
                  disabled={staff.length === 0}
                  showExcel={false}
                  tooltipText="Export staff list"
                />
              )}
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
                label="Position"
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 130 }}
              >
                <MenuItem value="all">All Positions</MenuItem>
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
                sx={{ flex: 1, minWidth: 110 }}
              >
                <MenuItem value="all">All Departments</MenuItem>
                <MenuItem value="US Law">US Law</MenuItem>
                <MenuItem value="HK Law">HK Law</MenuItem>
              </TextField>
            </PageToolbar>
          </Section>

          {/* Data Grid */}
          {staff.length === 0 && !isLoading ? (
            <Section>
              <EmptyState
                title="No staff found"
                subtitle="Add your first staff member to get started"
                actionLabel="New Staff"
                onAction={() => navigate('/staff/new')}
              />
            </Section>
          ) : (
            <Section sx={{ p: { xs: 0.5, md: 1 }, overflow: 'hidden', borderRadius: 1.5 }}>
              <Box sx={{ width: '100%', overflow: 'auto' }}>
                <StyledDataGrid
                  rows={staff}
                  columns={columns}
                  autoHeight
                  rowCount={totalCount}
                  pagination
                  paginationMode="server"
                  paginationModel={{ page, pageSize }}
                  onPaginationModelChange={handlePaginationModelChange}
                  pageSizeOptions={[25, 50, 100]}
                  loading={isLoading}
                  onRowClick={(params) => navigate(`/staff/${params.row.id}`)}
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
        </>
      )}
    </Page>
  );
};

export default Staff;
