import { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material';
import { useCreateEngagement, useCreateMilestone } from '../../hooks/useBilling';
import { toast } from '../../lib/toast';

interface MilestoneEntry {
  key: number;
  title: string;
  amount_value: string;
  amount_currency: string;
}

const cardSx = {
  p: { xs: 2.5, md: 3 },
  borderRadius: 1,
};

let milestoneKeyCounter = 0;

function nextKey() {
  return ++milestoneKeyCounter;
}

const ORDINAL_LABELS = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)'];

export interface EngagementFormCardProps {
  projectId: number;
  cmId: number;
  onClose: () => void;
  requireSignedDate?: boolean;
}

export function EngagementFormCard({
  projectId,
  cmId,
  onClose,
  requireSignedDate = false,
}: EngagementFormCardProps) {
  const [form, setForm] = useState({
    engagement_title: '',
    engagement_code: '',
    signed_date: '',
    start_date: '',
    end_date: '',
    fee_arrangement_text: '',
  });
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const createEngagement = useCreateEngagement();
  const createMilestone = useCreateMilestone();

  const updateField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const canSave =
    form.engagement_title.trim().length > 0 &&
    (!requireSignedDate || form.signed_date.length > 0) &&
    !saving;

  const handleAddMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      { key: nextKey(), title: '', amount_value: '', amount_currency: 'USD' },
    ]);
  };

  const handleRemoveMilestone = (key: number) => {
    setMilestones((prev) => prev.filter((m) => m.key !== key));
  };

  const handleMilestoneChange = (
    key: number,
    field: keyof Omit<MilestoneEntry, 'key'>,
    value: string
  ) => {
    setMilestones((prev) =>
      prev.map((m) => (m.key === key ? { ...m, [field]: value } : m))
    );
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const result = await createEngagement.mutateAsync({
        projectId,
        cmId,
        data: {
          engagement_title: form.engagement_title.trim(),
          engagement_code: form.engagement_code.trim() || null,
          signed_date: form.signed_date || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          fee_arrangement_text: form.fee_arrangement_text.trim() || null,
        },
      });

      // Create milestones sequentially to preserve order
      const validMilestones = milestones.filter(
        (m) => m.title.trim().length > 0 || m.amount_value.trim().length > 0
      );

      for (let i = 0; i < validMilestones.length; i++) {
        const m = validMilestones[i];
        const amountNum = parseFloat(m.amount_value.replace(/,/g, ''));
        try {
          await createMilestone.mutateAsync({
            projectId,
            cmId,
            engagementId: result.engagement_id,
            data: {
              title: m.title.trim() || null,
              amount_value: Number.isFinite(amountNum) ? amountNum : null,
              amount_currency: m.amount_currency || 'USD',
              ordinal: i + 1,
            },
          });
        } catch {
          toast.warning(
            `Created engagement but failed to add milestone ${ORDINAL_LABELS[i] ?? i + 1}`
          );
        }
      }

      onClose();
    } catch {
      // Engagement creation error handled by mutation hook toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper sx={{ ...cardSx, border: '2px solid', borderColor: 'primary.main' }}>
      <Stack spacing={2.5}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">New Engagement</Typography>
          <IconButton size="small" onClick={onClose} disabled={saving} aria-label="Cancel">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider />

        {/* Identity */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Engagement Title"
            required
            fullWidth
            value={form.engagement_title}
            onChange={updateField('engagement_title')}
            placeholder="e.g. Original EL, Supplemental EL"
            disabled={saving}
            autoFocus
            sx={{ flex: 2 }}
          />
          <TextField
            label="Engagement Code"
            fullWidth
            value={form.engagement_code}
            onChange={updateField('engagement_code')}
            placeholder="Auto-generated if blank"
            disabled={saving}
            size="small"
            sx={{ flex: 1 }}
          />
        </Stack>

        {/* Dates */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Signed Date"
            type="date"
            fullWidth
            required={requireSignedDate}
            value={form.signed_date}
            onChange={updateField('signed_date')}
            slotProps={{ inputLabel: { shrink: true } }}
            disabled={saving}
            size="small"
          />
          <TextField
            label="Start Date"
            type="date"
            fullWidth
            value={form.start_date}
            onChange={updateField('start_date')}
            slotProps={{ inputLabel: { shrink: true } }}
            disabled={saving}
            size="small"
          />
          <TextField
            label="End Date"
            type="date"
            fullWidth
            value={form.end_date}
            onChange={updateField('end_date')}
            slotProps={{ inputLabel: { shrink: true } }}
            disabled={saving}
            size="small"
          />
        </Stack>

        {/* Fee arrangement */}
        <TextField
          label="Fee Arrangement Text"
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          value={form.fee_arrangement_text}
          onChange={updateField('fee_arrangement_text')}
          placeholder="Optional — milestone reference text from engagement letter"
          disabled={saving}
          size="small"
        />

        <Divider />

        {/* Milestones */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Milestones
            {milestones.length > 0 && (
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                (optional — can also be added later)
              </Typography>
            )}
          </Typography>

          {milestones.length === 0 ? (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddMilestone}
              disabled={saving}
            >
              Add milestone
            </Button>
          ) : (
            <Stack spacing={1.5}>
              {milestones.map((m, idx) => (
                <Stack key={m.key} direction="row" spacing={1} alignItems="center">
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ minWidth: 28, textAlign: 'center' }}
                  >
                    {ORDINAL_LABELS[idx] ?? `(${idx + 1})`}
                  </Typography>
                  <TextField
                    placeholder="Milestone title"
                    value={m.title}
                    onChange={(e) => handleMilestoneChange(m.key, 'title', e.target.value)}
                    size="small"
                    disabled={saving}
                    sx={{ flex: 3 }}
                  />
                  <TextField
                    placeholder="Amount"
                    value={m.amount_value}
                    onChange={(e) => handleMilestoneChange(m.key, 'amount_value', e.target.value)}
                    size="small"
                    disabled={saving}
                    sx={{ flex: 1, minWidth: 100 }}
                  />
                  <TextField
                    select
                    value={m.amount_currency}
                    onChange={(e) => handleMilestoneChange(m.key, 'amount_currency', e.target.value)}
                    size="small"
                    disabled={saving}
                    sx={{ minWidth: 80 }}
                  >
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="CNY">CNY</MenuItem>
                    <MenuItem value="HKD">HKD</MenuItem>
                  </TextField>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveMilestone(m.key)}
                    disabled={saving}
                    aria-label="Remove milestone"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}

              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddMilestone}
                disabled={saving}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add milestone
              </Button>
            </Stack>
          )}
        </Box>

        <Divider />

        {/* Actions */}
        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={!canSave}>
            {saving ? 'Creating...' : 'Create Engagement'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
