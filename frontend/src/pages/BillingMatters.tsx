/**
 * Billing Matters List Page
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  Link as MuiLink,
  TextField,
  Stack,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon, FilterList as FilterIcon } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useBillingProjects } from '../hooks/useBilling';
import { formatCurrencyWhole } from '../lib/currency';
import { Page } from '../components/ui';
import { Link as RouterLink } from 'react-router-dom';

// Helper to format currency with currency symbol in value
const formatCurrencyWithSymbol = (usdValue: number | null, cnyValue: number | null): string => {
  const usd = Number(usdValue) || 0;
  const cny = Number(cnyValue) || 0;

  if (usd > 0 && cny > 0) {
    return `${formatCurrencyWhole(usd, 'USD')} / ${formatCurrencyWhole(cny, 'CNY')}`;
  }
  if (usd > 0) {
    return formatCurrencyWhole(usd, 'USD');
  }
  if (cny > 0) {
    return formatCurrencyWhole(cny, 'CNY');
  }
  return '—';
};

export default function BillingMatters() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useBillingProjects();

  // Filter states
  const [searchText, setSearchText] = useState('');
  const [bcAttorneyFilter, setBcAttorneyFilter] = useState<string>('all');

  // Get unique B&C attorneys for filter dropdown
  const bcAttorneys = useMemo(() => {
    const attorneys = new Set<string>();
    projects.forEach(p => {
      const name = p.bc_attorney_name || p.attorney_in_charge;
      if (name) {
        // Split by comma in case there are multiple attorneys
        name.split(',').forEach(n => attorneys.add(n.trim()));
      }
    });
    return Array.from(attorneys).sort();
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      // Search filter (project name or C/M number)
      if (searchText) {
        const search = searchText.toLowerCase();
        const matchesName = project.project_name?.toLowerCase().includes(search);
        const matchesCM = project.cm_numbers?.toLowerCase().includes(search);
        if (!matchesName && !matchesCM) return false;
      }

      // B&C attorney filter
      if (bcAttorneyFilter !== 'all') {
        const projectAttorney = project.bc_attorney_name || project.attorney_in_charge || '';
        if (!projectAttorney.includes(bcAttorneyFilter)) return false;
      }

      return true;
    });
  }, [projects, searchText, bcAttorneyFilter]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'project_name',
        headerName: 'Project Name',
        width: 200,
        renderCell: (params: GridRenderCellParams) => (
          <MuiLink
            component={RouterLink}
            to={`/billing/${params.row.project_id}`}
            sx={{ fontWeight: 500, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            {params.value}
          </MuiLink>
        ),
      },
      {
        field: 'client_name',
        headerName: 'Client',
        width: 180,
      },
      {
        field: 'cm_numbers',
        headerName: 'C/M No.',
        width: 130,
      },
      {
        field: 'bc_attorney_name',
        headerName: 'B&C Attorney',
        width: 150,
        valueGetter: (_value, row) => row.bc_attorney_name || row.attorney_in_charge || '-',
      },
      {
        field: 'billed',
        headerName: 'Billed',
        width: 150,
        valueGetter: (_value, row) => formatCurrencyWithSymbol(row.billing_usd, row.billing_cny),
      },
      {
        field: 'collected',
        headerName: 'Collected',
        width: 150,
        valueGetter: (_value, row) => formatCurrencyWithSymbol(row.collection_usd, row.collection_cny),
      },
      {
        field: 'ubt',
        headerName: 'UBT',
        width: 150,
        renderCell: (params: GridRenderCellParams) => {
          const usd = Number(params.row.ubt_usd) || 0;
          const cny = Number(params.row.ubt_cny) || 0;
          const label = formatCurrencyWithSymbol(params.row.ubt_usd, params.row.ubt_cny);
          const hasValue = usd > 0 || cny > 0;
          return (
            <Chip
              label={label}
              size="small"
              color={hasValue ? 'warning' : 'default'}
              variant={hasValue ? 'filled' : 'outlined'}
            />
          );
        },
      },
      {
        field: 'credit',
        headerName: 'Credit',
        width: 150,
        renderCell: (params: GridRenderCellParams) => {
          const usd = Number(params.row.billing_credit_usd) || 0;
          const cny = Number(params.row.billing_credit_cny) || 0;
          const label = formatCurrencyWithSymbol(params.row.billing_credit_usd, params.row.billing_credit_cny);
          const hasValue = usd > 0 || cny > 0;
          return (
            <Chip
              label={label}
              size="small"
              color={hasValue ? 'success' : 'default'}
              variant={hasValue ? 'filled' : 'outlined'}
            />
          );
        },
      },
      {
        field: 'bonus_usd',
        headerName: 'Bonus',
        width: 130,
        type: 'number',
        renderCell: (params: GridRenderCellParams) => {
          const numeric = Number(params.value) || 0;
          if (numeric === 0) return <Typography variant="body2">-</Typography>;
          return (
            <Chip
              label={formatCurrencyWhole(numeric, 'USD')}
              size="small"
              color="info"
              variant="filled"
            />
          );
        },
      },
      {
        field: 'staffing_project_id',
        headerName: 'Link',
        width: 100,
        renderCell: (params: GridRenderCellParams) => {
          return params.value ? (
            <Chip label="Linked" size="small" color="success" />
          ) : (
            <Chip label="Unlinked" size="small" variant="outlined" />
          );
        },
      },
    ],
    []
  );

  return (
    <Page title="Billing Matters">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Billing Matters
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage billing projects, fees, and collections
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              placeholder="Search by project name or C/M number..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              label="B&C Attorney"
              value={bcAttorneyFilter}
              onChange={(e) => setBcAttorneyFilter(e.target.value)}
              size="small"
              sx={{ minWidth: { sm: 250 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <FilterIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            >
              <MenuItem value="all">All Attorneys</MenuItem>
              {bcAttorneys.map((attorney) => (
                <MenuItem key={attorney} value={attorney}>
                  {attorney}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <DataGrid
            rows={filteredProjects}
            columns={columns}
            getRowId={(row) => row.project_id}
            loading={isLoading}
            autoHeight
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            sx={{
              '& .MuiDataGrid-row:hover': {
                cursor: 'pointer',
                backgroundColor: 'action.hover',
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'grey.100',
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 600,
                  color: 'text.primary',
                },
              },
            }}
            onRowClick={(params) => navigate(`/billing/${params.row.project_id}`)}
          />
        </CardContent>
      </Card>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Showing {filteredProjects.length} of {projects.length} billing matters
        </Typography>
      </Box>
    </Page>
  );
}
