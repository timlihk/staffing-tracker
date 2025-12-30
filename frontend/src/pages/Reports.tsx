import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  TextField,
  Autocomplete,
  Divider,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { GridColDef } from '@mui/x-data-grid';
import dayjs, { Dayjs } from 'dayjs';
import axios from 'axios';
import { saveAs } from 'file-saver';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import api from '../api/client';
import { Page, PageHeader } from '../components/ui';
import StyledDataGrid from '../components/ui/StyledDataGrid';

type ReportRow = {
  id: string;
  name: string;
  projectName: string;
  category: string;
  priority: string | null;
  status: string;
  elStatus: string | null;
  timetable: string | null;
  filingDate: string | null;
  listingDate: string | null;
  staffName: string;
  staffRole: string;
  staffDepartment: string | null;
  roleInProject: string;
  jurisdiction: string | null;
  startDate: string | null;
  endDate: string | null;
};

const CATEGORY_OPTIONS = [
  'HK Trx',
  'US Trx',
  'HK Comp',
  'US Comp',
  'Others',
];

const STAFF_ROLES = [
  'Partner',
  'Associate',
  'Senior FLIC',
  'Junior FLIC',
  'Intern',
  'B&C Working Attorney',
];

const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Active', 'Slow-down', 'Suspended', 'Closed', 'Terminated'];
const JURISDICTIONS = ['US Law', 'HK Law', 'B&C'];

const columns: GridColDef<ReportRow>[] = [
  { field: 'name', headerName: 'Code', width: 110 },
  { field: 'projectName', headerName: 'Project', flex: 1, minWidth: 220 },
  { field: 'category', headerName: 'Category', width: 180 },
  { field: 'priority', headerName: 'Priority', width: 90 },
  { field: 'status', headerName: 'Status', width: 110 },
  { field: 'elStatus', headerName: 'EL Status', width: 120 },
  { field: 'timetable', headerName: 'Timetable', width: 150 },
  {
    field: 'filingDate',
    headerName: 'Filing Date',
    width: 130,
    valueGetter: (_value, row) => (row.filingDate ? row.filingDate.slice(0, 10) : ''),
  },
  {
    field: 'listingDate',
    headerName: 'Listing Date',
    width: 130,
    valueGetter: (_value, row) => (row.listingDate ? row.listingDate.slice(0, 10) : ''),
  },
  { field: 'staffName', headerName: 'Staff', width: 180 },
  { field: 'staffRole', headerName: 'Staff Role', width: 130 },
  { field: 'staffDepartment', headerName: 'Dept', width: 100 },
  { field: 'roleInProject', headerName: 'Project Role', width: 140 },
  { field: 'jurisdiction', headerName: 'Jurisdiction', width: 120 },
  {
    field: 'startDate',
    headerName: 'Start',
    width: 110,
    valueGetter: (_value, row) => (row.startDate ? row.startDate.slice(0, 10) : ''),
  },
  {
    field: 'endDate',
    headerName: 'End',
    width: 110,
    valueGetter: (_value, row) => (row.endDate ? row.endDate.slice(0, 10) : ''),
  },
];

function toCsvParam(values: string[]) {
  return values.length ? values.join(',') : undefined;
}

const Reports: React.FC = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [staffRoles, setStaffRoles] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const totals = useMemo(() => {
    const uniqueProjects = new Set<string>();
    const uniqueStaff = new Set<string>();
    rows.forEach((row) => {
      uniqueProjects.add(row.projectName);
      uniqueStaff.add(row.staffName);
    });
    return {
      rows: rows.length,
      projects: uniqueProjects.size,
      staff: uniqueStaff.size,
    };
  }, [rows]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (categories.length) params.categories = toCsvParam(categories)!;
      if (staffRoles.length) params.staffRoles = toCsvParam(staffRoles)!;
      if (priorities.length) params.priorities = toCsvParam(priorities)!;
      if (statuses.length) params.statuses = toCsvParam(statuses)!;
      if (jurisdictions.length) params.jurisdictions = toCsvParam(jurisdictions)!;
      if (dateFrom) params.dateFrom = dateFrom.toISOString();
      if (dateTo) params.dateTo = dateTo.toISOString();

      const res = await api.get('/reports/staffing', { params });

      const data = (res.data?.data ?? []) as Omit<ReportRow, 'id'>[];
      const withIds = data.map((r, i) => ({
        ...r,
        id: `${r.name}-${r.staffName}-${i}`,
      }));
      setRows(withIds);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  }, [categories, staffRoles, priorities, statuses, jurisdictions, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onExportExcel = async () => {
    const params = new URLSearchParams();
    if (categories.length) params.set('categories', categories.join(','));
    if (staffRoles.length) params.set('staffRoles', staffRoles.join(','));
    if (priorities.length) params.set('priorities', priorities.join(','));
    if (statuses.length) params.set('statuses', statuses.join(','));
    if (jurisdictions.length) params.set('jurisdictions', jurisdictions.join(','));
    if (dateFrom) params.set('dateFrom', dateFrom.toISOString());
    if (dateTo) params.set('dateTo', dateTo.toISOString());

    try {
      const token = localStorage.getItem('token');
      const baseURL = import.meta.env.VITE_API_URL || '';
      const res = await axios.get(`${baseURL}/reports/staffing.xlsx?${params.toString()}`, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      saveAs(res.data, `staffing-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Failed to export Excel:', error);
      alert('Failed to export report');
    }
  };

  const onPrint = () => window.print();

  const handleReset = () => {
    setCategories([]);
    setStaffRoles([]);
    setPriorities([]);
    setStatuses([]);
    setJurisdictions([]);
    setDateFrom(null);
    setDateTo(null);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Page>
        <PageHeader
          title="Staffing Report"
          actions={
            <Stack direction="row" spacing={2} className="no-print">
              <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={onPrint}>
                Print
              </Button>
              <Button
                variant="contained"
                startIcon={<DownloadRoundedIcon />}
                onClick={onExportExcel}
              >
                Export Excel
              </Button>
            </Stack>
          }
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 2 }}>
          {/* Filter panel */}
          <Paper
            className="no-print"
            sx={{
              p: 2.5,
              alignSelf: 'start',
              position: 'sticky',
              top: 88,
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <FilterAltRoundedIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Filters
              </Typography>
            </Stack>

            <Stack spacing={2}>
              <Autocomplete
                multiple
                options={CATEGORY_OPTIONS}
                value={categories}
                onChange={(_, v) => setCategories(v)}
                renderInput={(params) => (
                  <TextField {...params} label="Categories" placeholder="All" />
                )}
              />

              <Autocomplete
                multiple
                options={STAFF_ROLES}
                value={staffRoles}
                onChange={(_, v) => setStaffRoles(v)}
                renderInput={(params) => (
                  <TextField {...params} label="Staff Roles" placeholder="All" />
                )}
              />

              <Autocomplete
                multiple
                options={PRIORITIES}
                value={priorities}
                onChange={(_, v) => setPriorities(v)}
                renderInput={(params) => <TextField {...params} label="Priority" placeholder="All" />}
              />

              <Autocomplete
                multiple
                options={STATUSES}
                value={statuses}
                onChange={(_, v) => setStatuses(v)}
                renderInput={(params) => <TextField {...params} label="Status" placeholder="All" />}
              />

              <Autocomplete
                multiple
                options={JURISDICTIONS}
                value={jurisdictions}
                onChange={(_, v) => setJurisdictions(v)}
                renderInput={(params) => (
                  <TextField {...params} label="Jurisdiction" placeholder="All" />
                )}
              />

              <DatePicker label="From" value={dateFrom} onChange={(value) => setDateFrom(value ? dayjs(value) : null)} />

              <DatePicker label="To" value={dateTo} onChange={(value) => setDateTo(value ? dayjs(value) : null)} />

              <Divider />

              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={handleReset} size="small">
                  Reset
                </Button>
                <Button variant="contained" onClick={fetchData} size="small">
                  Apply
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* Results */}
          <Box sx={{ display: 'grid', gap: 2 }}>
            {/* Print header */}
            <Box className="print-only" sx={{ display: 'none', mb: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                Asia CM - Staffing Report
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Generated: {new Date().toLocaleString()}
              </Typography>
              <Divider sx={{ mt: 1 }} />
            </Box>

            {/* Summary chips */}
            <Paper className="no-print" sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
                <Chip label={`${totals.rows} Assignments`} color="primary" />
                <Chip label={`${totals.projects} Projects`} color="secondary" />
                <Chip label={`${totals.staff} Staff`} />
              </Stack>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {categories.length > 0 && (
                  <Chip size="small" label={`Categories: ${categories.join(', ')}`} />
                )}
                {staffRoles.length > 0 && (
                  <Chip size="small" label={`Roles: ${staffRoles.join(', ')}`} />
                )}
                {priorities.length > 0 && (
                  <Chip size="small" label={`Priority: ${priorities.join(', ')}`} />
                )}
                {statuses.length > 0 && (
                  <Chip size="small" label={`Status: ${statuses.join(', ')}`} />
                )}
                {jurisdictions.length > 0 && (
                  <Chip size="small" label={`Jurisdiction: ${jurisdictions.join(', ')}`} />
                )}
                {dateFrom && <Chip size="small" label={`From: ${dateFrom.format('YYYY-MM-DD')}`} />}
                {dateTo && <Chip size="small" label={`To: ${dateTo.format('YYYY-MM-DD')}`} />}
              </Box>
            </Paper>

            {/* Data table */}
            <Paper sx={{ p: 1 }}>
              <StyledDataGrid
                rows={rows}
                columns={columns}
                loading={loading}
                autoHeight
                initialState={{
                  pagination: { paginationModel: { pageSize: 100 } },
                }}
                pageSizeOptions={[25, 50, 100, 200]}
              />
            </Paper>
          </Box>
        </Box>
      </Page>
    </LocalizationProvider>
  );
};

export default Reports;
