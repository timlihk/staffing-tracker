import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader, Section } from '../components/ui';
import {
  useBillingFinanceSummary,
  useBillingPipelineInsights,
  useBillingTriggers,
  useConfirmBillingTrigger,
  useLongStopRisks,
  useRejectBillingTrigger,
  useUnpaidInvoices,
  useUpdateTriggerActionItem,
} from '../hooks/useBilling';
import { usePermissions } from '../hooks/usePermissions';
import type { BillingLongStopRiskRow, BillingTriggerRow } from '../api/billing';

type MetricTone = 'neutral' | 'positive' | 'warning' | 'danger';
type InvoiceQueueStage = 'needs_confirmation' | 'ready_to_invoice';

interface MetricCardProps {
  label: string;
  value: string;
  helper?: string;
  tone?: MetricTone;
}

interface InvoiceQueueRow {
  stage: InvoiceQueueStage;
  trigger: BillingTriggerRow;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const toneStyles: Record<MetricTone, { borderColor: string; backgroundColor: string }> = {
  neutral: {
    borderColor: 'divider',
    backgroundColor: 'background.paper',
  },
  positive: {
    borderColor: 'success.light',
    backgroundColor: 'success.50',
  },
  warning: {
    borderColor: 'warning.light',
    backgroundColor: 'warning.50',
  },
  danger: {
    borderColor: 'error.light',
    backgroundColor: 'error.50',
  },
};

const MetricCard: React.FC<MetricCardProps> = ({ label, value, helper, tone = 'neutral' }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      flex: 1,
      minWidth: 170,
      borderColor: toneStyles[tone].borderColor,
      bgcolor: toneStyles[tone].backgroundColor,
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      {value}
    </Typography>
    {helper ? (
      <Typography variant="caption" color="text.secondary">
        {helper}
      </Typography>
    ) : null}
  </Paper>
);

const toNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '—');

const plusDaysYmd = (days: number) => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate.toISOString().slice(0, 10);
};

const getErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load billing control tower data';
};

const getLongStopRiskChip = (row: BillingLongStopRiskRow) => {
  if (row.riskLevel === 'past_due' || row.daysToLongStop < 0) {
    return { label: `${Math.abs(row.daysToLongStop)}d past`, color: 'error' as const };
  }
  if (row.riskLevel === 'due_14') {
    return { label: `${row.daysToLongStop}d left`, color: 'warning' as const };
  }
  if (row.riskLevel === 'due_30') {
    return { label: `${row.daysToLongStop}d left`, color: 'info' as const };
  }
  return { label: `${row.daysToLongStop}d left`, color: 'default' as const };
};

const getAgingChip = (days: number) => {
  if (days >= 90) return { label: `${days}d`, color: 'error' as const };
  if (days >= 60) return { label: `${days}d`, color: 'warning' as const };
  if (days >= 30) return { label: `${days}d`, color: 'info' as const };
  return { label: `${days}d`, color: 'default' as const };
};

const BillingControlTower: React.FC = () => {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const canOperateQueue = permissions.isAdmin;

  const [attorneyFilter, setAttorneyFilter] = useState<number | undefined>(undefined);
  const [minAmount, setMinAmount] = useState<number | undefined>(undefined);
  const [windowDays, setWindowDays] = useState(30);
  const [unpaidThresholdDays, setUnpaidThresholdDays] = useState(30);
  const [triggerSearch, setTriggerSearch] = useState('');

  const scopedParams = attorneyFilter ? { attorneyId: attorneyFilter } : undefined;

  const financeSummaryQuery = useBillingFinanceSummary(scopedParams);
  const pipelineInsightsQuery = useBillingPipelineInsights();
  const triggersQuery = useBillingTriggers(scopedParams);
  const longStopQuery = useLongStopRisks({
    ...scopedParams,
    windowDays,
    minUbtAmount: minAmount,
    limit: 1000,
  });
  const unpaidQuery = useUnpaidInvoices({
    ...scopedParams,
    thresholdDays: unpaidThresholdDays,
    minAmount,
    limit: 1000,
  });

  const confirmTrigger = useConfirmBillingTrigger();
  const rejectTrigger = useRejectBillingTrigger();
  const updateTriggerActionItem = useUpdateTriggerActionItem();
  const isMutating = confirmTrigger.isPending || rejectTrigger.isPending || updateTriggerActionItem.isPending;

  const loadError =
    financeSummaryQuery.error ||
    pipelineInsightsQuery.error ||
    triggersQuery.error ||
    longStopQuery.error ||
    unpaidQuery.error;
  const isLoading =
    financeSummaryQuery.isLoading ||
    pipelineInsightsQuery.isLoading ||
    triggersQuery.isLoading ||
    longStopQuery.isLoading ||
    unpaidQuery.isLoading;

  const triggerRows = useMemo(() => triggersQuery.data ?? [], [triggersQuery.data]);
  const longStopRows = useMemo(() => longStopQuery.data ?? [], [longStopQuery.data]);
  const unpaidRows = useMemo(() => unpaidQuery.data ?? [], [unpaidQuery.data]);

  const attorneyOptions = useMemo(() => {
    const map = new Map<number, { staffId: number; attorneyName: string; attorneyPosition: string | null }>();

    for (const row of financeSummaryQuery.data?.byAttorney ?? []) {
      map.set(row.staffId, {
        staffId: row.staffId,
        attorneyName: row.attorneyName,
        attorneyPosition: row.attorneyPosition,
      });
    }

    for (const row of longStopRows) {
      if (!map.has(row.staffId)) {
        map.set(row.staffId, {
          staffId: row.staffId,
          attorneyName: row.attorneyName,
          attorneyPosition: row.attorneyPosition,
        });
      }
    }

    for (const row of unpaidRows) {
      if (!map.has(row.staffId)) {
        map.set(row.staffId, {
          staffId: row.staffId,
          attorneyName: row.attorneyName,
          attorneyPosition: row.attorneyPosition,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.attorneyName.localeCompare(b.attorneyName));
  }, [financeSummaryQuery.data?.byAttorney, longStopRows, unpaidRows]);

  const filteredTriggers = useMemo(() => {
    const normalizedSearch = triggerSearch.trim().toLowerCase();
    return triggerRows.filter((row) => {
      const amount = toNumber(row.milestone?.amountValue);
      if (minAmount !== undefined && amount < minAmount) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        row.project?.name,
        row.milestone?.title,
        row.triggerReason,
        row.actionItem?.description,
        row.actionItem?.actionType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [triggerRows, triggerSearch, minAmount]);

  const invoiceReviewQueue = useMemo(() => {
    return filteredTriggers.filter((row) => row.status === 'pending');
  }, [filteredTriggers]);

  const invoiceReadyQueue = useMemo(() => {
    return filteredTriggers.filter((row) => {
      if (row.status !== 'confirmed') return false;

      const actionType = (row.actionItem?.actionType || row.actionTaken || '').toLowerCase();
      const actionStatus = (row.actionItem?.status || 'pending').toLowerCase();
      const shouldIssueInvoice = actionType === 'issue_invoice' || (actionType === '' && !row.actionItem);

      return shouldIssueInvoice && actionStatus !== 'completed';
    });
  }, [filteredTriggers]);

  const invoiceQueueRows = useMemo<InvoiceQueueRow[]>(() => {
    const reviewRows = invoiceReviewQueue.map((trigger) => ({
      stage: 'needs_confirmation' as const,
      trigger,
    }));
    const readyRows = invoiceReadyQueue.map((trigger) => ({
      stage: 'ready_to_invoice' as const,
      trigger,
    }));
    return [...reviewRows, ...readyRows];
  }, [invoiceReviewQueue, invoiceReadyQueue]);

  const overdueUnpaidAmount = useMemo(
    () => unpaidRows.reduce((sum, row) => sum + toNumber(row.milestoneAmount), 0),
    [unpaidRows]
  );
  const longStopPastDueCount = useMemo(
    () => longStopRows.filter((row) => row.daysToLongStop < 0).length,
    [longStopRows]
  );
  const unpaid60Count = useMemo(
    () => unpaidRows.filter((row) => row.daysSinceInvoice >= 60).length,
    [unpaidRows]
  );
  const invoicableFromPipeline = useMemo(() => {
    const pipeline = pipelineInsightsQuery.data;
    if (!pipeline) return 0;
    if (!attorneyFilter) return toNumber(pipeline.totals.invoicableAmount);

    const attorneyView = pipeline.byAttorney.find((row) => row.staffId === attorneyFilter);
    return toNumber(attorneyView?.invoicableAmount);
  }, [pipelineInsightsQuery.data, attorneyFilter]);

  const handleConfirmAndInvoice = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue) return;

    if (trigger.status === 'pending') {
      await confirmTrigger.mutateAsync(trigger.id);
    }

    await updateTriggerActionItem.mutateAsync({
      id: trigger.id,
      data: {
        actionType: 'issue_invoice',
        description: 'Issue invoice for confirmed milestone trigger',
        dueDate: plusDaysYmd(3),
        status: 'pending',
      },
    });
  };

  const handleReject = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue) return;
    if (trigger.status !== 'pending') return;
    await rejectTrigger.mutateAsync(trigger.id);
  };

  const handleMarkInvoiceSent = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue) return;
    await updateTriggerActionItem.mutateAsync({
      id: trigger.id,
      data: {
        actionType: 'issue_invoice',
        status: 'completed',
      },
    });
  };

  const handleMoveToFollowUp = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue) return;
    await updateTriggerActionItem.mutateAsync({
      id: trigger.id,
      data: {
        actionType: 'follow_up_payment',
        status: 'pending',
        dueDate: plusDaysYmd(7),
      },
    });
  };

  const summary = financeSummaryQuery.data?.totals ?? {
    billingUsd: 0,
    collectionUsd: 0,
    ubtUsd: 0,
    projectCount: 0,
  };

  return (
    <Page>
      <PageHeader
        title="Billing Control Tower"
        subtitle="Finance operating console: issue invoices on milestone completion, prevent long-stop lapses, and escalate overdue receivables."
      />

      {!canOperateQueue ? (
        <Section>
          <Alert severity="warning">Only administrators can access billing control tower operations.</Alert>
        </Section>
      ) : null}

      <Section>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField
            select
            label="B&C Attorney"
            value={attorneyFilter ?? ''}
            onChange={(e) => setAttorneyFilter(e.target.value ? Number(e.target.value) : undefined)}
            size="small"
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">All Attorneys</MenuItem>
            {attorneyOptions.map((attorney) => (
              <MenuItem key={attorney.staffId} value={attorney.staffId}>
                {attorney.attorneyName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Min Amount (USD)"
            type="number"
            value={minAmount ?? ''}
            onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : undefined)}
            size="small"
            sx={{ minWidth: 170 }}
          />

          <TextField
            label="LSD Window (days)"
            type="number"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value) || 30)}
            size="small"
            sx={{ minWidth: 160 }}
          />

          <TextField
            label="Unpaid Threshold"
            type="number"
            value={unpaidThresholdDays}
            onChange={(e) => setUnpaidThresholdDays(Number(e.target.value) || 30)}
            size="small"
            sx={{ minWidth: 160 }}
            helperText="days"
          />

          <TextField
            label="Search Trigger Queue"
            value={triggerSearch}
            onChange={(e) => setTriggerSearch(e.target.value)}
            placeholder="Project, milestone, reason"
            size="small"
            sx={{ minWidth: 250 }}
          />
        </Stack>
      </Section>

      {isLoading ? (
        <Section>
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        </Section>
      ) : loadError ? (
        <Section>
          <Alert severity="error">{getErrorMessage(loadError)}</Alert>
        </Section>
      ) : (
        <>
          <Section>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
              <MetricCard
                label="Total Billing"
                value={currencyFormatter.format(toNumber(summary.billingUsd))}
                helper={`${summary.projectCount} projects in scope`}
                tone="neutral"
              />
              <MetricCard
                label="Total Collected"
                value={currencyFormatter.format(toNumber(summary.collectionUsd))}
                helper="Recorded collections"
                tone="positive"
              />
              <MetricCard
                label="UBT"
                value={currencyFormatter.format(toNumber(summary.ubtUsd))}
                helper="Unbilled time/value exposure"
                tone="warning"
              />
              <MetricCard
                label="Invoicable Now"
                value={currencyFormatter.format(invoicableFromPipeline)}
                helper={`${invoiceQueueRows.length} trigger rows requiring action`}
                tone="positive"
              />
              <MetricCard
                label={`Unpaid ${unpaidThresholdDays}+ Days`}
                value={currencyFormatter.format(overdueUnpaidAmount)}
                helper={`${unpaidRows.length} invoices pending payment`}
                tone="danger"
              />
              <MetricCard
                label={`Long Stop Risk (${windowDays}d)`}
                value={String(longStopRows.length)}
                helper={`${longStopPastDueCount} already past due`}
                tone={longStopPastDueCount > 0 ? 'danger' : 'warning'}
              />
            </Stack>
          </Section>

          <Section>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <MetricCard
                label="Management Alert: LSD Past Due"
                value={String(longStopPastDueCount)}
                helper="Renew engagement immediately"
                tone={longStopPastDueCount > 0 ? 'danger' : 'neutral'}
              />
              <MetricCard
                label="Management Alert: Unpaid 60+"
                value={String(unpaid60Count)}
                helper="Requires escalation cadence"
                tone={unpaid60Count > 0 ? 'danger' : 'neutral'}
              />
              <MetricCard
                label="Finance Backlog"
                value={String(invoiceQueueRows.length)}
                helper="Milestones pending invoice action"
                tone={invoiceQueueRows.length > 0 ? 'warning' : 'neutral'}
              />
            </Stack>
          </Section>

          <Section>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              1) Milestone Reached to Invoice Now Queue
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Stage</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell>Milestone</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell align="right">Confidence</TableCell>
                    <TableCell>Action Due</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoiceQueueRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No invoice queue items for selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoiceQueueRows.map(({ stage, trigger }) => (
                      <TableRow key={`${stage}-${trigger.id}`} hover>
                        <TableCell>
                          <Chip
                            size="small"
                            color={stage === 'needs_confirmation' ? 'warning' : 'success'}
                            label={stage === 'needs_confirmation' ? 'Needs Confirmation' : 'Ready To Invoice'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{trigger.project?.name || '—'}</TableCell>
                        <TableCell>{trigger.milestone?.title || '—'}</TableCell>
                        <TableCell align="right">{currencyFormatter.format(toNumber(trigger.milestone?.amountValue))}</TableCell>
                        <TableCell>{trigger.triggerReason || '—'}</TableCell>
                        <TableCell align="right">{(toNumber(trigger.matchConfidence) * 100).toFixed(0)}%</TableCell>
                        <TableCell>{formatDate(trigger.actionItem?.dueDate)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                            {stage === 'needs_confirmation' ? (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleConfirmAndInvoice(trigger)}
                                  disabled={!canOperateQueue || isMutating}
                                >
                                  Confirm + Queue Invoice
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleReject(trigger)}
                                  disabled={!canOperateQueue || isMutating}
                                >
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="success"
                                  onClick={() => handleMarkInvoiceSent(trigger)}
                                  disabled={!canOperateQueue || isMutating}
                                >
                                  Mark Invoice Sent
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleMoveToFollowUp(trigger)}
                                  disabled={!canOperateQueue || isMutating}
                                >
                                  Move to Follow-up
                                </Button>
                              </>
                            )}
                            {trigger.staffingProjectId ? (
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => navigate(`/projects/${trigger.staffingProjectId}`)}
                              >
                                Open Project
                              </Button>
                            ) : null}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>

          <Section>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              2) Engagement Long Stop Date Risk
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Risk</TableCell>
                    <TableCell>B&C Attorney</TableCell>
                    <TableCell>Billing Matter</TableCell>
                    <TableCell>Long Stop Date</TableCell>
                    <TableCell align="right">Days To/Past</TableCell>
                    <TableCell align="right">UBT</TableCell>
                    <TableCell align="right">Collected</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {longStopRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No long-stop risks found for selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    longStopRows.map((row) => {
                      const risk = getLongStopRiskChip(row);
                      return (
                        <TableRow key={`${row.billingProjectId}-${row.staffId}-${row.lsdDate}`} hover>
                          <TableCell>
                            <Chip size="small" label={risk.label} color={risk.color} variant="outlined" />
                          </TableCell>
                          <TableCell>{row.attorneyName}</TableCell>
                          <TableCell>{row.billingProjectName}</TableCell>
                          <TableCell>{formatDate(row.lsdDate)}</TableCell>
                          <TableCell align="right">{row.daysToLongStop}</TableCell>
                          <TableCell align="right">{currencyFormatter.format(toNumber(row.ubtUsd))}</TableCell>
                          <TableCell align="right">{currencyFormatter.format(toNumber(row.collectionUsd))}</TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="text" onClick={() => navigate(`/billing/${row.billingProjectId}`)}>
                              Open Matter
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>

          <Section>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              3) Unpaid Invoices ({unpaidThresholdDays}+ Days)
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Aging</TableCell>
                    <TableCell>B&C Attorney</TableCell>
                    <TableCell>Billing Matter</TableCell>
                    <TableCell>Milestone</TableCell>
                    <TableCell>Invoice Sent</TableCell>
                    <TableCell align="right">Days Outstanding</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unpaidRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No unpaid invoice alerts for selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    unpaidRows.map((row) => {
                      const aging = getAgingChip(row.daysSinceInvoice);
                      return (
                        <TableRow key={`${row.milestoneId}-${row.staffId}-${row.invoiceSentDate}`} hover>
                          <TableCell>
                            <Chip size="small" label={aging.label} color={aging.color} variant="outlined" />
                          </TableCell>
                          <TableCell>{row.attorneyName}</TableCell>
                          <TableCell>{row.billingProjectName}</TableCell>
                          <TableCell>{row.milestoneTitle || '—'}</TableCell>
                          <TableCell>{formatDate(row.invoiceSentDate)}</TableCell>
                          <TableCell align="right">{row.daysSinceInvoice}</TableCell>
                          <TableCell align="right">{currencyFormatter.format(toNumber(row.milestoneAmount))}</TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="text" onClick={() => navigate(`/billing/${row.billingProjectId}`)}>
                              Open Matter
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>
        </>
      )}
    </Page>
  );
};

export default BillingControlTower;
