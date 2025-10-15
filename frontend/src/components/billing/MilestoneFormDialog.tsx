import { type ChangeEvent } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
} from '@mui/material';
import type { MilestoneFormState } from '../../lib/billing/utils';

export interface MilestoneFormDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  form: MilestoneFormState;
  saving: boolean;
  onClose: () => void;
  onFieldChange: (field: keyof MilestoneFormState) => (event: ChangeEvent<HTMLInputElement>) => void;
  onCompletedChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
}

/**
 * Dialog for adding or editing a milestone
 */
export function MilestoneFormDialog({
  open,
  mode,
  form,
  saving,
  onClose,
  onFieldChange,
  onCompletedChange,
  onSave,
}: MilestoneFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'edit' ? 'Edit milestone' : 'Add milestone'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Title"
            value={form.title}
            onChange={onFieldChange('title')}
            fullWidth
            disabled={saving}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Due date"
              type="date"
              value={form.due_date}
              onChange={onFieldChange('due_date')}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled={saving}
            />
            <TextField
              label="Invoice sent"
              type="date"
              value={form.invoice_sent_date}
              onChange={onFieldChange('invoice_sent_date')}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled={saving}
            />
            <TextField
              label="Payment received"
              type="date"
              value={form.payment_received_date}
              onChange={onFieldChange('payment_received_date')}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled={saving}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Amount"
              type="number"
              value={form.amount_value}
              onChange={onFieldChange('amount_value')}
              fullWidth
              disabled={saving}
              inputProps={{ step: '0.01' }}
            />
            <TextField
              label="Currency"
              value={form.amount_currency}
              onChange={onFieldChange('amount_currency')}
              fullWidth
              disabled={saving}
            />
            <TextField
              label="Ordinal"
              type="number"
              value={form.ordinal}
              onChange={onFieldChange('ordinal')}
              fullWidth
              disabled={saving}
            />
          </Stack>
          <TextField
            label="Notes"
            value={form.notes}
            onChange={onFieldChange('notes')}
            fullWidth
            multiline
            minRows={2}
            disabled={saving}
          />
          <FormControlLabel
            control={<Checkbox checked={form.completed} onChange={onCompletedChange} disabled={saving} />}
            label="Completed"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} variant="contained" disabled={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
