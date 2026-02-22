import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  LinearProgress,
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
import { CloudUpload, CheckCircle, Warning, ExpandMore, ExpandLess, SmartToy, Error as ErrorIcon, History } from '@mui/icons-material';
import { isAxiosError } from 'axios';
import * as billingApi from '../../api/billing';
import type { ExcelSyncPreview, ExcelSyncResult } from '../../api/billing';

type Phase = 'idle' | 'uploading' | 'previewing' | 'previewed' | 'applying' | 'done' | 'error';

export function BillingExcelSyncPanel() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [preview, setPreview] = useState<ExcelSyncPreview | null>(null);
  const [result, setResult] = useState<ExcelSyncResult | null>(null);
  const [error, setError] = useState('');
  const [showMatched, setShowMatched] = useState(false);
  const [showAiIssues, setShowAiIssues] = useState(true);

  const extractError = (err: unknown, fallback: string): string => {
    if (isAxiosError<{ error?: string }>(err)) {
      return err.response?.data?.error ?? fallback;
    }
    return err instanceof Error ? err.message : fallback;
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPhase('uploading');
    setError('');
    setPreview(null);
    setResult(null);

    try {
      const arrayBuf = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuf).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      setFileBase64(base64);

      setPhase('previewing');
      const previewData = await billingApi.previewExcelSync(base64);
      setPreview(previewData);
      setPhase('previewed');
    } catch (err) {
      setError(extractError(err, 'Failed to parse Excel file'));
      setPhase('error');
    }

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleApply = useCallback(async () => {
    if (!fileBase64) return;
    setPhase('applying');
    setError('');

    try {
      const res = await billingApi.applyExcelSync(fileBase64, fileName);
      setResult(res);
      setPhase('done');
    } catch (err) {
      setError(extractError(err, 'Failed to apply Excel sync'));
      setPhase('error');
    }
  }, [fileBase64, fileName]);

  const handleReset = () => {
    setPhase('idle');
    setFileName('');
    setFileBase64('');
    setPreview(null);
    setResult(null);
    setError('');
    setShowMatched(false);
  };

  const isLoading = phase === 'uploading' || phase === 'previewing' || phase === 'applying';

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Finance Excel Upload
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload the HKCM Project List Excel from the finance department to sync billing data,
          milestones, and financial figures.
        </Typography>
      </Box>

      <Divider />

      {/* Upload area */}
      <Box
        sx={{
          border: '2px dashed',
          borderColor: isLoading ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          bgcolor: 'grey.50',
          position: 'relative',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={handleFileSelect}
        />

        {phase === 'idle' && (
          <>
            <CloudUpload sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              Drop or select the HKCM Project List Excel
            </Typography>
            <Button variant="contained" onClick={() => fileInputRef.current?.click()}>
              Select File
            </Button>
          </>
        )}

        {isLoading && (
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              {phase === 'uploading' && 'Reading file...'}
              {phase === 'previewing' && `Parsing ${fileName}...`}
              {phase === 'applying' && 'Applying changes to database...'}
            </Typography>
            <LinearProgress sx={{ width: '100%', maxWidth: 300 }} />
          </Stack>
        )}

        {(phase === 'previewed' || phase === 'done' || phase === 'error') && (
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
            <Typography variant="body2" color="text.secondary">
              {fileName}
            </Typography>
            <Button size="small" onClick={handleReset}>
              Upload Different File
            </Button>
          </Stack>
        )}
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Preview */}
      {preview && phase === 'previewed' && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Preview Summary
          </Typography>

          <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip label={`${preview.totalExcelRows} rows parsed`} />
            <Chip label={`${preview.matchedCmNumbers} C/M matched`} color="success" />
            {preview.unmatchedCmNumbers.length > 0 && (
              <Chip
                label={`${preview.unmatchedCmNumbers.length} C/M unmatched`}
                color="warning"
                icon={<Warning />}
              />
            )}
            <Chip label={`${preview.projectsToUpdate} projects to update`} color="primary" />
            <Chip label={`${preview.milestonesToCreate} milestones to create`} color="info" />
            {preview.milestonesToMarkCompleted > 0 && (
              <Chip
                label={`${preview.milestonesToMarkCompleted} to mark completed`}
                color="secondary"
              />
            )}
          </Stack>

          {/* Unmatched C/M numbers */}
          {preview.unmatchedCmNumbers.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Unmatched C/M numbers (not in DB, will be skipped):
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {preview.unmatchedCmNumbers.join(', ')}
              </Typography>
            </Alert>
          )}

          {/* Matched details (collapsible) */}
          {preview.matched.length > 0 && (
            <>
              <Button
                size="small"
                onClick={() => setShowMatched(!showMatched)}
                endIcon={showMatched ? <ExpandLess /> : <ExpandMore />}
                sx={{ mb: 1 }}
              >
                {showMatched ? 'Hide' : 'Show'} matched details ({preview.matched.length})
              </Button>
              <Collapse in={showMatched}>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>C/M No</TableCell>
                        <TableCell>Project</TableCell>
                        <TableCell align="center">Engagements</TableCell>
                        <TableCell align="center">Milestones</TableCell>
                        <TableCell align="center">Completed</TableCell>
                        <TableCell>Changes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.matched.map((m) => (
                        <TableRow key={m.cmNo}>
                          <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {m.cmNo}
                          </TableCell>
                          <TableCell>{m.projectName}</TableCell>
                          <TableCell align="center">{m.engagementCount}</TableCell>
                          <TableCell align="center">{m.milestoneCount}</TableCell>
                          <TableCell align="center">{m.completedCount}</TableCell>
                          <TableCell>
                            {m.financialChanges.length > 0 ? (
                              <Typography variant="caption" color="text.secondary">
                                {m.financialChanges.join('; ')}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                No financial changes
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </>
          )}

          {/* AI Validation */}
          {preview.aiValidation && (
            <>
              <Divider sx={{ my: 2 }} />
              {preview.aiValidation.validated ? (
                preview.aiValidation.issues.length > 0 ? (
                  <>
                    <Button
                      size="small"
                      onClick={() => setShowAiIssues(!showAiIssues)}
                      startIcon={<SmartToy />}
                      endIcon={showAiIssues ? <ExpandLess /> : <ExpandMore />}
                      color="warning"
                      sx={{ mb: 1 }}
                    >
                      AI Review: {preview.aiValidation.issues.length} issue{preview.aiValidation.issues.length !== 1 ? 's' : ''} found
                    </Button>
                    <Collapse in={showAiIssues}>
                      <Stack spacing={1} sx={{ mb: 2 }}>
                        {preview.aiValidation.issues.map((issue, idx) => (
                          <Alert
                            key={idx}
                            severity={issue.severity === 'error' ? 'error' : 'warning'}
                            icon={issue.severity === 'error' ? <ErrorIcon /> : <Warning />}
                            sx={{ '& .MuiAlert-message': { width: '100%' } }}
                          >
                            <Typography variant="body2" fontWeight={600}>
                              {issue.cmNo} — {issue.engagementTitle}
                            </Typography>
                            <Typography variant="body2">{issue.issue}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Suggestion: {issue.suggestion}
                            </Typography>
                          </Alert>
                        ))}
                      </Stack>
                    </Collapse>
                  </>
                ) : (
                  <Alert severity="success" icon={<SmartToy />} sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      AI validation passed — no parsing issues detected.
                    </Typography>
                  </Alert>
                )
              ) : (
                <Alert severity="info" icon={<SmartToy />} sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    AI validation unavailable (no API key configured). Parsing was done with regex only.
                  </Typography>
                </Alert>
              )}
            </>
          )}

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={2}>
            <Button variant="contained" color="primary" onClick={handleApply}>
              Apply Changes
            </Button>
            <Button variant="outlined" onClick={handleReset}>
              Cancel
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Result */}
      {result && phase === 'done' && (
        <Alert severity="success" icon={<CheckCircle />}>
          <Typography variant="subtitle2" gutterBottom>
            Excel sync completed successfully
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="body2">
              {result.projectsUpdated} projects updated, {result.financialsUpdated} financial records synced
            </Typography>
            <Typography variant="body2">
              {result.engagementsUpserted} engagements upserted, {result.milestonesCreated} milestones created, {result.milestonesUpdated} updated
            </Typography>
            {result.milestonesMarkedCompleted > 0 && (
              <Typography variant="body2">
                {result.milestonesMarkedCompleted} milestones marked as completed (strikethrough)
              </Typography>
            )}
            {result.unmatchedCmNumbers.length > 0 && (
              <Typography variant="body2" color="warning.main">
                {result.unmatchedCmNumbers.length} C/M numbers not found in DB: {result.unmatchedCmNumbers.join(', ')}
              </Typography>
            )}
          </Stack>
          {result.syncRunId && (
            <Box sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => navigate(`/billing/sync-report/${result.syncRunId}`)}
              >
                View Full Sync Report
              </Button>
            </Box>
          )}
        </Alert>
      )}

      {/* Sync History link */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          startIcon={<History />}
          onClick={() => navigate('/billing/sync-history')}
        >
          Sync History
        </Button>
      </Box>
    </Stack>
  );
}
