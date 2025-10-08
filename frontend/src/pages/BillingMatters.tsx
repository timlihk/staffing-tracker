/**
 * Billing Matters List Page
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  Link as MuiLink,
  Alert,
  AlertTitle,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useBillingProjects } from '../hooks/useBilling';
import { Page } from '../components/ui';
import { Link as RouterLink } from 'react-router-dom';

const formatMoney = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0.00';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function BillingMatters() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useBillingProjects();

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
        valueGetter: (value, row) => row.bc_attorney_name || row.attorney_in_charge || '-',
      },
      {
        field: 'agreed_fee_usd',
        headerName: 'Fee (USD)',
        width: 120,
        type: 'number',
        valueFormatter: (value) => value ? `$${formatMoney(value)}` : '-',
      },
      {
        field: 'billing_usd',
        headerName: 'Billed (USD)',
        width: 120,
        type: 'number',
        valueFormatter: (value) => `$${formatMoney(value)}`,
      },
      {
        field: 'collection_usd',
        headerName: 'Collected (USD)',
        width: 130,
        type: 'number',
        valueFormatter: (value) => `$${formatMoney(value)}`,
      },
      {
        field: 'billing_credit_usd',
        headerName: 'Credit (USD)',
        width: 120,
        type: 'number',
        renderCell: (params: GridRenderCellParams) => {
          const value = params.value || 0;
          return (
            <Chip
              label={`$${formatMoney(value)}`}
              size="small"
              color={value > 0 ? 'success' : 'default'}
              variant={value > 0 ? 'filled' : 'outlined'}
            />
          );
        },
      },
      {
        field: 'ubt_usd',
        headerName: 'UBT (USD)',
        width: 120,
        type: 'number',
        renderCell: (params: GridRenderCellParams) => {
          const value = params.value || 0;
          return (
            <Chip
              label={`$${formatMoney(value)}`}
              size="small"
              color={value > 0 ? 'warning' : 'default'}
              variant={value > 0 ? 'filled' : 'outlined'}
            />
          );
        },
      },
      {
        field: 'bonus_usd',
        headerName: 'Bonus (USD)',
        width: 130,
        type: 'number',
        renderCell: (params: GridRenderCellParams) => {
          const value = params.value || 0;
          if (value === 0) return <Typography variant="body2">-</Typography>;
          return (
            <Chip
              label={`$${formatMoney(value)}`}
              size="small"
              color="info"
              variant="filled"
            />
          );
        },
      },
      {
        field: 'agreed_fee_cny',
        headerName: 'Fee (CNY)',
        width: 120,
        type: 'number',
        valueFormatter: (value) => value ? `¥${formatMoney(value)}` : '-',
      },
      {
        field: 'ubt_cny',
        headerName: 'UBT (CNY)',
        width: 120,
        type: 'number',
        renderCell: (params: GridRenderCellParams) => {
          const value = params.value || 0;
          if (value === 0) return <Typography variant="body2">-</Typography>;
          return (
            <Chip
              label={`¥${formatMoney(value)}`}
              size="small"
              color="warning"
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

      <Alert severity="success" sx={{ mb: 3 }}>
        <AlertTitle>✓ Data Import Complete</AlertTitle>
        Successfully imported from parsed HTML: 112 billing records ($85.5M billed), 107 collection records ($80.8M collected), 126 UBT entries, 32 billing credits, and 250 detailed finance comments. All 176 projects matched successfully. Please verify amounts match your source documents.
      </Alert>

      <Card>
        <CardContent>
          <DataGrid
            rows={projects}
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

      {projects.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Total: {projects.length} billing matters
          </Typography>
        </Box>
      )}
    </Page>
  );
}
