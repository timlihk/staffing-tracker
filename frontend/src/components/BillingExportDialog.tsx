import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as PendingIcon,
} from '@mui/icons-material';
import { saveAs } from 'file-saver';
import { useBillingExportReport } from '../hooks/useBilling';
import { downloadExportReportExcel } from '../api/billing';
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
// Shared header style for TableSortLabel on dark background
// ---------------------------------------------------------------------------

const sortLabelSx = {
  color: '#fff !important',
  '&.Mui-active': { color: '#fff !important' },
  '& .MuiTableSortLabel-icon': { color: 'rgba(255,255,255,0.7) !important' },
};

// ---------------------------------------------------------------------------
// Default column widths (pixels) for the resizable table
// ---------------------------------------------------------------------------

const DEFAULT_COL_WIDTHS = [100, 147, 140, 80, 67, 470, 67, 73, 80, 53, 53, 200];

const COL_HEADERS = [
  'C/M Number', 'Project Name', 'B&C Attorney', 'SCA', 'Fee (US$)',
  'Milestone', 'Billing ($)', 'Collections ($)', 'Billing Credit ($)',
  'UBT ($)', 'AR ($)', 'Notes',
];

// ---------------------------------------------------------------------------
// Print helpers — build self-contained HTML for window.open()
// ---------------------------------------------------------------------------

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const milestoneCellHtml = (row: BillingExportRow) => {
  const ms = row.milestones ?? [];
  if (!ms.length) return '\u2014';
  const done = ms.filter((m) => m.completed).length;
  const borderColor =
    done === ms.length ? '#2e7d32' : done === 0 ? '#999' : '#ed6c02';
  const chip = `<span style="display:inline-block;border:1px solid ${borderColor};border-radius:10px;padding:0 5px;font-size:6pt;margin-bottom:2px;">${done}/${ms.length}</span>`;
  const items = ms
    .map((m) => {
      const dot = m.completed
        ? '<span style="color:#2e7d32;">&#9679;</span>'
        : '<span style="color:#bbb;">&#9675;</span>';
      const color = m.completed ? '#666' : '#111';
      return `<div style="padding:1px 0;">${dot} <span style="color:${color};">${escHtml(m.title)}</span></div>`;
    })
    .join('');
  return chip + items;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BillingExportDialogProps {
  open: boolean;
  onClose: () => void;
}

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

  // Column widths state (resizable via drag handles)
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COL_WIDTHS);
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;

  // Column resize — stable callback via ref
  const handleResizeStart = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidthsRef.current[colIdx];

    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(40, startW + ev.clientX - startX);
      setColWidths((prev) => {
        const next = [...prev];
        next[colIdx] = newW;
        return next;
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

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

  // Print via new window — completely bypasses MUI Dialog portal issues
  const handlePrint = useCallback(() => {
    const totalW = colWidths.reduce((a, b) => a + b, 0);
    const pctWidths = colWidths.map((w) => ((w / totalW) * 100).toFixed(1) + '%');

    const colgroup = pctWidths.map((w) => `<col style="width:${w}"/>`).join('');

    const headerCells = COL_HEADERS.map(
      (h) => `<th style="text-align:center;">${escHtml(h)}</th>`,
    ).join('');

    const bodyRows = sortedRows
      .map((row, idx) => {
        const bg = idx % 2 === 0 ? '#fff' : '#f3f4f6';
        const cells = [
          `<td style="font-family:monospace;">${escHtml(row.cmNumbers || '\u2014')}</td>`,
          `<td>${escHtml(row.projectName)}</td>`,
          `<td>${escHtml(row.bcAttorneyName)}</td>`,
          `<td>${escHtml(row.sca || '\u2014')}</td>`,
          `<td style="text-align:right;">${row.agreedFeeUsd ? fmt.format(row.agreedFeeUsd) : '\u2014'}</td>`,
          `<td style="vertical-align:top;">${milestoneCellHtml(row)}</td>`,
          `<td style="text-align:right;">${fmt.format(row.billingUsd)}</td>`,
          `<td style="text-align:right;">${fmt.format(row.collectionUsd)}</td>`,
          `<td style="text-align:right;">${row.billingCreditUsd ? fmt.format(row.billingCreditUsd) : '\u2014'}</td>`,
          `<td style="text-align:right;">${row.ubtUsd ? fmt.format(row.ubtUsd) : '\u2014'}</td>`,
          `<td style="text-align:right;">${row.arUsd ? fmt.format(row.arUsd) : '\u2014'}</td>`,
          `<td>${escHtml(row.notes || '\u2014')}</td>`,
        ].join('');
        return `<tr style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${cells}</tr>`;
      })
      .join('');

    let totalsHtml = '';
    if (totals) {
      totalsHtml = `<tr style="background:#f1f5f9;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <td></td>
        <td><strong>Total (${rows.length} projects)</strong></td>
        <td></td><td></td>
        <td style="text-align:right;border-top:2px solid #1e3a5f;">${fmtFull.format(totals.agreedFeeUsd)}</td>
        <td></td>
        <td style="text-align:right;border-top:2px solid #1e3a5f;">${fmtFull.format(totals.billingUsd)}</td>
        <td style="text-align:right;border-top:2px solid #1e3a5f;">${fmtFull.format(totals.collectionUsd)}</td>
        <td style="text-align:right;border-top:2px solid #1e3a5f;">${fmtFull.format(totals.billingCreditUsd)}</td>
        <td style="text-align:right;border-top:2px solid #1e3a5f;">${fmtFull.format(totals.ubtUsd)}</td>
        <td style="text-align:right;border-top:2px solid #1e3a5f;">${fmtFull.format(totals.arUsd)}</td>
        <td></td>
      </tr>`;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Billing Report</title>
<style>
@page{margin:10mm;size:landscape}
body{font-family:Arial,Helvetica,sans-serif;font-size:8pt;margin:0;padding:10px}
h2{font-size:14pt;margin:0 0 4px}
.sub{color:#666;font-size:9pt;margin-bottom:2px}
.gen{color:#999;font-size:7pt;margin-bottom:8px}
hr{border:0;border-top:1px solid #ddd;margin:4px 0 8px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th{background:#1e3a5f;color:#fff;font-weight:700;font-size:7pt;padding:4px 5px;border:1px solid #94a3b8;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
td{border:1px solid #e5e7eb;padding:3px 5px;font-size:7pt;word-wrap:break-word;overflow-wrap:break-word}
tr{page-break-inside:avoid}
.ft{margin-top:16px;padding-top:8px;border-top:1px solid #ccc;font-size:7pt;color:#999}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<h2>Billing Control Tower Report</h2>
<div class="sub">${escHtml(subtitle)}</div>
<div class="gen">Generated: ${new Date().toLocaleString()}</div><hr/>
<table><colgroup>${colgroup}</colgroup>
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}${totalsHtml}</tbody>
</table>
<div class="ft">Kirkland &amp; Ellis - Billing Control Tower Report</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow popups for this site to print the report.');
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 300);
  }, [sortedRows, totals, subtitle, colWidths, rows.length]);

  const [exporting, setExporting] = useState(false);

  const handleExcelExport = useCallback(async () => {
    if (!rows.length) return;
    setExporting(true);
    try {
      const blob = await downloadExportReportExcel({
        attorneyIds: selectedAttorneys.map((a) => a.staffId),
        statuses: selectedStatuses.map((s) => s.value),
      });
      const timestamp = new Date().toISOString().slice(0, 10);
      saveAs(blob, `billing-report-${timestamp}.xlsx`);
    } catch {
      alert('Failed to export Excel file. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [rows.length, selectedAttorneys, selectedStatuses]);

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

  // Render milestone cell content for the on-screen table
  const renderMilestoneCell = (row: BillingExportRow) => {
    const milestones = row.milestones ?? [];
    if (milestones.length === 0) {
      return <Typography variant="caption" color="text.secondary">{'\u2014'}</Typography>;
    }
    const completedCount = milestones.filter((m) => m.completed).length;
    const chipColor = completedCount === 0 ? 'default' : completedCount === milestones.length ? 'success' : 'warning';
    return (
      <Stack spacing={0}>
        <Chip
          size="small"
          label={`${completedCount}/${milestones.length}`}
          variant="outlined"
          color={chipColor}
          sx={{ fontSize: '0.65rem', height: 20, mb: 0.5, alignSelf: 'flex-start' }}
        />
        {milestones.map((m) => (
          <Stack key={m.milestoneId} direction="row" spacing={0.5} alignItems="center" sx={{ py: 0.125 }}>
            {m.completed ? (
              <CheckCircleIcon sx={{ fontSize: 12, color: 'success.main', flexShrink: 0 }} />
            ) : (
              <PendingIcon sx={{ fontSize: 12, color: 'text.disabled', flexShrink: 0 }} />
            )}
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.65rem',
                lineHeight: 1.2,
                color: m.completed ? 'text.secondary' : 'text.primary',
                wordBreak: 'break-word',
              }}
            >
              {m.title}
            </Typography>
          </Stack>
        ))}
      </Stack>
    );
  };

  // Resize handle element for column headers
  const resizeHandle = (colIdx: number) => (
    <Box
      onMouseDown={(e) => handleResizeStart(colIdx, e)}
      sx={{
        position: 'absolute',
        right: -2,
        top: 0,
        bottom: 0,
        width: 5,
        cursor: 'col-resize',
        zIndex: 1,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
      }}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      aria-labelledby="billing-export-dialog-title"
      PaperProps={{
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
      {/* Dialog title */}
      <DialogTitle id="billing-export-dialog-title" sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <FilterIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            Export Billing Report
          </Typography>
        </Stack>
      </DialogTitle>

      {/* Filter bar */}
      <Box sx={{ px: 3, pb: 2 }}>
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

      <Divider />

      {/* Main content */}
      <DialogContent
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 0,
          position: 'relative',
        }}
      >
        {/* Loading bar */}
        {isFetching && !isLoading && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
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
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <colgroup>
                {colWidths.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
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
                      position: 'relative',
                      overflow: 'hidden',
                      textAlign: 'center',
                    },
                  }}
                >
                  <TableCell align="center">{sortableHeader('cmNumbers', 'C/M Number')}{resizeHandle(0)}</TableCell>
                  <TableCell align="center">{sortableHeader('projectName', 'Project Name')}{resizeHandle(1)}</TableCell>
                  <TableCell align="center">{sortableHeader('bcAttorneyName', 'B&C Attorney')}{resizeHandle(2)}</TableCell>
                  <TableCell align="center">{sortableHeader('sca', 'SCA')}{resizeHandle(3)}</TableCell>
                  <TableCell align="center">{sortableHeader('agreedFeeUsd', 'Fee (US$)')}{resizeHandle(4)}</TableCell>
                  <TableCell align="center">Milestone{resizeHandle(5)}</TableCell>
                  <TableCell align="center">{sortableHeader('billingUsd', 'Billing ($)')}{resizeHandle(6)}</TableCell>
                  <TableCell align="center">{sortableHeader('collectionUsd', 'Collections ($)')}{resizeHandle(7)}</TableCell>
                  <TableCell align="center">{sortableHeader('billingCreditUsd', 'Billing Credit ($)')}{resizeHandle(8)}</TableCell>
                  <TableCell align="center">{sortableHeader('ubtUsd', 'UBT ($)')}{resizeHandle(9)}</TableCell>
                  <TableCell align="center">AR ($){resizeHandle(10)}</TableCell>
                  <TableCell align="center">Notes{resizeHandle(11)}</TableCell>
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
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      },
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.7rem !important' }}>
                      {row.cmNumbers || '\u2014'}
                    </TableCell>
                    <TableCell sx={{ wordBreak: 'break-word' }}>
                      {row.projectName}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.bcAttorneyName}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.sca || '\u2014'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {row.agreedFeeUsd ? fmt.format(row.agreedFeeUsd) : '\u2014'}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', py: '6px !important', overflow: 'hidden' }}>
                      {renderMilestoneCell(row)}
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
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem !important' }}>
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
      </DialogContent>

      {/* Action buttons */}
      <Divider />
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} startIcon={<CloseIcon />} color="inherit">
          Close
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExcelExport}
          disabled={!rows.length || exporting}
        >
          {exporting ? 'Exporting...' : 'Export Excel'}
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
