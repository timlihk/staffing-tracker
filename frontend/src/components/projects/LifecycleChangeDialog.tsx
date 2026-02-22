import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import * as billingApi from '../../api/billing';
import type {
  BillingProjectSummaryResponse,
  CreateEngagementPayload,
  EngagementDetailResponse,
} from '../../api/billing';
import { formatCurrency } from '../../lib/currency';
import { toast } from '../../lib/toast';

interface MilestoneCheckItem {
  milestone_id: number;
  engagement_id: number;
  engagement_title: string;
  title: string | null;
  amount_value: number | null;
  amount_currency: string | null;
  completed: boolean;
  originalCompleted: boolean;
}

export interface LifecycleChangeDialogProps {
  open: boolean;
  cmNumber: string;
  isNewEngagement: boolean;
  onClose: () => void;
}

export function LifecycleChangeDialog({
  open,
  cmNumber,
  isNewEngagement,
  onClose,
}: LifecycleChangeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [billingProjectId, setBillingProjectId] = useState<number | null>(null);
  const [cmId, setCmId] = useState<number | null>(null);
  const [milestones, setMilestones] = useState<MilestoneCheckItem[]>([]);
  const [savingMilestones, setSavingMilestones] = useState(false);
  const [milestonesDone, setMilestonesDone] = useState(false);
  const [noMilestones, setNoMilestones] = useState(false);

  // Engagement form state (for new_engagement stage)
  const [engagementForm, setEngagementForm] = useState({
    engagement_title: '',
    engagement_code: '',
    start_date: '',
    signed_date: '',
    fee_arrangement_text: '',
  });
  const [savingEngagement, setSavingEngagement] = useState(false);
  const [billingLoadFailed, setBillingLoadFailed] = useState(false);

  // Load billing data when dialog opens
  useEffect(() => {
    if (!open || !cmNumber) return;
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setMilestonesDone(false);
      setNoMilestones(false);
      setBillingLoadFailed(false);
      setBillingProjectId(null);
      setCmId(null);
      setMilestones([]);
      setEngagementForm({
        engagement_title: '',
        engagement_code: '',
        start_date: '',
        signed_date: '',
        fee_arrangement_text: '',
      });

      try {
        // Look up billing project
        const lookup = await billingApi.lookupByCmNumber(cmNumber);
        if (cancelled) return;

        if (!lookup.found || !lookup.billingProjectId || !lookup.cmId) {
          setNoMilestones(true);
          setMilestonesDone(true);
          setLoading(false);
          return;
        }

        setBillingProjectId(lookup.billingProjectId);
        setCmId(lookup.cmId);

        // Fetch full summary with engagements + milestones
        const summary: BillingProjectSummaryResponse = await billingApi.getBillingProjectSummary(
          lookup.billingProjectId,
          { view: 'full' }
        );
        if (cancelled) return;

        // Flatten all milestones across all engagements
        const allMilestones: MilestoneCheckItem[] = [];
        const cm = summary.cmNumbers?.find((c) => Number(c.cm_id) === lookup.cmId);
        const engagements: EngagementDetailResponse[] = cm?.engagements ?? [];

        for (const eng of engagements) {
          const engTitle =
            eng.engagement_title || eng.name || eng.engagement_code || `Engagement ${eng.engagement_id}`;
          for (const m of eng.milestones ?? []) {
            allMilestones.push({
              milestone_id: Number(m.milestone_id),
              engagement_id: Number(eng.engagement_id),
              engagement_title: engTitle,
              title: m.title,
              amount_value: m.amount_value,
              amount_currency: m.amount_currency,
              completed: Boolean(m.completed),
              originalCompleted: Boolean(m.completed),
            });
          }
        }

        if (allMilestones.length === 0) {
          setNoMilestones(true);
          setMilestonesDone(true);
        }

        setMilestones(allMilestones);
      } catch {
        // Billing data may be inaccessible (no billing access, no billing project, etc.)
        // Don't block the lifecycle update — just skip milestones/engagement sections
        setBillingLoadFailed(true);
        setNoMilestones(true);
        setMilestonesDone(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [open, cmNumber]);

  const toggleMilestone = (milestoneId: number) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.milestone_id === milestoneId ? { ...m, completed: !m.completed } : m
      )
    );
  };

  const handleSaveMilestones = async () => {
    const changed = milestones.filter((m) => m.completed !== m.originalCompleted);
    if (changed.length === 0) {
      setMilestonesDone(true);
      return;
    }

    try {
      setSavingMilestones(true);
      await billingApi.updateMilestones({
        milestones: changed.map((m) => ({
          milestone_id: m.milestone_id,
          completed: m.completed,
        })),
      });
      toast.success(`${changed.length} milestone${changed.length > 1 ? 's' : ''} updated`);
      setMilestonesDone(true);
    } catch {
      toast.error('Failed to update milestones');
    } finally {
      setSavingMilestones(false);
    }
  };

  const handleSkipMilestones = () => {
    setMilestonesDone(true);
  };

  const canCreateEngagement =
    engagementForm.engagement_title.trim().length > 0 &&
    engagementForm.signed_date.length > 0 &&
    !savingEngagement;

  const handleCreateEngagement = async () => {
    if (!billingProjectId || !cmId) return;

    const data: CreateEngagementPayload = {
      engagement_title: engagementForm.engagement_title.trim(),
      engagement_code: engagementForm.engagement_code.trim() || null,
      start_date: engagementForm.start_date || null,
      signed_date: engagementForm.signed_date || null,
      fee_arrangement_text: engagementForm.fee_arrangement_text.trim() || null,
    };

    try {
      setSavingEngagement(true);
      await billingApi.createEngagement(billingProjectId, cmId, data);
      toast.success('Engagement created successfully');
      onClose();
    } catch {
      toast.error('Failed to create engagement');
    } finally {
      setSavingEngagement(false);
    }
  };

  const handleDone = () => {
    onClose();
  };

  // Determine which section to show
  // If billing data failed to load, skip engagement form (can't create without billingProjectId)
  const showMilestoneSection = !milestonesDone;
  const showEngagementSection = milestonesDone && isNewEngagement && !billingLoadFailed;
  const showDoneButton = milestonesDone && (!isNewEngagement || billingLoadFailed);

  return (
    <Dialog open={open} fullWidth maxWidth="sm" onClose={loading ? undefined : onClose}>
      <DialogTitle>
        {showMilestoneSection
          ? 'Confirm Milestone Completion'
          : showEngagementSection
            ? 'Create New Engagement'
            : 'Lifecycle Updated'}
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : billingLoadFailed ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              Could not load billing data. The lifecycle stage has been updated successfully.
              {isNewEngagement && ' You can create a new engagement manually from the billing detail page.'}
            </Alert>
          </Stack>
        ) : showMilestoneSection ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              The lifecycle stage has changed. Please confirm if any milestones have been completed.
            </Typography>

            {noMilestones ? (
              <Alert severity="info">No milestones found for this billing project.</Alert>
            ) : (
              <Stack spacing={0.5}>
                {milestones.map((m) => (
                  <FormControlLabel
                    key={m.milestone_id}
                    control={
                      <Checkbox
                        checked={m.completed}
                        onChange={() => toggleMilestone(m.milestone_id)}
                        disabled={savingMilestones}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {m.title || `Milestone #${m.milestone_id}`}
                        </Typography>
                        {m.amount_value != null && (
                          <Typography variant="caption" color="text.secondary">
                            ({formatCurrency(m.amount_value, m.amount_currency)})
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.disabled">
                          — {m.engagement_title}
                        </Typography>
                      </Stack>
                    }
                  />
                ))}
              </Stack>
            )}
          </Stack>
        ) : showEngagementSection ? (
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Alert severity="info">
              A new engagement is required for this lifecycle stage. Please fill in the details below.
              Signed date is mandatory.
            </Alert>

            <TextField
              label="Engagement Title"
              required
              fullWidth
              value={engagementForm.engagement_title}
              onChange={(e) => setEngagementForm((prev) => ({ ...prev, engagement_title: e.target.value }))}
              placeholder="e.g. Original EL, Supplemental EL"
              autoFocus
            />
            <TextField
              label="Engagement Code"
              fullWidth
              value={engagementForm.engagement_code}
              onChange={(e) => setEngagementForm((prev) => ({ ...prev, engagement_code: e.target.value }))}
              placeholder="Optional — auto-generated if blank"
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Signed Date"
                type="date"
                fullWidth
                required
                value={engagementForm.signed_date}
                onChange={(e) => setEngagementForm((prev) => ({ ...prev, signed_date: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
                size="small"
              />
              <TextField
                label="Start Date"
                type="date"
                fullWidth
                value={engagementForm.start_date}
                onChange={(e) => setEngagementForm((prev) => ({ ...prev, start_date: e.target.value }))}
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
              value={engagementForm.fee_arrangement_text}
              onChange={(e) => setEngagementForm((prev) => ({ ...prev, fee_arrangement_text: e.target.value }))}
              placeholder="Optional — milestone reference text"
              size="small"
            />
          </Stack>
        ) : null}
      </DialogContent>

      <Divider />

      <DialogActions>
        {showMilestoneSection && !noMilestones && (
          <>
            <Button onClick={handleSkipMilestones} disabled={savingMilestones}>
              Skip
            </Button>
            <Button
              onClick={handleSaveMilestones}
              variant="contained"
              disabled={savingMilestones}
            >
              {savingMilestones ? 'Saving...' : 'Save & Continue'}
            </Button>
          </>
        )}

        {showMilestoneSection && noMilestones && (
          <Button onClick={handleSkipMilestones} variant="contained">
            Continue
          </Button>
        )}

        {showEngagementSection && (
          <Button
            onClick={handleCreateEngagement}
            variant="contained"
            disabled={!canCreateEngagement}
          >
            {savingEngagement ? 'Creating...' : 'Create Engagement'}
          </Button>
        )}

        {showDoneButton && (
          <Button onClick={handleDone} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
