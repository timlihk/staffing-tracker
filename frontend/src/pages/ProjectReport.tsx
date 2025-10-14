import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Autocomplete,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  CircularProgress,
} from '@mui/material';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import api from '../api/client';
import { useStaff } from '../hooks/useStaff';
import { usePermissions } from '../hooks/usePermissions';
import { Staff } from '../types';
import { Page, PageHeader } from '../components/ui';

type ProjectReportRow = {
  id: number;
  projectId: number;
  name: string;
  projectName: string;
  category: string;
  status: string;
  priority: string | null;
  filingDate: string | null;
  listingDate: string | null;

  usLawPartner: string | null;
  usLawAssociate: string | null;
  usLawSeniorFlic: string | null;
  usLawJuniorFlic: string | null;
  usLawIntern: string | null;

  hkLawPartner: string | null;
  hkLawAssociate: string | null;
  hkLawSeniorFlic: string | null;
  hkLawJuniorFlic: string | null;
  hkLawIntern: string | null;

  bcAttorney: string | null;

  milestone: string | null;
  notes: string | null;
};

const CATEGORY_OPTIONS = [
  'HK Trx',
  'US Trx',
  'HK Comp',
  'US Comp',
  'Others',
];

const STATUSES = ['Active', 'Slow-down', 'Suspended'];
const PRIORITIES = ['High', 'Medium', 'Low'];

function toCsvParam(values: string[]) {
  return values.length ? values.join(',') : undefined;
}

const ProjectReport: React.FC = () => {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const { data: allStaff = [] } = useStaff({});

  const [rows, setRows] = useState<ProjectReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [orderBy, setOrderBy] = useState<'projectName' | 'filingDate' | 'listingDate'>('projectName');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (categories.length) params.categories = toCsvParam(categories)!;
      if (statuses.length) params.statuses = toCsvParam(statuses)!;
      if (priorities.length) params.priorities = toCsvParam(priorities)!;
      if (selectedStaff) params.staffId = selectedStaff.id.toString();

      const res = await api.get('/project-reports', { params });

      const data = (res.data?.data ?? []) as ProjectReportRow[];
      const withIds = data.map((r) => ({
        ...r,
        id: r.projectId,
      }));
      setRows(withIds);
    } catch (error) {
      console.error('Failed to fetch project report:', error);
    } finally {
      setLoading(false);
    }
  }, [categories, statuses, priorities, selectedStaff]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReset = () => {
    setCategories([]);
    setStatuses([]);
    setPriorities([]);
    setSelectedStaff(null);
  };

  const onPrint = () => window.print();

  const onExportExcel = async () => {
    try {
      const params: Record<string, string> = {};
      if (categories.length) params.categories = toCsvParam(categories)!;
      if (statuses.length) params.statuses = toCsvParam(statuses)!;
      if (priorities.length) params.priorities = toCsvParam(priorities)!;
      if (selectedStaff) params.staffId = selectedStaff.id.toString();

      const response = await api.get('/project-reports/excel', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export Excel:', error);
      alert('Failed to export Excel file. Please try again.');
    }
  };

  const handleRequestSort = (property: 'projectName' | 'filingDate' | 'listingDate') => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedRows = React.useMemo(() => {
    const comparator = (a: ProjectReportRow, b: ProjectReportRow) => {
      const compare = (valueA: string | null, valueB: string | null) => {
        if (!valueA && !valueB) return 0;
        if (!valueA) return -1;
        if (!valueB) return 1;
        return valueA.localeCompare(valueB);
      };

      if (orderBy === 'projectName') {
        return order === 'asc'
          ? a.projectName.localeCompare(b.projectName)
          : b.projectName.localeCompare(a.projectName);
      }

      if (orderBy === 'filingDate') {
        return order === 'asc'
          ? compare(a.filingDate, b.filingDate)
          : compare(b.filingDate, a.filingDate);
      }

      return order === 'asc'
        ? compare(a.listingDate, b.listingDate)
        : compare(b.listingDate, a.listingDate);
    };
    return [...rows].sort(comparator);
  }, [rows, order, orderBy]);

  const headerActions =
    permissions.isAdmin || permissions.isEditor ? (
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={onExportExcel}>
          Export Excel
        </Button>
        <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={onPrint}>
          Print
        </Button>
      </Stack>
    ) : undefined;

  return (
    <Page>
      <Box className="no-print">
        <PageHeader title="Project Report" actions={headerActions} />
      </Box>

      {/* Horizontal Filter Bar */}
      <Paper className="no-print" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-end">
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Autocomplete
                  multiple
                  size="small"
                  options={CATEGORY_OPTIONS}
                  value={categories}
                  onChange={(_, v) => setCategories(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Project Type" placeholder="All" />
                  )}
                />
              </Box>

              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Autocomplete
                  multiple
                  size="small"
                  options={STATUSES}
                  value={statuses}
                  onChange={(_, v) => setStatuses(v)}
                  renderInput={(params) => <TextField {...params} label="Status" placeholder="All" />}
                />
              </Box>

              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Autocomplete
                  multiple
                  size="small"
                  options={PRIORITIES}
                  value={priorities}
                  onChange={(_, v) => setPriorities(v)}
                  renderInput={(params) => <TextField {...params} label="Priority" placeholder="All" />}
                />
              </Box>

              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Autocomplete
                  size="small"
                  options={allStaff}
                  value={selectedStaff}
                  onChange={(_, v) => setSelectedStaff(v)}
                  getOptionLabel={(option) => option.name}
                  renderInput={(params) => <TextField {...params} label="Team Member" placeholder="All" />}
                />
              </Box>

              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={handleReset} size="small">
                  Reset
                </Button>
                <Button variant="contained" onClick={fetchData} size="small">
                  Apply
                </Button>
              </Stack>
            </Stack>
          </Stack>
      </Paper>

      {/* Print header */}
      <Box className="print-only" sx={{ display: 'none', mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Asia CM - Project Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generated: {new Date().toLocaleString()}
          </Typography>
          <Divider sx={{ mt: 1 }} />
      </Box>

      {/* Data table - Screen version with pagination */}
      <TableContainer component={Paper} sx={{ width: '100%' }} className="no-print">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table sx={{ minWidth: 650 }} size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.dark' }}>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>
                    <TableSortLabel
                      active={orderBy === 'projectName'}
                      direction={orderBy === 'projectName' ? order : 'asc'}
                      onClick={() => handleRequestSort('projectName')}
                      sx={{ color: 'white !important', '& .MuiTableSortLabel-icon': { color: 'white !important' } }}
                    >
                      Project
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>
                    <TableSortLabel
                      active={orderBy === 'filingDate'}
                      direction={orderBy === 'filingDate' ? order : 'asc'}
                      onClick={() => handleRequestSort('filingDate')}
                      sx={{ color: 'white !important', '& .MuiTableSortLabel-icon': { color: 'white !important' } }}
                    >
                      Filing Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>
                    <TableSortLabel
                      active={orderBy === 'listingDate'}
                      direction={orderBy === 'listingDate' ? order : 'asc'}
                      onClick={() => handleRequestSort('listingDate')}
                      sx={{ color: 'white !important', '& .MuiTableSortLabel-icon': { color: 'white !important' } }}
                    >
                      Listing Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Partner</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Associate</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Sr FLIC</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Jr FLIC</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Intern</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Partner</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Associate</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Sr FLIC</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Jr FLIC</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Intern</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>B&C Attorney</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>Milestone</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'white' }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                  <TableRow
                    key={row.id}
                    onClick={() => navigate(`/projects/${row.id}`)}
                    sx={{
                      bgcolor: index % 2 === 0 ? 'grey.100' : 'white',
                      '&:hover': { bgcolor: 'grey.200', cursor: 'pointer' },
                      cursor: 'pointer'
                    }}
                  >
                    <TableCell>{row.projectName}</TableCell>
                    <TableCell>{row.filingDate ? row.filingDate.slice(0, 10) : '-'}</TableCell>
                    <TableCell>{row.listingDate ? row.listingDate.slice(0, 10) : '-'}</TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{row.usLawPartner || '-'}</TableCell>
                    <TableCell>{row.usLawAssociate || '-'}</TableCell>
                    <TableCell>{row.usLawSeniorFlic || '-'}</TableCell>
                    <TableCell>{row.usLawJuniorFlic || '-'}</TableCell>
                    <TableCell>{row.usLawIntern || '-'}</TableCell>
                    <TableCell>{row.hkLawPartner || '-'}</TableCell>
                    <TableCell>{row.hkLawAssociate || '-'}</TableCell>
                    <TableCell>{row.hkLawSeniorFlic || '-'}</TableCell>
                    <TableCell>{row.hkLawJuniorFlic || '-'}</TableCell>
                    <TableCell>{row.hkLawIntern || '-'}</TableCell>
                    <TableCell>{row.bcAttorney || '-'}</TableCell>
                    <TableCell>{row.milestone || '-'}</TableCell>
                    <TableCell>{row.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={rows.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[25, 50, 100, 200]}
            />
          </>
        )}
      </TableContainer>

      {/* Data table - Print version with all filtered rows */}
      <TableContainer component={Paper} sx={{ width: '100%', display: 'none' }} className="print-only">
        <Table sx={{ minWidth: 650 }} size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.dark' }}>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>Project</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>Filing Date</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>Listing Date</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Partner</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Associate</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Sr FLIC</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Jr FLIC</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>US - Intern</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Partner</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Associate</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Sr FLIC</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Jr FLIC</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>HK - Intern</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>B&C Attorney</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>Milestone</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'white' }}>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.map((row, index) => (
              <TableRow
                key={row.id}
                sx={{
                  bgcolor: index % 2 === 0 ? 'grey.100' : 'white',
                }}
              >
                <TableCell>{row.projectName}</TableCell>
                <TableCell>{row.filingDate ? row.filingDate.slice(0, 10) : '-'}</TableCell>
                <TableCell>{row.listingDate ? row.listingDate.slice(0, 10) : '-'}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell>{row.usLawPartner || '-'}</TableCell>
                <TableCell>{row.usLawAssociate || '-'}</TableCell>
                <TableCell>{row.usLawSeniorFlic || '-'}</TableCell>
                <TableCell>{row.usLawJuniorFlic || '-'}</TableCell>
                <TableCell>{row.usLawIntern || '-'}</TableCell>
                <TableCell>{row.hkLawPartner || '-'}</TableCell>
                <TableCell>{row.hkLawAssociate || '-'}</TableCell>
                <TableCell>{row.hkLawSeniorFlic || '-'}</TableCell>
                <TableCell>{row.hkLawJuniorFlic || '-'}</TableCell>
                <TableCell>{row.hkLawIntern || '-'}</TableCell>
                <TableCell>{row.bcAttorney || '-'}</TableCell>
                <TableCell>{row.milestone || '-'}</TableCell>
                <TableCell>{row.notes || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Page>
  );
};

export default ProjectReport;
