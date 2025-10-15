import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { buildMilestoneLabel, type Milestone } from '../../lib/billing/utils';

export interface MilestoneDeleteDialogProps {
  open: boolean;
  milestone: Milestone | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog for deleting a milestone
 */
export function MilestoneDeleteDialog({
  open,
  milestone,
  deleting,
  onClose,
  onConfirm,
}: MilestoneDeleteDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Remove milestone</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {milestone
            ? `Are you sure you want to remove ${buildMilestoneLabel(milestone)}?`
            : 'Are you sure you want to remove this milestone?'}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={deleting}>
          Remove
        </Button>
      </DialogActions>
    </Dialog>
  );
}
