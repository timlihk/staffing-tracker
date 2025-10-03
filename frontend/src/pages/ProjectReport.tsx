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
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import api from '../api/client';
import { useStaff } from '../hooks/useStaff';
import { Staff } from '../types';

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
  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const { data: allStaff = [] } = useStaff({});

  const [rows, setRows] = useState<ProjectReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalProjects, setTotalProjects] = useState(0);
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

      const res = await api.get('/reports/project-report', { params });

      const data = (res.data?.data ?? []) as ProjectReportRow[];
      const withIds = data.map((r) => ({
        ...r,
        id: r.projectId,
      }));
      setRows(withIds);
      setTotalProjects(res.data?.meta?.totalProjects || 0);
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

  return (
    <>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }} className="no-print">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 700, mr: 'auto' }}>
            📊 Project Report
          </Typography>
          <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={onPrint}>
            Print
          </Button>
        </Stack>
      </Paper>

      {/* Horizontal Filter Bar */}
      <Paper className="no-print" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <FilterAltRoundedIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Filters
              </Typography>
            </Stack>

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
            Kirkland & Ellis - Project Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generated: {new Date().toLocaleString()}
          </Typography>
          <Divider sx={{ mt: 1 }} />
      </Box>

      {/* Summary */}
      <Paper className="no-print" sx={{ p: 2, mb: 2 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Total Projects: {totalProjects}
          </Typography>
      </Paper>

      {/* Data table */}
      <TableContainer component={Paper} sx={{ width: '100%' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table sx={{ minWidth: 650 }} size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={orderBy === 'projectName'}
                      direction={orderBy === 'projectName' ? order : 'asc'}
                      onClick={() => handleRequestSort('projectName')}
                    >
                      Project
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={orderBy === 'filingDate'}
                      direction={orderBy === 'filingDate' ? order : 'asc'}
                      onClick={() => handleRequestSort('filingDate')}
                    >
                      Filing Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={orderBy === 'listingDate'}
                      direction={orderBy === 'listingDate' ? order : 'asc'}
                      onClick={() => handleRequestSort('listingDate')}
                    >
                      Listing Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>US - Partner</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>US - Associate</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>US - Sr FLIC</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>US - Jr FLIC</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>US - Intern</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>HK - Partner</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>HK - Associate</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>HK - Sr FLIC</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>HK - Jr FLIC</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>HK - Intern</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>B&C Attorney</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Milestone</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => navigate(`/projects/${row.id}`)}
                    sx={{
                      '&:hover': { bgcolor: 'grey.100', cursor: 'pointer' },
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
    </>
  );
};

export default ProjectReport;
