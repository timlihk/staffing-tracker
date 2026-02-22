/**
 * Sync Report Page
 *
 * Shows detailed results of a billing Excel sync run.
 * Print-friendly layout with collapsible sections.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  ArrowBack,
  Download,
  Print,
  ExpandMore,
  ExpandLess,
  Warning,
  CheckCircle,
  LinkOff,
  Link as LinkIcon,
  NewReleases,
  Update,
} from '@mui/icons-material';
import { getSyncRunDetail } from '../api/billing';
import apiClient from '../api/client';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumber(val: string | null | undefined): string {
  if (val == null) return '-';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function SyncReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showUpdated, setShowUpdated] = useState(false);
  const [showNew, setShowNew] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [showUnmatched, setShowUnmatched] = useState(true);

  const { data: run, isLoading, error } = useQuery({
    queryKey: ['syncRunDetail', id],
    queryFn: () => getSyncRunDetail(Number(id)),
    enabled: !!id,
  });

  const handleDownload = async () => {
    try {
      const response = await apiClient.get(`/billing/excel-sync/history/${id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = run?.excel_filename || 'sync-excel.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // Ignore download errors
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading sync report...</Typography>
      </Box>
    );
  }

  if (error || !run) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">
          Failed to load sync report. {error instanceof Error ? error.message : ''}
        </Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate(-1)} startIcon={<ArrowBack />}>
          Go Back
        </Button>
      </Box>
    );
  }

  const { summary_json: summary, changes_json: changes } = run;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-expand { display: block !important; max-height: none !important; overflow: visible !important; }
        }
      `}</style>

      <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Finance Excel Sync Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Uploaded: {formatDate(run.uploaded_at)} &middot; By: {run.username || 'System'} &middot; File: {run.excel_filename}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} className="no-print">
            <Button size="small" variant="outlined" startIcon={<Print />} onClick={() => window.print()}>
              Print
            </Button>
            <Button size="small" variant="outlined" startIcon={<Download />} onClick={handleDownload}>
              Download Excel
            </Button>
            <Button size="small" variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/billing/control-tower')}>
              Back to Billing
            </Button>
          </Stack>
        </Stack>

        {/* Summary chips */}
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Summary
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Chip icon={<Update />} label={`${summary.updatedCmCount} updated`} color="primary" />
            <Chip icon={<NewReleases />} label={`${summary.newCmCount} new`} color="success" />
            {summary.skippedCount > 0 && (
              <Chip label={`${summary.skippedCount} skipped`} color="default" />
            )}
            <Chip label={`${summary.engagementsUpserted} engagements`} variant="outlined" />
            <Chip label={`${summary.milestonesCreated + summary.milestonesUpdated} milestones`} variant="outlined" />
            {summary.milestonesMarkedCompleted > 0 && (
              <Chip icon={<CheckCircle />} label={`${summary.milestonesMarkedCompleted} completed`} color="secondary" />
            )}
            <Chip icon={<LinkIcon />} label={`${summary.staffingLinksCount} staffing links`} color="info" />
            {summary.unmatchedCount > 0 && (
              <Chip icon={<LinkOff />} label={`${summary.unmatchedCount} unmatched`} color="warning" />
            )}
          </Stack>
        </Paper>

        {/* Unmatched New Projects */}
        {changes.unmatchedNewCms.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderColor: 'warning.main' }}>
            <Button
              onClick={() => setShowUnmatched(!showUnmatched)}
              endIcon={showUnmatched ? <ExpandLess /> : <ExpandMore />}
              startIcon={<Warning color="warning" />}
              sx={{ mb: 1 }}
            >
              Unmatched New Projects ({changes.unmatchedNewCms.length})
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              These new billing projects could not be auto-linked to a staffing project. Manual linking may be needed.
            </Typography>
            <Collapse in={showUnmatched} className="print-expand">
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>C/M No</TableCell>
                      <TableCell>Project Name</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {changes.unmatchedNewCms.map((cm) => (
                      <TableRow key={cm.cmNo}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{cm.cmNo}</TableCell>
                        <TableCell>{cm.projectName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Paper>
        )}

        {/* Staffing Project Links */}
        {changes.staffingLinks.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Button
              onClick={() => setShowLinks(!showLinks)}
              endIcon={showLinks ? <ExpandLess /> : <ExpandMore />}
              startIcon={<LinkIcon color="info" />}
              sx={{ mb: 1 }}
            >
              Staffing Project Links Created ({changes.staffingLinks.length})
            </Button>
            <Collapse in={showLinks} className="print-expand">
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>C/M No</TableCell>
                      <TableCell>Billing Project</TableCell>
                      <TableCell>Staffing Project</TableCell>
                      <TableCell>Match Method</TableCell>
                      <TableCell>C/M Set</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {changes.staffingLinks.map((link) => (
                      <TableRow key={link.cmNo}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{link.cmNo}</TableCell>
                        <TableCell>{link.billingProjectName}</TableCell>
                        <TableCell>{link.staffingProjectName}</TableCell>
                        <TableCell>
                          <Typography variant="caption">{link.matchMethod}</Typography>
                        </TableCell>
                        <TableCell>
                          {link.cmNumberSet ? (
                            <CheckCircle fontSize="small" color="success" />
                          ) : (
                            <Typography variant="caption" color="text.secondary">already set</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Paper>
        )}

        {/* New Billing Projects */}
        {changes.newCms.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Button
              onClick={() => setShowNew(!showNew)}
              endIcon={showNew ? <ExpandLess /> : <ExpandMore />}
              startIcon={<NewReleases color="success" />}
              sx={{ mb: 1 }}
            >
              New Billing Projects ({changes.newCms.length})
            </Button>
            <Collapse in={showNew} className="print-expand">
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>C/M No</TableCell>
                      <TableCell>Project Name</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell align="center">Engagements</TableCell>
                      <TableCell align="center">Milestones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {changes.newCms.map((cm) => (
                      <TableRow key={cm.cmNo}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{cm.cmNo}</TableCell>
                        <TableCell>{cm.projectName}</TableCell>
                        <TableCell>{cm.clientName}</TableCell>
                        <TableCell align="center">{cm.engagements.length}</TableCell>
                        <TableCell align="center">
                          {cm.engagements.reduce((sum, e) => sum + e.milestoneCount, 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Paper>
        )}

        {/* Financial Updates */}
        {changes.updatedCms.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Button
              onClick={() => setShowUpdated(!showUpdated)}
              endIcon={showUpdated ? <ExpandLess /> : <ExpandMore />}
              startIcon={<Update color="primary" />}
              sx={{ mb: 1 }}
            >
              Financial Updates ({changes.updatedCms.length})
            </Button>
            <Collapse in={showUpdated} className="print-expand">
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>C/M No</TableCell>
                      <TableCell>Project</TableCell>
                      <TableCell>Field</TableCell>
                      <TableCell align="right">Old Value</TableCell>
                      <TableCell align="right">New Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {changes.updatedCms.flatMap((cm) =>
                      cm.financialChanges.length > 0
                        ? cm.financialChanges.map((fc, idx) => (
                            <TableRow key={`${cm.cmNo}-${idx}`}>
                              {idx === 0 ? (
                                <>
                                  <TableCell
                                    rowSpan={cm.financialChanges.length}
                                    sx={{ fontFamily: 'monospace', verticalAlign: 'top' }}
                                  >
                                    {cm.cmNo}
                                  </TableCell>
                                  <TableCell
                                    rowSpan={cm.financialChanges.length}
                                    sx={{ verticalAlign: 'top' }}
                                  >
                                    {cm.projectName}
                                  </TableCell>
                                </>
                              ) : null}
                              <TableCell>{fc.field}</TableCell>
                              <TableCell align="right" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                {formatNumber(fc.oldValue)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                {formatNumber(fc.newValue)}
                              </TableCell>
                            </TableRow>
                          ))
                        : [
                            <TableRow key={cm.cmNo}>
                              <TableCell sx={{ fontFamily: 'monospace' }}>{cm.cmNo}</TableCell>
                              <TableCell>{cm.projectName}</TableCell>
                              <TableCell colSpan={3}>
                                <Typography variant="caption" color="text.secondary">
                                  No financial changes
                                </Typography>
                              </TableCell>
                            </TableRow>,
                          ]
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Paper>
        )}

        {/* Skipped */}
        {changes.skippedCms.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Skipped C/M Numbers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {changes.skippedCms.join(', ')}
            </Typography>
          </Paper>
        )}

        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Sync Run #{run.id} &middot; Status: {run.status}
          {run.error_message && ` &middot; Error: ${run.error_message}`}
        </Typography>
      </Box>
    </>
  );
}
