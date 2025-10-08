import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { Page, PageHeader } from '../components/ui';
import {
  useBillingProjectSummary,
  useCMEngagements,
  useEngagementDetail,
  useUpdateFeeArrangement,
  useUpdateMilestones,
  useCreateMilestone,
  useDeleteMilestone,
} from '../hooks/useBilling';
import type {
  BillingProjectSummaryResponse,
  BillingProjectCM,
  CMEngagementSummary,
  EngagementDetailResponse,
} from '../api/billing';

const cardSx = {
  p: { xs: 2.5, md: 3 },
  borderRadius: 1,
};

export default function BillingMatterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number.parseInt(id || '0', 10) || 0;

  const { data: summary, isLoading: summaryLoading } = useBillingProjectSummary(projectId, { view: 'full' });

  const project = summary?.project;
  const cmNumbers = useMemo(() => summary?.cmNumbers ?? [], [summary?.cmNumbers]);

  const [selectedCmIndex, setSelectedCmIndex] = useState(0);
  const selectedCm: BillingProjectCM | null = cmNumbers[selectedCmIndex] ?? null;
  const selectedCmId = selectedCm?.cm_id ?? null;

  const {
    data: cmEngagements = [],
    isLoading: engagementsLoading,
  } = useCMEngagements(projectId, selectedCmId ?? 0, Boolean(selectedCmId));

  const fallbackEngagements = useMemo<EngagementDetailResponse[]>(() => {
    const list = selectedCm?.engagements;
    return Array.isArray(list) ? list : [];
  }, [selectedCm?.engagements]);

  const engagementSummaries = useMemo<CMEngagementSummary[]>(() => {
    const list = cmEngagements.length ? cmEngagements : fallbackEngagements.map(mapToSummary);

    return list.reduce<CMEngagementSummary[]>((acc, eng) => {
      if (!eng) {
        return acc;
      }

      const numericId = parseEngagementId(eng.engagement_id);
      if (numericId == null) {
        return acc;
      }

      if (numericId === eng.engagement_id) {
        acc.push(eng);
      } else {
        acc.push({ ...eng, engagement_id: numericId });
      }

      return acc;
    }, []);
  }, [cmEngagements, fallbackEngagements]);
  const engagementDetails = fallbackEngagements;

  const [selectedEngagementId, setSelectedEngagementId] = useState<number | null>(() =>
    engagementSummaries[0]?.engagement_id ?? null
  );

  useEffect(() => {
    if (!cmNumbers.length) {
      setSelectedCmIndex(0);
      return;
    }

    setSelectedCmIndex((prev) => (prev < cmNumbers.length ? prev : 0));
  }, [cmNumbers]);

  useEffect(() => {
    if (!engagementSummaries.length) {
      setSelectedEngagementId(null);
      return;
    }

    setSelectedEngagementId((prev) => {
      if (
        typeof prev === 'number' &&
        !Number.isNaN(prev) &&
        engagementSummaries.some((eng) => eng.engagement_id === prev)
      ) {
        return prev;
      }

      const firstValid = engagementSummaries.find((eng) => parseEngagementId(eng.engagement_id) != null);

      return firstValid?.engagement_id ?? null;
    });
  }, [engagementSummaries]);

  const hasValidEngagementId = typeof selectedEngagementId === 'number' && !Number.isNaN(selectedEngagementId);
  const engagementIdForQuery = hasValidEngagementId ? (selectedEngagementId as number) : 0;
  const shouldFetchDetail = hasValidEngagementId && cmEngagements.length > 0;
  const {
    data: engagementDetail,
    isLoading: engagementDetailLoading,
  } = useEngagementDetail(projectId, engagementIdForQuery, shouldFetchDetail);

  const selectedEngagementSummary = useMemo<CMEngagementSummary | null>(() => {
    if (!engagementSummaries.length) return null;
    if (!hasValidEngagementId) {
      return engagementSummaries[0] ?? null;
    }
    return engagementSummaries.find((eng) => eng.engagement_id === selectedEngagementId) ?? engagementSummaries[0];
  }, [engagementSummaries, hasValidEngagementId, selectedEngagementId]);

  const fallbackDetail = useMemo<EngagementDetailResponse | null>(() => {
    if (!engagementDetails?.length) return null;
    if (!hasValidEngagementId) {
      return engagementDetails[0];
    }

    const matched = engagementDetails.find(
      (eng) => parseEngagementId(eng.engagement_id) === selectedEngagementId
    );

    return matched ?? engagementDetails[0];
  }, [engagementDetails, hasValidEngagementId, selectedEngagementId]);

  const selectedEngagement = (hasValidEngagementId ? engagementDetail : null) ?? fallbackDetail;
  const detailLoadingEffective = shouldFetchDetail ? engagementDetailLoading : false;

  const pageSubtitle = useMemo(() => {
    if (!project) return undefined;
    const bits = [project.client_name, project.attorney_in_charge && `Lead: ${project.attorney_in_charge}`].filter(Boolean);
    return bits.join(' • ');
  }, [project]);

  if (!projectId) {
    return (
      <Page>
        <PageHeader title="Billing matter" />
        <Alert severity="error">Invalid billing project id.</Alert>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={project?.project_name || 'Billing matter'}
        subtitle={pageSubtitle}
        actions={
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/billing')} variant="outlined">
            Back to list
          </Button>
        }
      />

      {summaryLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={320}>
          <CircularProgress />
        </Box>
      ) : !project ? (
        <Alert severity="warning">We could not load this billing matter.</Alert>
      ) : cmNumbers.length === 0 ? (
        <CardMessage
          title="No C/M numbers linked"
          description="Add a C/M number to this project to see billing activity and milestones."
        />
      ) : (
        <Stack spacing={3}>
          <Paper sx={{ p: { xs: 1, md: 1.5 }, borderRadius: 1 }}>
            <Tabs
              value={selectedCmIndex}
              onChange={(_, value) => setSelectedCmIndex(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {cmNumbers.map((cm, index) => (
                <Tab
                  key={`${cm.cm_id ?? cm.cm_no ?? index}`}
                  value={index}
                  label={
                    <Stack spacing={0.25} alignItems="flex-start">
                      <Typography variant="body2" fontWeight={600}>
                        {cm.cm_no || 'CM —'}
                      </Typography>
                    </Stack>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
              ))}
            </Tabs>
          </Paper>

          <CmSummaryCard
            project={project}
            cm={selectedCm}
            engagementSummary={selectedEngagementSummary}
            engagementCount={engagementSummaries.length}
            detail={selectedEngagement}
            loading={summaryLoading || engagementsLoading}
          />

          <FeeMilestonesCard
            projectId={projectId}
            cmId={selectedCmId}
            engagements={engagementSummaries}
            selectedEngagementId={selectedEngagementId}
            onSelectEngagement={setSelectedEngagementId}
            detail={selectedEngagement}
            loading={engagementsLoading || detailLoadingEffective}
          />
        </Stack>
      )}
    </Page>
  );
}

function CardMessage({ title, description }: { title: string; description: string }) {
  return (
    <Paper sx={cardSx}>
      <Stack spacing={1.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </Paper>
  );
}

function CmSummaryCard({
  project,
  cm,
  engagementSummary,
  engagementCount,
  detail,
  loading,
}: {
  project: BillingProjectSummaryResponse['project'];
  cm: BillingProjectCM | null;
  engagementSummary: CMEngagementSummary | null;
  engagementCount: number;
  detail: EngagementDetailResponse | null;
  loading: boolean;
}) {
  const statusNormalized = (cm?.status || '').trim().toLowerCase();
  const statusColor: 'default' | 'success' | 'warning' =
    statusNormalized === 'closed' ? 'default' : statusNormalized === 'active' ? 'success' : 'warning';

  const longStopDate = detail?.feeArrangement?.lsd_date || null;

  const agreedFeeValue =
    detail?.total_agreed_fee_value ??
    engagementSummary?.total_agreed_fee_value ??
    project.agreed_fee_usd ??
    project.agreed_fee_cny;
  const agreedFeeCurrency =
    detail?.total_agreed_fee_currency ??
    engagementSummary?.total_agreed_fee_currency ??
    (project.agreed_fee_usd ? 'USD' : project.agreed_fee_cny ? 'CNY' : undefined);

  const billingValueUsd = detail?.billing_usd ?? project.billing_usd;
  const billingValueCny = detail?.billing_cny ?? project.billing_cny;
  const collectedValueUsd = detail?.collection_usd ?? project.collection_usd;
  const collectedValueCny = detail?.collection_cny ?? project.collection_cny;

  return (
    <Paper sx={cardSx}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
            <Typography variant="h6">Client Matter Summary</Typography>
          </Stack>
          {cm?.status && <Chip label={cm.status} color={statusColor} size="small" />}
        </Stack>

        <Divider />

        <Grid container spacing={2.5}>
          <InfoField label="C/M number" value={cm?.cm_no || '—'} loading={loading && !cm} />
          <InfoField label="Client" value={project.client_name || '—'} loading={loading && !project.client_name} />
          <InfoField label="Project lead" value={project.attorney_in_charge || project.bc_attorney_name || '—'} loading={loading} />
          <InfoField label="Opened" value={formatDate(cm?.open_date)} loading={loading} />
          <InfoField label="Closed" value={formatDate(cm?.closed_date)} loading={loading} />
          <InfoField
            label="Engagements"
            value={cm?.engagement_count ?? engagementCount}
            loading={loading && !cm}
          />
          <InfoField label="Long stop date" value={formatDate(longStopDate)} loading={loading} />
          <InfoField
            label="Agreed fee"
            value={formatCurrency(agreedFeeValue ?? null, agreedFeeCurrency ?? null)}
            loading={loading}
          />
          <InfoField
            label="Billing to date"
            value={formatCurrencyPair(billingValueUsd, billingValueCny)}
            loading={loading}
          />
          <InfoField
            label="Collected"
            value={formatCurrencyPair(collectedValueUsd, collectedValueCny)}
            loading={loading}
          />
          <InfoField
            label="UBT"
            value={formatCurrencyPair(
              detail?.ubt_usd ?? project.ubt_usd,
              detail?.ubt_cny ?? project.ubt_cny
            )}
            loading={loading}
          />
          <InfoField
            label="Billing credits"
            value={formatCurrencyPair(
              detail?.billing_credit_usd ?? project.billing_credit_usd,
              detail?.billing_credit_cny ?? project.billing_credit_cny
            )}
            loading={loading}
          />
        </Grid>
      </Stack>
    </Paper>
  );
}

function FeeMilestonesCard({
  projectId,
  cmId,
  engagements,
  selectedEngagementId,
  onSelectEngagement,
  detail,
  loading,
}: {
  projectId: number;
  cmId: number | null;
  engagements: CMEngagementSummary[];
  selectedEngagementId: number | null;
  onSelectEngagement: (engagementId: number | null) => void;
  detail: EngagementDetailResponse | null;
  loading: boolean;
}) {
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

  const hasReferenceText = Boolean(detail?.feeArrangement?.raw_text && detail.feeArrangement.raw_text.trim());

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
              <Typography variant="h6">Fee milestones</Typography>
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
              <Stack spacing={1.25}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1.5}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    Milestone reference text
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon fontSize="small" />}
                    onClick={handleOpenReferenceEditor}
                    disabled={isReferenceSaving}
                  >
                    Edit
                  </Button>
                </Stack>
                <Box
                  sx={{
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    p: 2,
                    bgcolor: 'background.paper',
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {hasReferenceText ? (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {detail.feeArrangement?.raw_text?.trim()}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No reference text captured yet.
                    </Typography>
                  )}
                </Box>
              </Stack>

              <Grid container spacing={2.5}>
                <InfoField label="Engagement" value={currentEngagementLabel} />
                <InfoField label="Start date" value={formatDate(detail.start_date)} />
                <InfoField label="Target completion" value={formatDate(detail.end_date)} />
                <InfoField label="Long stop date" value={formatDate(detail.feeArrangement?.lsd_date)} />
                <InfoField
                  label="Agreed fee"
                  value={formatCurrency(detail.total_agreed_fee_value, detail.total_agreed_fee_currency)}
                />
                <InfoField label="Billing to date" value={formatCurrencyPair(detail.billing_usd, detail.billing_cny)} />
                <InfoField label="Collected" value={formatCurrencyPair(detail.collection_usd, detail.collection_cny)} />
              </Grid>

              <Divider />

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
                    onClick={() => handleOpenMilestoneDialog('add')}
                    disabled={isMilestoneSaving}
                  >
                    Add milestone
                  </Button>
                </Stack>

                {sortedMilestones.length === 0 ? (
                  <Alert severity="info">No milestones recorded for this engagement yet.</Alert>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Milestone</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Billed Date</TableCell>
                          <TableCell>Collected Date</TableCell>
                          <TableCell>Notes</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedMilestones.map((milestone) => {
                          const statusLabel = milestone.completed ? 'Complete' : 'In progress';
                          const statusColor: 'default' | 'success' = milestone.completed ? 'success' : 'default';
                          return (
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
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatMilestoneValue(milestone)}</TableCell>
                              <TableCell>
                                <Chip label={statusLabel} color={statusColor} size="small" />
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateYmd(milestone.invoice_sent_date)}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateYmd(milestone.payment_received_date)}</TableCell>
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
                                        onClick={() => handleOpenMilestoneDialog('edit', milestone)}
                                        disabled={isMilestoneSaving || isDeletingMilestone}
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Remove">
                                    <span>
                                      <IconButton
                                        size="small"
                                        onClick={() => handleOpenDeleteDialog(milestone)}
                                        disabled={isDeletingMilestone || isMilestoneSaving}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Dialog
        open={referenceDialogOpen}
        onClose={handleCloseReferenceEditor}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit milestone reference text</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            minRows={6}
            fullWidth
            autoFocus
            value={referenceDraft}
            onChange={(event) => setReferenceDraft(event.target.value)}
            disabled={isReferenceSaving}
            sx={{ mt: 1.5 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReferenceEditor} disabled={isReferenceSaving}>
            Cancel
          </Button>
          <Button onClick={handleSaveReferenceText} variant="contained" disabled={isReferenceSaving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={milestoneDialogOpen}
        onClose={handleCloseMilestoneDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{milestoneDialogMode === 'edit' ? 'Edit milestone' : 'Add milestone'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={milestoneForm.title}
              onChange={handleMilestoneFieldChange('title')}
              fullWidth
              disabled={isMilestoneSaving}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Due date"
                type="date"
                value={milestoneForm.due_date}
                onChange={handleMilestoneFieldChange('due_date')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled={isMilestoneSaving}
              />
              <TextField
                label="Invoice sent"
                type="date"
                value={milestoneForm.invoice_sent_date}
                onChange={handleMilestoneFieldChange('invoice_sent_date')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled={isMilestoneSaving}
              />
              <TextField
                label="Payment received"
                type="date"
                value={milestoneForm.payment_received_date}
                onChange={handleMilestoneFieldChange('payment_received_date')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled={isMilestoneSaving}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Amount"
                type="number"
                value={milestoneForm.amount_value}
                onChange={handleMilestoneFieldChange('amount_value')}
                fullWidth
                disabled={isMilestoneSaving}
                inputProps={{ step: '0.01' }}
              />
              <TextField
                label="Currency"
                value={milestoneForm.amount_currency}
                onChange={handleMilestoneFieldChange('amount_currency')}
                fullWidth
                disabled={isMilestoneSaving}
              />
              <TextField
                label="Ordinal"
                type="number"
                value={milestoneForm.ordinal}
                onChange={handleMilestoneFieldChange('ordinal')}
                fullWidth
                disabled={isMilestoneSaving}
              />
            </Stack>
            <TextField
              label="Notes"
              value={milestoneForm.notes}
              onChange={handleMilestoneFieldChange('notes')}
              fullWidth
              multiline
              minRows={2}
              disabled={isMilestoneSaving}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={milestoneForm.completed}
                  onChange={handleMilestoneCompletedChange}
                  disabled={isMilestoneSaving}
                />
              }
              label="Completed"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMilestoneDialog} disabled={isMilestoneSaving}>
            Cancel
          </Button>
          <Button onClick={handleSaveMilestone} variant="contained" disabled={isMilestoneSaving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Remove milestone</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {milestoneToDelete
              ? `Are you sure you want to remove ${buildMilestoneLabel(milestoneToDelete)}?`
              : 'Are you sure you want to remove this milestone?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={isDeletingMilestone}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={isDeletingMilestone}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

type InfoFieldProps = {
  label: string;
  value: ReactNode;
  loading?: boolean;
};

function InfoField({ label, value, loading }: InfoFieldProps) {
  return (
    <Grid item xs={12} sm={6} md={3} lg={3}>
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" width={120} sx={{ mt: 0.5 }} />
      ) : (
        <Typography variant="body1" sx={{ mt: 0.5 }}>
          {value ?? '—'}
        </Typography>
      )}
    </Grid>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(value: number | null | undefined, currency: string | undefined | null) {
  if (value == null || Number.isNaN(value)) return '—';
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : '';
  return `${symbol}${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCurrencyWhole(value: number | null | undefined, currency: string | undefined | null) {
  if (value == null || Number.isNaN(value)) return '—';
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : '';
  return `${symbol}${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatCurrencyPair(
  usd: number | null | undefined,
  cny: number | null | undefined
) {
  if (usd != null && !Number.isNaN(usd)) {
    return formatCurrency(usd, 'USD');
  }
  if (cny != null && !Number.isNaN(cny)) {
    return formatCurrency(cny, 'CNY');
  }
  return '—';
}

type Milestone = EngagementDetailResponse['milestones'][number];

type MilestoneFormState = {
  title: string;
  due_date: string;
  invoice_sent_date: string;
  payment_received_date: string;
  notes: string;
  amount_value: string;
  amount_currency: string;
  ordinal: string;
  completed: boolean;
};

function createMilestoneFormState(overrides?: Partial<MilestoneFormState>): MilestoneFormState {
  return {
    title: '',
    due_date: '',
    invoice_sent_date: '',
    payment_received_date: '',
    notes: '',
    amount_value: '',
    amount_currency: 'USD',
    ordinal: '',
    completed: false,
    ...overrides,
  };
}

function toInputDate(value: string | null | undefined) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function emptyToNull(value: string): string | null {
  return value.trim().length ? value : null;
}

function stringToNumberOrNull(value: string): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatDateYmd(value: string | null | undefined) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function buildMilestoneLabel(milestone: Milestone) {
  if (milestone.title) return milestone.title;
  if (milestone.description) return milestone.description;
  if (milestone.raw_fragment) return milestone.raw_fragment;
  return milestone.ordinal != null ? `Milestone ${milestone.ordinal}` : 'Milestone';
}

function parseEngagementId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function mapToSummary(engagement: EngagementDetailResponse): CMEngagementSummary {
  return {
    engagement_id: engagement.engagement_id,
    cm_id: engagement.cm_id,
    engagement_code: engagement.engagement_code,
    engagement_title: engagement.engagement_title,
    name: engagement.name,
    start_date: engagement.start_date,
    end_date: engagement.end_date,
    total_agreed_fee_value: engagement.total_agreed_fee_value,
    total_agreed_fee_currency: engagement.total_agreed_fee_currency,
    milestone_count: engagement.milestones?.length ?? 0,
    completed_milestone_count: engagement.milestones?.filter((milestone) => milestone.completed).length ?? 0,
  };
}

function formatMilestoneValue(milestone: Milestone) {
  if (milestone.amount_value != null) {
    const raw = Number(milestone.amount_value);
    if (!Number.isNaN(raw)) {
      return formatCurrencyWhole(raw, milestone.amount_currency ?? undefined);
    }
  }

  return '—';
}
