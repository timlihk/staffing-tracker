import { type ChangeEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { InfoField } from './InfoField';
import { MilestoneReferenceSection } from './MilestoneReferenceSection';
import { MilestoneTable } from './MilestoneTable';
import { MilestoneReferenceDialog } from './MilestoneReferenceDialog';
import { MilestoneFormDialog } from './MilestoneFormDialog';
import { MilestoneDeleteDialog } from './MilestoneDeleteDialog';
import {
  useUpdateFeeArrangement,
  useUpdateMilestones,
  useCreateMilestone,
  useDeleteMilestone,
} from '../../hooks/useBilling';
import { formatCurrency } from '../../lib/currency';
import {
  formatDate,
  formatDateYmd,
  toInputDate,
  emptyToNull,
  stringToNumberOrNull,
  formatCurrencyWholeWithFallback,
  createMilestoneFormState,
  parseEngagementId,
  type Milestone,
  type MilestoneFormState,
} from '../../lib/billing/utils';
import type { CMEngagementSummary, EngagementDetailResponse } from '../../api/billing';

const cardSx = {
  p: { xs: 2.5, md: 3 },
  borderRadius: 1,
};

export interface FeeMilestonesCardProps {
  projectId: number;
  cmId: number | null;
  engagements: CMEngagementSummary[];
  selectedEngagementId: number | null;
  onSelectEngagement: (engagementId: number | null) => void;
  detail: EngagementDetailResponse | null;
  loading: boolean;
}

/**
 * Fee Milestones Card
 * Displays engagement details and milestones with CRUD operations
 */
export function FeeMilestonesCard({
  projectId,
  cmId,
  engagements,
  selectedEngagementId,
  onSelectEngagement,
  detail,
  loading,
}: FeeMilestonesCardProps) {
  const sortedMilestones = useMemo<Milestone[]>(() => {
    if (!detail?.milestones) return [];
    return [...detail.milestones].sort((a, b) => {
      if (a.ordinal != null && b.ordinal != null && a.ordinal !== b.ordinal) {
        return a.ordinal - b.ordinal;
      }
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    });
  }, [detail?.milestones]);

  const currentEngagementLabel = useMemo(() => {
    if (!detail) return 'Engagement';
    return detail.engagement_title || detail.name || detail.engagement_code || `Engagement ${detail.engagement_id}`;
  }, [detail]);

  const updateFeeArrangement = useUpdateFeeArrangement();
  const updateMilestonesMutation = useUpdateMilestones();
  const createMilestoneMutation = useCreateMilestone();
  const deleteMilestoneMutation = useDeleteMilestone();

  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [referenceDraft, setReferenceDraft] = useState('');

  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneDialogMode, setMilestoneDialogMode] = useState<'add' | 'edit'>('add');
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormState>(() => createMilestoneFormState());
  const [milestoneToEdit, setMilestoneToEdit] = useState<Milestone | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<Milestone | null>(null);

  const isReferenceSaving = updateFeeArrangement.isPending;
  const isMilestoneSaving = updateMilestonesMutation.isPending || createMilestoneMutation.isPending;
  const isDeletingMilestone = deleteMilestoneMutation.isPending;

  const handleSelect = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (value === '') {
      onSelectEngagement(null);
      return;
    }
    const parsed = Number(value);
    onSelectEngagement(Number.isNaN(parsed) ? null : parsed);
  };

  const handleOpenReferenceEditor = () => {
    setReferenceDraft(detail?.feeArrangement?.raw_text ?? '');
    setReferenceDialogOpen(true);
  };

  const handleCloseReferenceEditor = () => {
    if (isReferenceSaving) return;
    setReferenceDialogOpen(false);
  };

  const handleSaveReferenceText = async () => {
    if (!detail) return;
    try {
      await updateFeeArrangement.mutateAsync({
        projectId,
        engagementId: detail.engagement_id,
        data: {
          raw_text: referenceDraft,
          lsd_date: detail.feeArrangement?.lsd_date ?? null,
        },
      });
      setReferenceDialogOpen(false);
    } catch {
      // handled by mutation toast
    }
  };

  const handleOpenMilestoneDialog = (mode: 'add' | 'edit', milestone?: Milestone) => {
    setMilestoneDialogMode(mode);
    if (milestone) {
      setMilestoneToEdit(milestone);
      setMilestoneForm(
        createMilestoneFormState({
          title: milestone.title ?? '',
          due_date: toInputDate(milestone.due_date),
          invoice_sent_date: toInputDate(milestone.invoice_sent_date),
          payment_received_date: toInputDate(milestone.payment_received_date),
          notes: milestone.notes ?? '',
          amount_value: milestone.amount_value != null ? String(milestone.amount_value) : '',
          amount_currency: milestone.amount_currency ?? '',
          ordinal: milestone.ordinal != null ? String(milestone.ordinal) : '',
          completed: Boolean(milestone.completed),
        })
      );
    } else {
      setMilestoneToEdit(null);
      setMilestoneForm(
        createMilestoneFormState({
          ordinal: String(sortedMilestones.length + 1),
        })
      );
    }
    setMilestoneDialogOpen(true);
  };

  const handleCloseMilestoneDialog = () => {
    if (isMilestoneSaving) return;
    setMilestoneDialogOpen(false);
    setMilestoneToEdit(null);
  };

  const handleMilestoneFieldChange = (field: keyof MilestoneFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setMilestoneForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleMilestoneCompletedChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMilestoneForm((prev) => ({ ...prev, completed: event.target.checked }));
  };

  const handleSaveMilestone = async () => {
    if (!detail) return;

    const basePayload = {
      title: emptyToNull(milestoneForm.title),
      due_date: emptyToNull(milestoneForm.due_date),
      invoice_sent_date: emptyToNull(milestoneForm.invoice_sent_date),
      payment_received_date: emptyToNull(milestoneForm.payment_received_date),
      notes: emptyToNull(milestoneForm.notes),
      amount_value: stringToNumberOrNull(milestoneForm.amount_value),
      amount_currency: emptyToNull(milestoneForm.amount_currency),
      ordinal: stringToNumberOrNull(milestoneForm.ordinal),
      completed: milestoneForm.completed,
    };

    try {
      if (milestoneDialogMode === 'edit' && milestoneToEdit) {
        await updateMilestonesMutation.mutateAsync({
          projectId,
          cmId: cmId ?? undefined,
          engagementId: detail.engagement_id,
          milestones: [
            {
              milestone_id: milestoneToEdit.milestone_id,
              ...basePayload,
            },
          ],
        });
      } else {
        await createMilestoneMutation.mutateAsync({
          projectId,
          cmId: cmId ?? undefined,
          engagementId: detail.engagement_id,
          data: basePayload,
        });
      }
      setMilestoneDialogOpen(false);
      setMilestoneToEdit(null);
    } catch {
      // handled by mutation toast
    }
  };

  const handleOpenDeleteDialog = (milestone: Milestone) => {
    setMilestoneToDelete(milestone);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (isDeletingMilestone) return;
    setDeleteDialogOpen(false);
    setMilestoneToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!detail || !milestoneToDelete) return;
    try {
      await deleteMilestoneMutation.mutateAsync({
        projectId,
        cmId: cmId ?? undefined,
        engagementId: detail.engagement_id,
        milestoneId: milestoneToDelete.milestone_id,
      });
      setMilestoneToDelete(null);
      setDeleteDialogOpen(false);
    } catch {
      // handled by mutation toast
    }
  };

  return (
    <>
      <Paper sx={cardSx}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Fee Milestones</Typography>
            </Stack>

            {engagements.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="engagement-select-label">Engagement</InputLabel>
                <Select
                  labelId="engagement-select-label"
                  label="Engagement"
                  value={selectedEngagementId != null ? String(selectedEngagementId) : ''}
                  onChange={handleSelect}
                >
                  {engagements
                    .filter((eng) => parseEngagementId(eng.engagement_id) != null)
                    .map((eng) => (
                      <MenuItem key={eng.engagement_id} value={String(eng.engagement_id)}>
                        {eng.engagement_title || eng.name || eng.engagement_code || `Engagement ${eng.engagement_id}`}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          <Divider />

          {loading ? (
            <LinearProgress />
          ) : engagements.length === 0 ? (
            <Alert severity="info">No engagements are linked to this C/M yet.</Alert>
          ) : !detail ? (
            <Alert severity="info">Select an engagement to view milestones.</Alert>
          ) : (
            <Stack spacing={3}>
              <MilestoneReferenceSection
                referenceText={detail.feeArrangement?.raw_text}
                saving={isReferenceSaving}
                onEdit={handleOpenReferenceEditor}
              />

              <Box
                sx={{
                  display: 'grid',
                  gap: 2.5,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(4, minmax(0, 1fr))',
                  },
                }}
              >
                <InfoField label="Engagement" value={currentEngagementLabel} />
                <InfoField label="Start Date" value={formatDate(detail.start_date)} />
                <InfoField label="Target Completion" value={formatDate(detail.end_date)} />
                <InfoField label="Long Stop Date" value={formatDateYmd(detail.feeArrangement?.lsd_date)} />
                <InfoField
                  label="Agreed Fee"
                  value={formatCurrency(detail.total_agreed_fee_value, detail.total_agreed_fee_currency)}
                />
                <InfoField
                  label="Billing To Date"
                  value={formatCurrencyWholeWithFallback(detail.billing_usd, detail.billing_cny)}
                />
                <InfoField
                  label="Collected"
                  value={formatCurrencyWholeWithFallback(detail.collection_usd, detail.collection_cny)}
                />
              </Box>

              <Divider />

              <MilestoneTable
                milestones={sortedMilestones}
                saving={isMilestoneSaving}
                deleting={isDeletingMilestone}
                onAdd={() => handleOpenMilestoneDialog('add')}
                onEdit={(milestone) => handleOpenMilestoneDialog('edit', milestone)}
                onDelete={handleOpenDeleteDialog}
              />
            </Stack>
          )}
        </Stack>
      </Paper>

      <MilestoneReferenceDialog
        open={referenceDialogOpen}
        value={referenceDraft}
        saving={isReferenceSaving}
        onClose={handleCloseReferenceEditor}
        onChange={setReferenceDraft}
        onSave={handleSaveReferenceText}
      />

      <MilestoneFormDialog
        open={milestoneDialogOpen}
        mode={milestoneDialogMode}
        form={milestoneForm}
        saving={isMilestoneSaving}
        onClose={handleCloseMilestoneDialog}
        onFieldChange={handleMilestoneFieldChange}
        onCompletedChange={handleMilestoneCompletedChange}
        onSave={handleSaveMilestone}
      />

      <MilestoneDeleteDialog
        open={deleteDialogOpen}
        milestone={milestoneToDelete}
        deleting={isDeletingMilestone}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
