/**
 * Billing Matters List Page
 */

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
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
  Pagination,
} from '@mui/material';
import { Search as SearchIcon, FilterList as FilterIcon } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { useBillingProjects } from '../hooks/useBilling';
import { useAppSettings } from '../hooks/useAppSettings';
import { formatCurrencyWhole } from '../lib/currency';
import { Page, BillingListSkeleton } from '../components/ui';
import { ExportButton, type ExportFormat } from '../components/ExportButton';
import { Link as RouterLink } from 'react-router-dom';
import type { BillingAttorneyOption, BillingProject } from '../api/billing';
import { getBillingAttorneys } from '../api/billing';
import { downloadCsv, downloadJson, type CsvColumn, Formatters } from '../lib/export';

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

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function BillingMatters() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [searchInput, setSearchInput] = useState('');
  const [bcAttorneyFilter, setBcAttorneyFilter] = useState<string>('all');

  const debouncedSearch = useDebounce(searchInput, 300);
  const activeSearch = debouncedSearch.trim();
  const activeAttorney = bcAttorneyFilter !== 'all' ? bcAttorneyFilter : undefined;

  const { data: projectsResponse, isLoading } = useBillingProjects({
    page,
    limit: pageSize,
    search: activeSearch || undefined,
    bcAttorney: activeAttorney,
  });
  const { data: appSettings } = useAppSettings();
  const enableDataExport = appSettings?.enableDataExport ?? false;
  
  const projects = projectsResponse?.data ?? [];
  const pagination = projectsResponse?.pagination;
  const totalPages = pagination?.totalPages ?? 0;

  // CSV export columns
  const csvColumns: CsvColumn<BillingProject>[] = [
    { header: 'Project Name', key: 'project_name' },
    { header: 'Client', key: 'client_name' },
    { header: 'C/M Numbers', key: 'cm_numbers' },
    { header: 'B&C Attorney', key: 'bc_attorney_name', formatter: (_v, row) => row.bc_attorney_name || row.attorney_in_charge || '-' },
    { header: 'Billed (USD)', key: 'billing_usd' },
    { header: 'Billed (CNY)', key: 'billing_cny' },
    { header: 'Collected (USD)', key: 'collection_usd' },
    { header: 'Collected (CNY)', key: 'collection_cny' },
    { header: 'UBT (USD)', key: 'ubt_usd' },
    { header: 'UBT (CNY)', key: 'ubt_cny' },
    { header: 'Credit (USD)', key: 'billing_credit_usd' },
    { header: 'Credit (CNY)', key: 'billing_credit_cny' },
    { header: 'Bonus (USD)', key: 'bonus_usd' },
    { header: 'Linked to Staffing', key: 'staffing_project_id', formatter: (v) => v ? 'Yes' : 'No' },
  ];

  // Handle export
  const handleExport = (format: ExportFormat) => {
    if (projects.length === 0) return;

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `billing-matters-${timestamp}`;

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

  useEffect(() => {
    if (!pagination) {
      setPage((prev) => (prev !== 1 ? 1 : prev));
      return;
    }
    setPage((prev) => {
      if (pagination.totalPages === 0) {
        return prev !== 1 ? 1 : prev;
      }
      if (prev > pagination.totalPages) {
        return pagination.totalPages;
      }
      return prev;
    });
  }, [pagination?.totalPages]);

  useEffect(() => {
    setPage(1);
  }, [activeSearch, activeAttorney]);

  const handlePageChange = (_event: ChangeEvent<unknown>, value: number) => {
    if (value !== page) {
      setPage(value);
    }
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (!Number.isNaN(next) && next !== pageSize) {
      setPageSize(next);
      setPage(1);
    }
  };

  const pageSizeOptions = [25, 50, 100, 250];
  const paginationPage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const filtersActive = Boolean(activeSearch || activeAttorney);

  // Get unique B&C attorneys for filter dropdown
  const { data: bcAttorneyServerOptions } = useQuery<BillingAttorneyOption[]>({
    queryKey: ['billing-bc-attorneys'],
    queryFn: getBillingAttorneys,
    staleTime: 5 * 60 * 1000,
  });

  const fallbackAttorneyOptions = useMemo(() => {
    const names = new Set<string>();
    projects.forEach(p => {
      const name = p.bc_attorney_name || p.attorney_in_charge;
      if (name) {
        name.split(/[,&]/).forEach(n => {
          const trimmed = n.trim();
          if (trimmed) names.add(trimmed);
        });
      }
    });
    return Array.from(names)
      .sort()
      .map((name, idx) => ({ staff_id: String(idx), name, position: null }));
  }, [projects]);

  const bcAttorneyOptions =
    bcAttorneyServerOptions && bcAttorneyServerOptions.length > 0
      ? bcAttorneyServerOptions
      : fallbackAttorneyOptions;

  // Responsive column widths based on screen size
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'cm_numbers',
        headerName: 'C/M Number',
        flex: isMobile ? 0 : 1,
        minWidth: isMobile ? 110 : 150,
        renderCell: (params: GridRenderCellParams) => (
          <MuiLink
            component={RouterLink}
            to={`/billing/${params.row.project_id}`}
            sx={{
              fontWeight: 500,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
              fontSize: isMobile ? '0.875rem' : 'inherit',
            }}
          >
            {params.value || '—'}
          </MuiLink>
        ),
      },
      {
        field: 'project_name',
        headerName: 'Project',
        flex: isMobile ? 0 : 1,
        minWidth: isMobile ? 140 : 200,
      },
      {
        field: 'client_name',
        headerName: 'Client',
        flex: isMobile ? 0 : 0.8,
        minWidth: isMobile ? 100 : 150,
        hideable: true,
      },
      {
        field: 'bc_attorney_name',
        headerName: 'Attorney',
        flex: isMobile ? 0 : 0.6,
        minWidth: isMobile ? 100 : 130,
        valueGetter: (_value, row) => row.bc_attorney_name || row.attorney_in_charge || '-',
      },
      {
        field: 'billed',
        headerName: 'Billed',
        width: isMobile ? 100 : 140,
        valueGetter: (_value, row) => formatCurrencyWithSymbol(row.billing_usd, row.billing_cny),
      },
      {
        field: 'collected',
        headerName: 'Collected',
        width: isMobile ? 100 : 140,
        valueGetter: (_value, row) => formatCurrencyWithSymbol(row.collection_usd, row.collection_cny),
      },
      {
        field: 'ubt',
        headerName: 'UBT',
        width: isMobile ? 90 : 120,
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
              sx={{ fontSize: isMobile ? '0.75rem' : 'inherit' }}
            />
          );
        },
      },
      {
        field: 'credit',
        headerName: 'Credit',
        width: isMobile ? 90 : 120,
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
              sx={{ fontSize: isMobile ? '0.75rem' : 'inherit' }}
            />
          );
        },
      },
      {
        field: 'bonus_usd',
        headerName: 'Bonus',
        width: isMobile ? 90 : 110,
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
              sx={{ fontSize: isMobile ? '0.75rem' : 'inherit' }}
            />
          );
        },
      },
      {
        field: 'staffing_project_id',
        headerName: 'Link',
        width: isMobile ? 80 : 90,
        renderCell: (params: GridRenderCellParams) => {
          return params.value ? (
            <Chip label="Linked" size="small" color="success" sx={{ fontSize: isMobile ? '0.7rem' : 'inherit' }} />
          ) : (
            <Chip label="—" size="small" variant="outlined" />
          );
        },
      },
    ],
    [isMobile]
  );

  // Show skeleton on initial load
  if (isLoading && !projects.length) {
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
        <BillingListSkeleton />
      </Page>
    );
  }

  return (
    <Page title="Billing Matters">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant={{ xs: 'h5', sm: 'h4' }} gutterBottom>
            Billing Matters
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and manage billing projects, fees, and collections
          </Typography>
        </Box>
        {enableDataExport && (
          <ExportButton
            onExport={handleExport}
            disabled={projects.length === 0}
            showExcel={false}
            tooltipText="Export billing matters"
          />
        )}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              placeholder="Search by C/M number, project, or client..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
              sx={{ minWidth: { xs: '100%', sm: 200, md: 250 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <FilterIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            >
              <MenuItem value="all">All Attorneys</MenuItem>
              {bcAttorneyOptions.map((attorney) => (
                <MenuItem key={`${attorney.staff_id}-${attorney.name}`} value={attorney.name}>
                  {attorney.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {pagination && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Pagination
            count={Math.max(totalPages, 1)}
            page={paginationPage}
            onChange={handlePageChange}
            color="primary"
            disabled={isLoading || totalPages <= 1}
            size={isMobile ? 'small' : 'medium'}
            siblingCount={isMobile ? 0 : 1}
          />
          <TextField
            select
            label={isMobile ? 'Rows' : 'Rows per page'}
            value={pageSize}
            onChange={handlePageSizeChange}
            size="small"
            sx={{ width: isMobile ? 100 : 160 }}
          >
            {pageSizeOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {isMobile ? option : `${option} rows`}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )}

      {filtersActive && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
          Filters applied server-side{pagination ? ` (${pagination.total} total matches)` : ''}.
        </Typography>
      )}

      <Card sx={{ overflow: 'hidden' }}>
        <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
          <Box sx={{ 
            width: '100%', 
            overflow: 'auto',
            '& .MuiDataGrid-root': {
              minWidth: isMobile ? 800 : 'auto', // Ensure horizontal scroll on mobile
            }
          }}>
            <DataGrid
              rows={projects}
              columns={columns}
              getRowId={(row) => String(row.project_id)}
              loading={isLoading}
              autoHeight
              hideFooterPagination
              hideFooterSelectedRowCount
              density={isMobile ? 'compact' : 'standard'}
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
                    fontSize: isMobile ? '0.75rem' : 'inherit',
                  },
                },
                '& .MuiDataGrid-cell': {
                  fontSize: isMobile ? '0.8125rem' : 'inherit',
                },
              }}
              onRowClick={(params) => navigate(`/billing/${params.row.project_id}`)}
            />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {pagination
            ? isMobile 
              ? `${projects.length} of ${pagination.total} (p.${paginationPage}/${Math.max(totalPages, 1)})`
              : `Showing ${projects.length} of ${pagination.total} billing matters (page ${paginationPage} of ${Math.max(totalPages, 1)})`
            : `Showing ${projects.length} billing matters`}
        </Typography>
      </Box>
    </Page>
  );
}
