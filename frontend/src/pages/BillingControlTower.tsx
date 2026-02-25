import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader, Section } from '../components/ui';
import {
  useBillingTriggers,
  useConfirmBillingTrigger,
  useLongStopRisks,
  useRejectBillingTrigger,
  useUnpaidInvoices,
  useUpdateTriggerActionItem,
  useTimeWindowedMetrics,
} from '../hooks/useBilling';
import { usePermissions } from '../hooks/usePermissions';
import type {
  BillingLongStopRiskRow,
  BillingTriggerRow,
  BillingUnpaidInvoiceRow,
  BillingTimeWindowMetrics,
} from '../api/billing';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

type MetricTone = 'neutral' | 'positive' | 'warning' | 'danger';
type InvoiceQueueStage = 'needs_confirmation' | 'ready_to_invoice';

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
  neutral: { borderColor: 'divider', backgroundColor: 'background.paper' },
  positive: { borderColor: 'success.light', backgroundColor: 'success.50' },
  warning: { borderColor: 'warning.light', backgroundColor: 'warning.50' },
  danger: { borderColor: 'error.light', backgroundColor: 'error.50' },
};

const toNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '—');

const plusDaysYmd = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const getErrorMessage = (error: unknown) => {
  if (isAxiosError<{ error?: string }>(error)) return error.response?.data?.error || error.message;
  if (error instanceof Error) return error.message;
  return 'Failed to load billing control tower data';
};

const getLongStopRiskChip = (row: BillingLongStopRiskRow) => {
  if (row.riskLevel === 'past_due' || row.daysToLongStop < 0) return { label: `${Math.abs(row.daysToLongStop)}d past`, color: 'error' as const };
  if (row.riskLevel === 'due_14') return { label: `${row.daysToLongStop}d left`, color: 'warning' as const };
  if (row.riskLevel === 'due_30') return { label: `${row.daysToLongStop}d left`, color: 'info' as const };
  return { label: `${row.daysToLongStop}d left`, color: 'default' as const };
};

const getAgingChip = (days: number) => {
  if (days >= 90) return { label: `${days}d`, color: 'error' as const };
  if (days >= 60) return { label: `${days}d`, color: 'warning' as const };
  if (days >= 30) return { label: `${days}d`, color: 'info' as const };
  return { label: `${days}d`, color: 'default' as const };
};

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------

const MetricCard: React.FC<{ label: string; value: string; helper?: string; tone?: MetricTone }> = ({
  label,
  value,
  helper,
  tone = 'neutral',
}) => (
  <Paper
    variant="outlined"
    sx={{ p: 2, flex: 1, minWidth: 170, borderColor: toneStyles[tone].borderColor, bgcolor: toneStyles[tone].backgroundColor }}
  >
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h6" sx={{ fontWeight: 700 }}>{value}</Typography>
    {helper ? <Typography variant="caption" color="text.secondary">{helper}</Typography> : null}
  </Paper>
);

// ---------------------------------------------------------------------------
// Shared renderers
// ---------------------------------------------------------------------------

function renderTimeWindowMetrics(metrics: BillingTimeWindowMetrics | undefined) {
  if (!metrics) return null;
  return (
    <Section>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Billing & Collections Activity</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
        <MetricCard label="Billed (30d)" value={currencyFormatter.format(metrics.billed30d)} tone="neutral" />
        <MetricCard label="Billed (60d)" value={currencyFormatter.format(metrics.billed60d)} tone="neutral" />
        <MetricCard label="Billed (90d)" value={currencyFormatter.format(metrics.billed90d)} tone="neutral" />
        <MetricCard label="Collected (30d)" value={currencyFormatter.format(metrics.collected30d)} tone="positive" />
        <MetricCard label="Collected (60d)" value={currencyFormatter.format(metrics.collected60d)} tone="positive" />
        <MetricCard label="Collected (90d)" value={currencyFormatter.format(metrics.collected90d)} tone="positive" />
      </Stack>
    </Section>
  );
}

function renderTriggerQueueTable(
  invoiceQueueRows: InvoiceQueueRow[],
  options: {
    readOnly: boolean;
    canOperate: boolean;
    isMutating: boolean;
    navigate: (path: string) => void;
    onConfirm: (t: BillingTriggerRow) => void;
    onReject: (t: BillingTriggerRow) => void;
    onMarkSent: (t: BillingTriggerRow) => void;
    onFollowUp: (t: BillingTriggerRow) => void;
  },
) {
  return (
    <Section>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Milestones Triggered — Invoice Queue ({invoiceQueueRows.length})
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
              {!options.readOnly && <TableCell align="right">Actions</TableCell>}
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {invoiceQueueRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={options.readOnly ? 7 : 8} align="center">
                  No invoice queue items
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
                  {!options.readOnly && (
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                        {stage === 'needs_confirmation' ? (
                          <>
                            <Button size="small" variant="contained" onClick={() => options.onConfirm(trigger)} disabled={!options.canOperate || options.isMutating}>
                              Confirm + Queue Invoice
                            </Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => options.onReject(trigger)} disabled={!options.canOperate || options.isMutating}>
                              Reject
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="small" variant="outlined" color="success" onClick={() => options.onMarkSent(trigger)} disabled={!options.canOperate || options.isMutating}>
                              Mark Invoice Sent
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => options.onFollowUp(trigger)} disabled={!options.canOperate || options.isMutating}>
                              Move to Follow-up
                            </Button>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  )}
                  <TableCell align="right">
                    {trigger.billingProjectId ? (
                      <Button size="small" variant="text" onClick={() => options.navigate(`/billing/${trigger.billingProjectId}`)}>
                        Open
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Section>
  );
}

function renderUnpaidInvoicesTable(
  unpaidRows: BillingUnpaidInvoiceRow[],
  navigate: (path: string) => void,
) {
  return (
    <Section>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Unpaid Invoices 30+ Days ({unpaidRows.length})
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
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {unpaidRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">No unpaid invoices over 30 days</TableCell>
              </TableRow>
            ) : (
              unpaidRows.map((row) => {
                const aging = getAgingChip(row.daysSinceInvoice);
                return (
                  <TableRow key={`${row.milestoneId}-${row.staffId}-${row.invoiceSentDate}`} hover>
                    <TableCell><Chip size="small" label={aging.label} color={aging.color} variant="outlined" /></TableCell>
                    <TableCell>{row.attorneyName}</TableCell>
                    <TableCell>{row.billingProjectName}</TableCell>
                    <TableCell>{row.milestoneTitle || '—'}</TableCell>
                    <TableCell>{formatDate(row.invoiceSentDate)}</TableCell>
                    <TableCell align="right">{row.daysSinceInvoice}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(toNumber(row.milestoneAmount))}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="text" onClick={() => navigate(`/billing/${row.billingProjectId}`)}>
                        Open
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
  );
}

function renderLongStopRiskTable(
  longStopRows: BillingLongStopRiskRow[],
  navigate: (path: string) => void,
) {
  const pastDueCount = longStopRows.filter((r) => r.daysToLongStop < 0).length;
  return (
    <Section>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Projects Past Long Stop Date ({pastDueCount} past due / {longStopRows.length} at risk)
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
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {longStopRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">No long-stop date risks</TableCell>
              </TableRow>
            ) : (
              longStopRows.map((row) => {
                const risk = getLongStopRiskChip(row);
                return (
                  <TableRow key={`${row.billingProjectId}-${row.staffId}-${row.lsdDate}`} hover>
                    <TableCell><Chip size="small" label={risk.label} color={risk.color} variant="outlined" /></TableCell>
                    <TableCell>{row.attorneyName}</TableCell>
                    <TableCell>{row.billingProjectName}</TableCell>
                    <TableCell>{formatDate(row.lsdDate)}</TableCell>
                    <TableCell align="right">{row.daysToLongStop}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(toNumber(row.ubtUsd))}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(toNumber(row.collectionUsd))}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="text" onClick={() => navigate(`/billing/${row.billingProjectId}`)}>
                        Open
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
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BillingControlTower: React.FC = () => {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const canOperateQueue = permissions.isAdmin;
  const [activeTab, setActiveTab] = useState(0);

  // Data hooks — called unconditionally so both tabs share data
  const metricsQuery = useTimeWindowedMetrics();
  const triggersQuery = useBillingTriggers();
  const longStopQuery = useLongStopRisks({ windowDays: 90, limit: 1000 });
  const unpaidQuery = useUnpaidInvoices({ thresholdDays: 30, limit: 1000 });

  // Mutations (Finance View only)
  const confirmTrigger = useConfirmBillingTrigger();
  const rejectTrigger = useRejectBillingTrigger();
  const updateTriggerActionItem = useUpdateTriggerActionItem();
  const isMutating = confirmTrigger.isPending || rejectTrigger.isPending || updateTriggerActionItem.isPending;

  const isLoading = metricsQuery.isLoading || triggersQuery.isLoading || longStopQuery.isLoading || unpaidQuery.isLoading;
  const loadError = metricsQuery.error || triggersQuery.error || longStopQuery.error || unpaidQuery.error;

  const triggerRows = useMemo(() => triggersQuery.data ?? [], [triggersQuery.data]);
  const longStopRows = useMemo(() => longStopQuery.data ?? [], [longStopQuery.data]);
  const unpaidRows = useMemo(() => unpaidQuery.data ?? [], [unpaidQuery.data]);

  // Build invoice queue from triggers
  const invoiceQueueRows = useMemo<InvoiceQueueRow[]>(() => {
    const review = triggerRows
      .filter((r) => r.status === 'pending')
      .map((trigger) => ({ stage: 'needs_confirmation' as const, trigger }));

    const ready = triggerRows
      .filter((r) => {
        if (r.status !== 'confirmed') return false;
        const actionType = (r.actionItem?.actionType || r.actionTaken || '').toLowerCase();
        const actionStatus = (r.actionItem?.status || 'pending').toLowerCase();
        const shouldIssueInvoice = actionType === 'issue_invoice' || (actionType === '' && !r.actionItem);
        return shouldIssueInvoice && actionStatus !== 'completed';
      })
      .map((trigger) => ({ stage: 'ready_to_invoice' as const, trigger }));

    return [...review, ...ready];
  }, [triggerRows]);

  // Action handlers
  const handleConfirmAndInvoice = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue) return;
    if (trigger.status === 'pending') await confirmTrigger.mutateAsync(trigger.id);
    await updateTriggerActionItem.mutateAsync({
      id: trigger.id,
      data: { actionType: 'issue_invoice', description: 'Issue invoice for confirmed milestone trigger', dueDate: plusDaysYmd(3), status: 'pending' },
    });
  };

  const handleReject = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue || trigger.status !== 'pending') return;
    await rejectTrigger.mutateAsync(trigger.id);
  };

  const handleMarkInvoiceSent = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue) return;
    await updateTriggerActionItem.mutateAsync({ id: trigger.id, data: { actionType: 'issue_invoice', status: 'completed' } });
  };

  const handleMoveToFollowUp = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue) return;
    await updateTriggerActionItem.mutateAsync({ id: trigger.id, data: { actionType: 'follow_up_payment', status: 'pending', dueDate: plusDaysYmd(7) } });
  };

  const triggerActions = {
    readOnly: false,
    canOperate: canOperateQueue,
    isMutating,
    navigate,
    onConfirm: handleConfirmAndInvoice,
    onReject: handleReject,
    onMarkSent: handleMarkInvoiceSent,
    onFollowUp: handleMoveToFollowUp,
  };

  return (
    <Page>
      <PageHeader title="Billing Control Tower" />

      {!canOperateQueue && (
        <Section>
          <Alert severity="warning">Only administrators can access billing control tower operations.</Alert>
        </Section>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Finance View" />
          <Tab label="Management View" />
        </Tabs>
      </Box>

      {isLoading ? (
        <Section>
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        </Section>
      ) : loadError ? (
        <Section>
          <Alert severity="error">{getErrorMessage(loadError)}</Alert>
        </Section>
      ) : (
        <>
          {/* Finance View */}
          {activeTab === 0 && (
            <>
              {renderTimeWindowMetrics(metricsQuery.data)}
              {renderTriggerQueueTable(invoiceQueueRows, triggerActions)}
              {renderUnpaidInvoicesTable(unpaidRows, navigate)}
            </>
          )}

          {/* Management View */}
          {activeTab === 1 && (
            <>
              {renderTimeWindowMetrics(metricsQuery.data)}
              {renderLongStopRiskTable(longStopRows, navigate)}
              {renderTriggerQueueTable(invoiceQueueRows, { ...triggerActions, readOnly: true })}
              {renderUnpaidInvoicesTable(unpaidRows, navigate)}
            </>
          )}
        </>
      )}
    </Page>
  );
};

export default BillingControlTower;
