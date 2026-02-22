/**
 * Sync History Page
 *
 * Lists all previous billing Excel sync runs.
 */

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { ArrowBack, Visibility } from '@mui/icons-material';
import { getSyncHistory } from '../api/billing';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SyncHistory() {
  const navigate = useNavigate();

  const { data: runs, isLoading, error } = useQuery({
    queryKey: ['syncHistory'],
    queryFn: getSyncHistory,
  });

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Excel Sync History
        </Typography>
        <Button size="small" variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/billing/control-tower')}>
          Back to Billing
        </Button>
      </Stack>

      {isLoading && (
        <Typography color="text.secondary">Loading...</Typography>
      )}

      {error && (
        <Alert severity="error">
          Failed to load sync history. {error instanceof Error ? error.message : ''}
        </Alert>
      )}

      {runs && runs.length === 0 && (
        <Alert severity="info">No sync runs found.</Alert>
      )}

      {runs && runs.length > 0 && (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell align="center">Updated</TableCell>
                  <TableCell align="center">New</TableCell>
                  <TableCell align="center">Links</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/billing/sync-report/${run.id}`)}>
                    <TableCell>{run.id}</TableCell>
                    <TableCell>{formatDate(run.uploaded_at)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {run.excel_filename}
                      </Typography>
                    </TableCell>
                    <TableCell>{run.username || '-'}</TableCell>
                    <TableCell align="center">{run.summary_json.updatedCmCount}</TableCell>
                    <TableCell align="center">{run.summary_json.newCmCount}</TableCell>
                    <TableCell align="center">{run.summary_json.staffingLinksCount}</TableCell>
                    <TableCell>
                      <Chip
                        label={run.status}
                        size="small"
                        color={run.status === 'completed' ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<Visibility />}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
