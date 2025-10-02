import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Autocomplete,
  Divider,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import api from '../api/client';
import { Page } from '../components/ui';
import StyledDataGrid from '../components/ui/StyledDataGrid';

type ProjectReportRow = {
  id: string;
  name: string;
  projectName: string;
  category: string;
  status: string;
  priority: string | null;

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
  'HK Transaction Projects',
  'US Transaction Projects',
  'HK Compliance Projects',
  'US Compliance Projects',
  'Others',
];

const STATUSES = ['Active', 'Slow-down', 'Suspended'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const columns: GridColDef<ProjectReportRow>[] = [
  { field: 'name', headerName: 'Code', width: 100 },
  { field: 'projectName', headerName: 'Project', minWidth: 200, flex: 1 },
  { field: 'category', headerName: 'Category', width: 180 },

  // US Law columns
  { field: 'usLawPartner', headerName: 'US - Partner', width: 150 },
  { field: 'usLawAssociate', headerName: 'US - Associate', width: 150 },
  { field: 'usLawSeniorFlic', headerName: 'US - Sr FLIC', width: 150 },
  { field: 'usLawJuniorFlic', headerName: 'US - Jr FLIC', width: 150 },
  { field: 'usLawIntern', headerName: 'US - Intern', width: 150 },

  // HK Law columns
  { field: 'hkLawPartner', headerName: 'HK - Partner', width: 150 },
  { field: 'hkLawAssociate', headerName: 'HK - Associate', width: 150 },
  { field: 'hkLawSeniorFlic', headerName: 'HK - Sr FLIC', width: 150 },
  { field: 'hkLawJuniorFlic', headerName: 'HK - Jr FLIC', width: 150 },
  { field: 'hkLawIntern', headerName: 'HK - Intern', width: 150 },

  // B&C
  { field: 'bcAttorney', headerName: 'B&C Attorney', width: 150 },

  // Milestone & Notes
  { field: 'milestone', headerName: 'Milestone', width: 120 },
  { field: 'notes', headerName: 'Notes', minWidth: 200, flex: 1 },
];

function toCsvParam(values: string[]) {
  return values.length ? values.join(',') : undefined;
}

const ProjectReport: React.FC = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);

  const [rows, setRows] = useState<ProjectReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalProjects, setTotalProjects] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (categories.length) params.categories = toCsvParam(categories)!;
      if (statuses.length) params.statuses = toCsvParam(statuses)!;
      if (priorities.length) params.priorities = toCsvParam(priorities)!;

      const res = await api.get('/reports/project-report', { params });

      const data = (res.data?.data ?? []) as Omit<ProjectReportRow, 'id'>[];
      const withIds = data.map((r, i) => ({
        ...r,
        id: `${r.name}-${i}`,
      }));
      setRows(withIds);
      setTotalProjects(res.data?.meta?.totalProjects || 0);
    } catch (error) {
      console.error('Failed to fetch project report:', error);
    } finally {
      setLoading(false);
    }
  }, [categories, statuses, priorities]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReset = () => {
    setCategories([]);
    setStatuses([]);
    setPriorities([]);
  };

  const onPrint = () => window.print();

  return (
    <Page
      title="Project Report"
      actions={
        <Stack direction="row" spacing={2} className="no-print">
          <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={onPrint}>
            Print
          </Button>
        </Stack>
      }
    >
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
                <TextField {...params} label="Project Type" placeholder="All" />
              )}
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
              options={PRIORITIES}
              value={priorities}
              onChange={(_, v) => setPriorities(v)}
              renderInput={(params) => <TextField {...params} label="Priority" placeholder="All" />}
            />

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
              Kirkland & Ellis - Project Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Generated: {new Date().toLocaleString()}
            </Typography>
            <Divider sx={{ mt: 1 }} />
          </Box>

          {/* Summary */}
          <Paper className="no-print" sx={{ p: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              Total Projects: {totalProjects}
            </Typography>
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
  );
};

export default ProjectReport;
