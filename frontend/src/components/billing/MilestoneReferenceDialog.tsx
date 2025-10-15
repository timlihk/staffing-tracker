import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';

export interface MilestoneReferenceDialogProps {
  open: boolean;
  value: string;
  saving: boolean;
  onClose: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
}

/**
 * Dialog for editing milestone reference text
 */
export function MilestoneReferenceDialog({
  open,
  value,
  saving,
  onClose,
  onChange,
  onSave,
}: MilestoneReferenceDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit milestone reference text</DialogTitle>
      <DialogContent>
        <TextField
          multiline
          minRows={6}
          fullWidth
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={saving}
          sx={{ mt: 1.5 }}
        />
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
