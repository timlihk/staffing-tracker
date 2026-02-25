import { type ChangeEvent, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  DeleteOutline as DeleteOutlineIcon,
} from '@mui/icons-material';
import { InfoField } from './InfoField';
import { MilestoneReferenceSection } from './MilestoneReferenceSection';
import { MilestoneTable } from './MilestoneTable';
import { MilestoneReferenceDialog } from './MilestoneReferenceDialog';
import { MilestoneFormDialog } from './MilestoneFormDialog';
import { MilestoneDeleteDialog } from './MilestoneDeleteDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { BillingNotesSection } from './BillingNotesSection';
import {
  useUpdateFeeArrangement,
  useUpdateMilestones,
  useCreateMilestone,
  useDeleteMilestone,
  useDeleteEngagement,
} from '../../hooks/useBilling';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCurrency } from '../../lib/currency';
import {
  formatDate,
  formatDateYmd,
  toInputDate,
  emptyToNull,
  stringToNumberOrNull,
  formatCurrencyWholeWithFallback,
  createMilestoneFormState,
  type Milestone,
  type MilestoneFormState,
} from '../../lib/billing/utils';
import type { EngagementDetailResponse, BillingProjectCM } from '../../api/billing';

const cardSx = {
  p: { xs: 2.5, md: 3 },
};

export interface EngagementCardProps {
  projectId: number;
  cmId: number | null;
  engagement: EngagementDetailResponse;
  cm: BillingProjectCM | null;
}

export function EngagementCard({ projectId, cmId, engagement, cm }: EngagementCardProps) {
  const permissions = usePermissions();
  const [expanded, setExpanded] = useState(false);

  const sortedMilestones = useMemo<Milestone[]>(() => {
    if (!engagement.milestones) return [];
    return [...engagement.milestones].sort((a, b) => {
      if (a.ordinal != null && b.ordinal != null && a.ordinal !== b.ordinal) {
        return a.ordinal - b.ordinal;
      }
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    });
  }, [engagement.milestones]);

  const engagementLabel = engagement.engagement_title || engagement.name || engagement.engagement_code || `Engagement ${engagement.engagement_id}`;

  const completedCount = sortedMilestones.filter((m) => m.completed).length;
  const totalCount = sortedMilestones.length;
  const toggleExpanded = () => setExpanded((prev) => !prev);

  // Mutations
  const updateFeeArrangement = useUpdateFeeArrangement();
  const updateMilestonesMutation = useUpdateMilestones();
  const createMilestoneMutation = useCreateMilestone();
  const deleteMilestoneMutation = useDeleteMilestone();
  const deleteEngagementMutation = useDeleteEngagement();

  // Reference dialog state
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [referenceDraft, setReferenceDraft] = useState('');

  // Milestone dialog state
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneDialogMode, setMilestoneDialogMode] = useState<'add' | 'edit'>('add');
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormState>(() => createMilestoneFormState());
  const [milestoneToEdit, setMilestoneToEdit] = useState<Milestone | null>(null);

  // Delete milestone dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [milestoneToDelete, setMilestoneToDelete] = useState<Milestone | null>(null);

  // Delete engagement dialog state
  const [deleteEngagementDialogOpen, setDeleteEngagementDialogOpen] = useState(false);

  const isReferenceSaving = updateFeeArrangement.isPending;
  const isMilestoneSaving = updateMilestonesMutation.isPending || createMilestoneMutation.isPending;
  const isDeletingMilestone = deleteMilestoneMutation.isPending;
  const isDeletingEngagement = deleteEngagementMutation.isPending;

  // Reference handlers
  const handleOpenReferenceEditor = () => {
    setReferenceDraft(engagement.feeArrangement?.raw_text ?? '');
    setReferenceDialogOpen(true);
  };

  const handleCloseReferenceEditor = () => {
    if (isReferenceSaving) return;
    setReferenceDialogOpen(false);
  };

  const handleSaveReferenceText = async () => {
    try {
      await updateFeeArrangement.mutateAsync({
        projectId,
        engagementId: engagement.engagement_id,
        data: {
          raw_text: referenceDraft,
          lsd_date: engagement.feeArrangement?.lsd_date ?? null,
        },
      });
      setReferenceDialogOpen(false);
    } catch {
      // handled by mutation toast
    }
  };

  // Milestone handlers
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
          engagementId: engagement.engagement_id,
          milestones: [
            {
              milestone_id: Number(milestoneToEdit.milestone_id),
              ...basePayload,
            },
          ],
        });
      } else {
        await createMilestoneMutation.mutateAsync({
          projectId,
          cmId: cmId ?? undefined,
          engagementId: engagement.engagement_id,
          data: basePayload,
        });
      }
      setMilestoneDialogOpen(false);
      setMilestoneToEdit(null);
    } catch {
      // handled by mutation toast
    }
  };

  // Delete handlers
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
    if (!milestoneToDelete) return;
    try {
      await deleteMilestoneMutation.mutateAsync({
        projectId,
        cmId: cmId ?? undefined,
        engagementId: engagement.engagement_id,
        milestoneId: Number(milestoneToDelete.milestone_id),
      });
      setMilestoneToDelete(null);
      setDeleteDialogOpen(false);
    } catch {
      // handled by mutation toast
    }
  };

  // Delete engagement handlers
  const handleOpenDeleteEngagement = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteEngagementDialogOpen(true);
  };

  const handleCloseDeleteEngagement = () => {
    if (isDeletingEngagement) return;
    setDeleteEngagementDialogOpen(false);
  };

  const handleConfirmDeleteEngagement = async () => {
    try {
      await deleteEngagementMutation.mutateAsync({
        projectId,
        cmId: cmId ?? undefined,
        engagementId: engagement.engagement_id,
      });
      setDeleteEngagementDialogOpen(false);
    } catch {
      // handled by mutation toast
    }
  };

  return (
    <>
      <Paper sx={cardSx}>
        <Stack spacing={0}>
          {/* Header — always visible, clickable to toggle */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            onClick={toggleExpanded}
            sx={{
              cursor: 'pointer',
              userSelect: 'none',
              borderRadius: 1,
              px: 1,
              py: 0.75,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton size="small" sx={{ p: 0.25 }} aria-label={expanded ? 'Collapse engagement' : 'Expand engagement'}>
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
              <Stack spacing={0.25}>
                <Typography variant="h6">{engagementLabel}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {expanded ? 'Click to collapse details' : 'Click to expand details'}
                </Typography>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              {totalCount > 0 && (
                <Chip
                  label={`${completedCount}/${totalCount} milestones`}
                  size="small"
                  color={completedCount === totalCount ? 'success' : 'default'}
                  variant="outlined"
                />
              )}
              {permissions.isAdmin && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={handleOpenDeleteEngagement}
                  aria-label="Delete engagement"
                  sx={{ p: 0.5 }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          </Stack>

          <Collapse in={expanded}>
            <Stack spacing={2.5} sx={{ mt: 2.5 }}>
              <Divider />

              {/* Reference text */}
              <MilestoneReferenceSection
                referenceText={engagement.feeArrangement?.raw_text}
                saving={isReferenceSaving}
                onEdit={handleOpenReferenceEditor}
              />

              {/* Info fields */}
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
                <InfoField
                  label="Agreed Fee"
                  value={formatCurrency(engagement.total_agreed_fee_value, engagement.total_agreed_fee_currency)}
                />
                <InfoField label="Long Stop Date" value={formatDateYmd(engagement.feeArrangement?.lsd_date)} />
                <InfoField label="Start Date" value={formatDate(engagement.start_date)} />
                <InfoField label="Target Completion" value={formatDate(engagement.end_date)} />
                <InfoField
                  label="Billing To Date"
                  value={formatCurrencyWholeWithFallback(engagement.billing_usd, engagement.billing_cny)}
                />
                <InfoField
                  label="Collected"
                  value={formatCurrencyWholeWithFallback(engagement.collection_usd, engagement.collection_cny)}
                />
              </Box>

              <Divider />

              {/* Milestone table */}
              <MilestoneTable
                milestones={sortedMilestones}
                saving={isMilestoneSaving}
                deleting={isDeletingMilestone}
                onAdd={() => handleOpenMilestoneDialog('add')}
                onEdit={(milestone) => handleOpenMilestoneDialog('edit', milestone)}
                onDelete={handleOpenDeleteDialog}
              />

              <Divider />

              {/* Notes section */}
              <BillingNotesSection
                projectId={projectId}
                cm={cm}
                engagementId={engagement.engagement_id}
                canEdit={permissions.isAdmin}
              />
            </Stack>
          </Collapse>
        </Stack>
      </Paper>

      {/* Dialogs */}
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

      <DeleteConfirmDialog
        open={deleteEngagementDialogOpen}
        title="Delete engagement"
        message={`Are you sure you want to delete "${engagementLabel}"? This will permanently remove all milestones, fee arrangements, and related data.`}
        deleting={isDeletingEngagement}
        onClose={handleCloseDeleteEngagement}
        onConfirm={handleConfirmDeleteEngagement}
      />
    </>
  );
}
