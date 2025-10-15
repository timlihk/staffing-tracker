import {
  Alert,
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { formatDate, formatDateYmd, buildMilestoneLabel, formatMilestoneValue, type Milestone } from '../../lib/billing/utils';

export interface MilestoneTableProps {
  milestones: Milestone[];
  saving: boolean;
  deleting: boolean;
  onAdd: () => void;
  onEdit: (milestone: Milestone) => void;
  onDelete: (milestone: Milestone) => void;
}

/**
 * Table displaying milestones with add/edit/delete actions
 */
export function MilestoneTable({ milestones, saving, deleting, onAdd, onEdit, onDelete }: MilestoneTableProps) {
  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="subtitle2" color="text.secondary">
          Milestones
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon fontSize="small" />}
          onClick={onAdd}
          disabled={saving}
        >
          Add milestone
        </Button>
      </Stack>

      {milestones.length === 0 ? (
        <Alert severity="info">No milestones recorded for this engagement yet.</Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Milestone</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Billed Date</TableCell>
                <TableCell align="center">Collected Date</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {milestones.map((milestone) => (
                <TableRow key={milestone.milestone_id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" fontWeight={600}>
                        {buildMilestoneLabel(milestone)}
                      </Typography>
                      {milestone.due_date && (
                        <Typography variant="caption" color="text.secondary">
                          Due {formatDate(milestone.due_date)}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {formatMilestoneValue(milestone)}
                  </TableCell>
                  <TableCell align="center">
                    {milestone.completed ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : (
                      <AccessTimeIcon fontSize="small" color="disabled" />
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {formatDateYmd(milestone.invoice_sent_date)}
                  </TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {formatDateYmd(milestone.payment_received_date)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {milestone.notes || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Edit">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => onEdit(milestone)}
                            disabled={saving || deleting}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => onDelete(milestone)}
                            disabled={deleting || saving}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
