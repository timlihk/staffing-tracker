import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import {
  Print as PrintIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useBillingExportReport } from '../hooks/useBilling';
import { downloadCsv, type CsvColumn } from '../lib/export';
import type { BillingExportRow, BillingExportAttorney } from '../api/billing';

// ---------------------------------------------------------------------------
// Status filter options
// ---------------------------------------------------------------------------

interface StatusOption {
  value: string;
  label: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'lsd_past_due', label: 'LSD Past Due' },
  { value: 'lsd_due_30d', label: 'LSD Due \u2264 30 Days' },
  { value: 'unpaid_30d', label: 'Unpaid Invoices 30+ Days' },
  { value: 'active', label: 'Active Projects' },
  { value: 'slow_down', label: 'Slow-down' },
  { value: 'suspended', label: 'Suspended' },
];

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

type SortKey =
  | 'cmNumbers'
  | 'projectName'
  | 'bcAttorneyName'
  | 'sca'
  | 'agreedFeeUsd'
  | 'billingUsd'
  | 'collectionUsd'
  | 'billingCreditUsd'
  | 'ubtUsd';

const numericSortKeys = new Set<SortKey>([
  'agreedFeeUsd',
  'billingUsd',
  'collectionUsd',
  'billingCreditUsd',
  'ubtUsd',
]);

// ---------------------------------------------------------------------------
// Currency formatter
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const fmtFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// ---------------------------------------------------------------------------
// CSV export columns
// ---------------------------------------------------------------------------

const csvColumns: CsvColumn<BillingExportRow>[] = [
  { header: 'C/M Number', key: 'cmNumbers' },
  { header: 'Project Name', key: 'projectName' },
  { header: 'B&C Attorney', key: 'bcAttorneyName' },
  { header: 'SCA', key: 'sca' },
  { header: 'Fee (US$)', key: 'agreedFeeUsd', formatter: (v) => String(v ?? 0) },
  { header: 'Milestone Status', key: 'milestoneStatus' },
  { header: 'Billing ($)', key: 'billingUsd', formatter: (v) => String(v ?? 0) },
  { header: 'Collections ($)', key: 'collectionUsd', formatter: (v) => String(v ?? 0) },
  { header: 'Billing Credit ($)', key: 'billingCreditUsd', formatter: (v) => String(v ?? 0) },
  { header: 'UBT', key: 'ubtUsd', formatter: (v) => String(v ?? 0) },
  { header: 'AR', key: 'arUsd', formatter: (v) => String(v ?? 0) },
  { header: 'Notes', key: 'notes' },
];

// ---------------------------------------------------------------------------
// Shared header style for TableSortLabel on dark background
// ---------------------------------------------------------------------------

const sortLabelSx = {
  color: '#fff !important',
  '&.Mui-active': { color: '#fff !important' },
  '& .MuiTableSortLabel-icon': { color: 'rgba(255,255,255,0.7) !important' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BillingExportDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Body class name used by print.css to hide #root
// ---------------------------------------------------------------------------

const BODY_CLASS = 'billing-export-open';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BillingExportDialog: React.FC<BillingExportDialogProps> = ({ open, onClose }) => {
  // Filter state
  const [selectedAttorneys, setSelectedAttorneys] = useState<BillingExportAttorney[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<StatusOption[]>([]);

  // Sort state
  const [orderBy, setOrderBy] = useState<SortKey>('projectName');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  // Toggle body class so print.css can hide #root (more reliable than :has())
  useEffect(() => {
    if (open) {
      document.body.classList.add(BODY_CLASS);
    } else {
      document.body.classList.remove(BODY_CLASS);
    }
    return () => {
      document.body.classList.remove(BODY_CLASS);
    };
  }, [open]);

  // Build query params from filters
  const queryParams = useMemo(() => ({
    attorneyIds: selectedAttorneys.map((a) => a.staffId),
    statuses: selectedStatuses.map((s) => s.value),
    enabled: open,
  }), [selectedAttorneys, selectedStatuses, open]);

  const { data, isLoading, isFetching, error } = useBillingExportReport(queryParams);

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const attorneys = useMemo(() => data?.attorneys ?? [], [data?.attorneys]);

  // Sort rows
  const handleSort = useCallback((key: SortKey) => {
    setOrder((prev) => (orderBy === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setOrderBy(key);
  }, [orderBy]);

  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    return [...rows].sort((a, b) => {
      if (numericSortKeys.has(orderBy)) {
        const cmp = (Number(a[orderBy]) || 0) - (Number(b[orderBy]) || 0);
        return order === 'asc' ? cmp : -cmp;
      }
      const cmp = String(a[orderBy] || '').localeCompare(String(b[orderBy] || ''));
      return order === 'asc' ? cmp : -cmp;
    });
  }, [rows, orderBy, order]);

  // Compute totals for summary row
  const totals = useMemo(() => {
    if (!rows.length) return null;
    return {
      agreedFeeUsd: rows.reduce((sum, r) => sum + (r.agreedFeeUsd || 0), 0),
      billingUsd: rows.reduce((sum, r) => sum + (r.billingUsd || 0), 0),
      collectionUsd: rows.reduce((sum, r) => sum + (r.collectionUsd || 0), 0),
      billingCreditUsd: rows.reduce((sum, r) => sum + (r.billingCreditUsd || 0), 0),
      ubtUsd: rows.reduce((sum, r) => sum + (r.ubtUsd || 0), 0),
      arUsd: rows.reduce((sum, r) => sum + (r.arUsd || 0), 0),
    };
  }, [rows]);

  // Build subtitle for print header
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (selectedAttorneys.length) {
      parts.push(`Attorney: ${selectedAttorneys.map((a) => a.name).join(', ')}`);
    }
    if (selectedStatuses.length) {
      parts.push(`Status: ${selectedStatuses.map((s) => s.label).join(', ')}`);
    }
    return parts.length ? parts.join('  |  ') : 'All Projects';
  }, [selectedAttorneys, selectedStatuses]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleCsvExport = useCallback(() => {
    if (!rows.length) return;
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadCsv(rows, csvColumns, `billing-report-${timestamp}`);
  }, [rows]);

  // Helper to render sortable header
  const sortableHeader = (key: SortKey, label: string) => (
    <TableSortLabel
      active={orderBy === key}
      direction={orderBy === key ? order : 'asc'}
      onClick={() => handleSort(key)}
      sx={sortLabelSx}
    >
      {label}
    </TableSortLabel>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      aria-labelledby="billing-export-dialog-title"
      PaperProps={{
        className: 'billing-export-dialog',
        sx: {
          width: '95vw',
          maxWidth: '95vw',
          height: '90vh',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Dialog title - hidden when printing */}
      <DialogTitle id="billing-export-dialog-title" className="no-print" sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <FilterIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            Export Billing Report
          </Typography>
        </Stack>
      </DialogTitle>

      {/* Filter bar - hidden when printing */}
      <Box className="no-print" sx={{ px: 3, pb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Autocomplete
            multiple
            size="small"
            options={attorneys}
            getOptionLabel={(opt) => opt.name}
            isOptionEqualToValue={(opt, val) => opt.staffId === val.staffId}
            value={selectedAttorneys}
            onChange={(_, v) => setSelectedAttorneys(v)}
            renderInput={(params) => (
              <TextField {...params} label="B&C Attorney" placeholder="All" />
            )}
            renderTags={(value, getTagProps) =>
              value.map((opt, idx) => (
                <Chip {...getTagProps({ index: idx })} key={opt.staffId} label={opt.name} size="small" />
              ))
            }
            sx={{ minWidth: 280, flex: 1 }}
          />
          <Autocomplete
            multiple
            size="small"
            options={STATUS_OPTIONS}
            getOptionLabel={(opt) => opt.label}
            isOptionEqualToValue={(opt, val) => opt.value === val.value}
            value={selectedStatuses}
            onChange={(_, v) => setSelectedStatuses(v)}
            renderInput={(params) => (
              <TextField {...params} label="Status Filter" placeholder="All" />
            )}
            renderTags={(value, getTagProps) =>
              value.map((opt, idx) => (
                <Chip {...getTagProps({ index: idx })} key={opt.value} label={opt.label} size="small" />
              ))
            }
            sx={{ minWidth: 280, flex: 1 }}
          />
          {selectedAttorneys.length > 0 || selectedStatuses.length > 0 ? (
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setSelectedAttorneys([]);
                setSelectedStatuses([]);
              }}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Clear Filters
            </Button>
          ) : null}
        </Stack>
        {(selectedAttorneys.length > 0 || selectedStatuses.length > 0) && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Showing {rows.length} project{rows.length !== 1 ? 's' : ''} matching filters
          </Typography>
        )}
      </Box>

      <Divider className="no-print" />

      {/* Main content - this is what gets printed */}
      <DialogContent
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 0,
          position: 'relative',
          '@media print': {
            overflow: 'visible',
            p: 0,
          },
        }}
      >
        {/* Print-only header */}
        <Box
          className="print-only"
          sx={{
            display: 'none',
            '@media print': {
              display: 'block',
              mb: 2,
            },
          }}
        >
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Billing Control Tower Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Generated: {new Date().toLocaleString()}
          </Typography>
          <Divider sx={{ mt: 1.5 }} />
        </Box>

        {/* Subtle loading bar when refetching after filter change */}
        {isFetching && !isLoading && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} className="no-print" />
        )}

        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={8}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box p={3}>
            <Typography color="error">
              Failed to load report data. Please try again.
            </Typography>
          </Box>
        ) : rows.length === 0 ? (
          <Box p={3} textAlign="center">
            <Typography color="text.secondary">
              No projects match the selected filters.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ px: 1 }}>
            <Table size="small" sx={{ tableLayout: 'auto' }}>
              <TableHead>
                <TableRow
                  sx={{
                    '& .MuiTableCell-head': {
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      bgcolor: '#1e3a5f',
                      color: '#fff',
                      py: 1,
                      borderBottom: 'none',
                    },
                  }}
                >
                  <TableCell>{sortableHeader('cmNumbers', 'C/M Number')}</TableCell>
                  <TableCell>{sortableHeader('projectName', 'Project Name')}</TableCell>
                  <TableCell>{sortableHeader('bcAttorneyName', 'B&C Attorney')}</TableCell>
                  <TableCell>{sortableHeader('sca', 'SCA')}</TableCell>
                  <TableCell align="right">{sortableHeader('agreedFeeUsd', 'Fee (US$)')}</TableCell>
                  <TableCell align="center">Milestone</TableCell>
                  <TableCell align="right">{sortableHeader('billingUsd', 'Billing ($)')}</TableCell>
                  <TableCell align="right">{sortableHeader('collectionUsd', 'Collections ($)')}</TableCell>
                  <TableCell align="right">{sortableHeader('billingCreditUsd', 'Billing Credit ($)')}</TableCell>
                  <TableCell align="right">{sortableHeader('ubtUsd', 'UBT')}</TableCell>
                  <TableCell align="right">AR</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRows.map((row, idx) => (
                  <TableRow
                    key={row.projectId}
                    sx={{
                      bgcolor: idx % 2 === 0 ? '#fff' : '#f8fafc',
                      '&:hover': { bgcolor: '#e8f0fe' },
                      '& .MuiTableCell-body': {
                        fontSize: '0.75rem',
                        py: 0.75,
                        borderColor: '#e5e7eb',
                      },
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.7rem !important' }}>
                      {row.cmNumbers || '\u2014'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.projectName}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.bcAttorneyName}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.sca || '\u2014'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {row.agreedFeeUsd ? fmt.format(row.agreedFeeUsd) : '\u2014'}
                    </TableCell>
                    <TableCell align="center">
                      {(() => {
                        const ms = row.milestoneStatus || '0/0';
                        const parts = ms.split('/');
                        const completed = parts[0] ?? '0';
                        const total = parts[1] ?? '0';
                        const color = completed === '0' ? 'default' : completed === total ? 'success' : 'warning';
                        return (
                          <Chip
                            size="small"
                            label={ms}
                            variant="outlined"
                            color={color}
                            sx={{ fontSize: '0.7rem', height: 22 }}
                          />
                        );
                      })()}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {fmt.format(row.billingUsd)}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {fmt.format(row.collectionUsd)}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {row.billingCreditUsd ? fmt.format(row.billingCreditUsd) : '\u2014'}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {row.ubtUsd ? fmt.format(row.ubtUsd) : '\u2014'}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {row.arUsd ? fmt.format(row.arUsd) : '\u2014'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem !important' }}>
                      {row.notes || '\u2014'}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Summary / totals row */}
                {totals && (
                  <TableRow
                    sx={{
                      '& .MuiTableCell-body': {
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        py: 1,
                        borderTop: '2px solid #1e3a5f',
                        bgcolor: '#f1f5f9',
                      },
                    }}
                  >
                    <TableCell />
                    <TableCell>
                      <strong>Total ({rows.length} projects)</strong>
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell align="right">{fmtFull.format(totals.agreedFeeUsd)}</TableCell>
                    <TableCell />
                    <TableCell align="right">{fmtFull.format(totals.billingUsd)}</TableCell>
                    <TableCell align="right">{fmtFull.format(totals.collectionUsd)}</TableCell>
                    <TableCell align="right">{fmtFull.format(totals.billingCreditUsd)}</TableCell>
                    <TableCell align="right">{fmtFull.format(totals.ubtUsd)}</TableCell>
                    <TableCell align="right">{fmtFull.format(totals.arUsd)}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Print-only footer */}
        <Box
          className="print-only"
          sx={{
            display: 'none',
            '@media print': {
              display: 'block',
              mt: 4,
              pt: 2,
              borderTop: '1px solid #ccc',
            },
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Kirkland & Ellis - Billing Control Tower Report
          </Typography>
        </Box>
      </DialogContent>

      {/* Action buttons - hidden when printing */}
      <Divider className="no-print" />
      <DialogActions className="no-print" sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} startIcon={<CloseIcon />} color="inherit">
          Close
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleCsvExport}
          disabled={!rows.length}
        >
          Export CSV
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          disabled={!rows.length}
        >
          Print / Save as PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BillingExportDialog;
