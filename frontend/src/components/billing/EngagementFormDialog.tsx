import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import type { CreateEngagementPayload } from '../../api/billing';

export interface EngagementFormDialogProps {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (data: CreateEngagementPayload) => void;
  requireSignedDate?: boolean;
}

export function EngagementFormDialog({ open, saving, onClose, onSave, requireSignedDate = false }: EngagementFormDialogProps) {
  const [form, setForm] = useState({
    engagement_title: '',
    engagement_code: '',
    start_date: '',
    end_date: '',
    signed_date: '',
    fee_arrangement_text: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        engagement_title: '',
        engagement_code: '',
        start_date: '',
        end_date: '',
        signed_date: '',
        fee_arrangement_text: '',
      });
    }
  }, [open]);

  const canSave =
    form.engagement_title.trim().length > 0 &&
    (!requireSignedDate || form.signed_date.length > 0) &&
    !saving;

  const handleSave = () => {
    onSave({
      engagement_title: form.engagement_title.trim(),
      engagement_code: form.engagement_code.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      signed_date: form.signed_date || null,
      fee_arrangement_text: form.fee_arrangement_text.trim() || null,
    });
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Engagement</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Engagement Title"
            required
            fullWidth
            value={form.engagement_title}
            onChange={(e) => setForm((prev) => ({ ...prev, engagement_title: e.target.value }))}
            placeholder="e.g. Original EL, Supplemental EL"
            autoFocus
          />
          <TextField
            label="Engagement Code"
            fullWidth
            value={form.engagement_code}
            onChange={(e) => setForm((prev) => ({ ...prev, engagement_code: e.target.value }))}
            placeholder="Optional — auto-generated if blank"
            size="small"
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Signed Date"
              type="date"
              fullWidth
              required={requireSignedDate}
              value={form.signed_date}
              onChange={(e) => setForm((prev) => ({ ...prev, signed_date: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
            />
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              value={form.start_date}
              onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              size="small"
            />
          </Stack>
          <TextField
            label="Fee Arrangement Text"
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
            value={form.fee_arrangement_text}
            onChange={(e) => setForm((prev) => ({ ...prev, fee_arrangement_text: e.target.value }))}
            placeholder="Optional — milestone reference text"
            size="small"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={!canSave}>
          {saving ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
