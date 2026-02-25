import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
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
import { useAuth } from '../hooks/useAuth';
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
  );
}

function renderUnpaidInvoicesTable(
  unpaidRows: BillingUnpaidInvoiceRow[],
  navigate: (path: string) => void,
) {
  return (
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
  );
}

function renderLongStopRiskTable(
  longStopRows: BillingLongStopRiskRow[],
  navigate: (path: string) => void,
) {
  return (
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
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BillingControlTower: React.FC = () => {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { user } = useAuth();
  const canOperateQueue = permissions.isAdmin;
  const myStaffId = user?.staff?.id;

  // Non-admin users see only "My Projects" tab (index 0); admins see all 3 tabs
  const [activeTab, setActiveTab] = useState(0);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showLongStopRisks, setShowLongStopRisks] = useState(false);
  const [showTriggerQueue, setShowTriggerQueue] = useState(false);
  const [showUnpaidInvoices, setShowUnpaidInvoices] = useState(false);

  // Admin data hooks — called unconditionally (React rules of hooks)
  const metricsQuery = useTimeWindowedMetrics();
  const triggersQuery = useBillingTriggers();
  const longStopQuery = useLongStopRisks({ windowDays: 90, limit: 1000 });
  const unpaidQuery = useUnpaidInvoices({ thresholdDays: 30, limit: 1000 });

  // B&C Attorney View — filtered to current user's projects
  const myTriggersQuery = useBillingTriggers(myStaffId ? { attorneyId: myStaffId } : undefined);
  const myLongStopQuery = useLongStopRisks(myStaffId ? { attorneyId: myStaffId, windowDays: 90, limit: 1000 } : undefined);
  const myUnpaidQuery = useUnpaidInvoices(myStaffId ? { attorneyId: myStaffId, thresholdDays: 30, limit: 1000 } : undefined);

  // Mutations (Finance View only)
  const confirmTrigger = useConfirmBillingTrigger();
  const rejectTrigger = useRejectBillingTrigger();
  const updateTriggerActionItem = useUpdateTriggerActionItem();
  const isMutating = confirmTrigger.isPending || rejectTrigger.isPending || updateTriggerActionItem.isPending;

  const adminDataLoading = metricsQuery.isLoading || triggersQuery.isLoading || longStopQuery.isLoading || unpaidQuery.isLoading;
  const myDataLoading = myStaffId ? (myTriggersQuery.isLoading || myLongStopQuery.isLoading || myUnpaidQuery.isLoading) : false;
  const isLoading = permissions.isAdmin ? (adminDataLoading || myDataLoading) : myDataLoading;

  const adminError = metricsQuery.error || triggersQuery.error || longStopQuery.error || unpaidQuery.error;
  const myError = myTriggersQuery.error || myLongStopQuery.error || myUnpaidQuery.error;
  const loadError = permissions.isAdmin ? (adminError || myError) : myError;

  const triggerRows = useMemo(() => triggersQuery.data ?? [], [triggersQuery.data]);
  const longStopRows = useMemo(() => longStopQuery.data ?? [], [longStopQuery.data]);
  const unpaidRows = useMemo(() => unpaidQuery.data ?? [], [unpaidQuery.data]);

  const myTriggerRows = useMemo(() => myTriggersQuery.data ?? [], [myTriggersQuery.data]);
  const myLongStopRows = useMemo(() => myLongStopQuery.data ?? [], [myLongStopQuery.data]);
  const myUnpaidRows = useMemo(() => myUnpaidQuery.data ?? [], [myUnpaidQuery.data]);

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

  // Build invoice queue from attorney's triggers (for B&C Attorney View)
  const myInvoiceQueueRows = useMemo<InvoiceQueueRow[]>(() => {
    const review = myTriggerRows
      .filter((r) => r.status === 'pending')
      .map((trigger) => ({ stage: 'needs_confirmation' as const, trigger }));

    const ready = myTriggerRows
      .filter((r) => {
        if (r.status !== 'confirmed') return false;
        const actionType = (r.actionItem?.actionType || r.actionTaken || '').toLowerCase();
        const actionStatus = (r.actionItem?.status || 'pending').toLowerCase();
        const shouldIssueInvoice = actionType === 'issue_invoice' || (actionType === '' && !r.actionItem);
        return shouldIssueInvoice && actionStatus !== 'completed';
      })
      .map((trigger) => ({ stage: 'ready_to_invoice' as const, trigger }));

    return [...review, ...ready];
  }, [myTriggerRows]);

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

  // Collapsible state for the attorney view (separate from admin views)
  const [showMyTriggerQueue, setShowMyTriggerQueue] = useState(false);
  const [showMyUnpaidInvoices, setShowMyUnpaidInvoices] = useState(false);

  return (
    <Page>
      <PageHeader title="Billing Control Tower" />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          {permissions.isAdmin && <Tab label="Finance View" />}
          {permissions.isAdmin && <Tab label="Management View" />}
          <Tab label="My Projects" />
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
          {/* Finance View (admin only) */}
          {permissions.isAdmin && activeTab === 0 && (
            <>
              <Section>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setShowMetrics(!showMetrics)}
                >
                  <IconButton size="small">
                    {showMetrics ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Billing & Collections Activity
                  </Typography>
                </Stack>
                <Collapse in={showMetrics}>
                  <Box sx={{ mt: 1 }}>
                    {metricsQuery.data && (
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                        <MetricCard label="Billed (30d)" value={currencyFormatter.format(metricsQuery.data.billed30d)} tone="neutral" />
                        <MetricCard label="Billed (60d)" value={currencyFormatter.format(metricsQuery.data.billed60d)} tone="neutral" />
                        <MetricCard label="Billed (90d)" value={currencyFormatter.format(metricsQuery.data.billed90d)} tone="neutral" />
                        <MetricCard label="Collected (30d)" value={currencyFormatter.format(metricsQuery.data.collected30d)} tone="positive" />
                        <MetricCard label="Collected (60d)" value={currencyFormatter.format(metricsQuery.data.collected60d)} tone="positive" />
                        <MetricCard label="Collected (90d)" value={currencyFormatter.format(metricsQuery.data.collected90d)} tone="positive" />
                      </Stack>
                    )}
                  </Box>
                </Collapse>
              </Section>
              <Section>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setShowTriggerQueue(!showTriggerQueue)}
                >
                  <IconButton size="small">
                    {showTriggerQueue ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Milestones Triggered — Invoice Queue
                  </Typography>
                  <Chip size="small" label={`${invoiceQueueRows.length}`} color={invoiceQueueRows.length > 0 ? 'warning' : 'default'} />
                </Stack>
                <Collapse in={showTriggerQueue}>
                  <Box sx={{ mt: 1 }}>
                    {renderTriggerQueueTable(invoiceQueueRows, triggerActions)}
                  </Box>
                </Collapse>
              </Section>
              <Section>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setShowUnpaidInvoices(!showUnpaidInvoices)}
                >
                  <IconButton size="small">
                    {showUnpaidInvoices ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Unpaid Invoices 30+ Days
                  </Typography>
                  <Chip size="small" label={`${unpaidRows.length}`} color={unpaidRows.length > 0 ? 'error' : 'default'} />
                </Stack>
                <Collapse in={showUnpaidInvoices}>
                  <Box sx={{ mt: 1 }}>
                    {renderUnpaidInvoicesTable(unpaidRows, navigate)}
                  </Box>
                </Collapse>
              </Section>
            </>
          )}

          {/* Management View (admin only) */}
          {permissions.isAdmin && activeTab === 1 && (
            <>
              <Section>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setShowMetrics(!showMetrics)}
                >
                  <IconButton size="small">
                    {showMetrics ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Billing & Collections Activity
                  </Typography>
                </Stack>
                <Collapse in={showMetrics}>
                  <Box sx={{ mt: 1 }}>
                    {metricsQuery.data && (
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                        <MetricCard label="Billed (30d)" value={currencyFormatter.format(metricsQuery.data.billed30d)} tone="neutral" />
                        <MetricCard label="Billed (60d)" value={currencyFormatter.format(metricsQuery.data.billed60d)} tone="neutral" />
                        <MetricCard label="Billed (90d)" value={currencyFormatter.format(metricsQuery.data.billed90d)} tone="neutral" />
                        <MetricCard label="Collected (30d)" value={currencyFormatter.format(metricsQuery.data.collected30d)} tone="positive" />
                        <MetricCard label="Collected (60d)" value={currencyFormatter.format(metricsQuery.data.collected60d)} tone="positive" />
                        <MetricCard label="Collected (90d)" value={currencyFormatter.format(metricsQuery.data.collected90d)} tone="positive" />
                      </Stack>
                    )}
                  </Box>
                </Collapse>
              </Section>
              <Section>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setShowLongStopRisks(!showLongStopRisks)}
                >
                  <IconButton size="small">
                    {showLongStopRisks ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Projects Past Long Stop Date
                  </Typography>
                  {(() => {
                    const pastDueCount = longStopRows.filter((r) => r.daysToLongStop < 0).length;
                    return (
                      <>
                        <Chip size="small" label={`${pastDueCount} past due`} color={pastDueCount > 0 ? 'error' : 'default'} />
                        <Chip size="small" label={`${longStopRows.length} at risk`} color={longStopRows.length > 0 ? 'warning' : 'default'} />
                      </>
                    );
                  })()}
                </Stack>
                <Collapse in={showLongStopRisks}>
                  <Box sx={{ mt: 1 }}>
                    {renderLongStopRiskTable(longStopRows, navigate)}
                  </Box>
                </Collapse>
              </Section>
              <Section>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setShowTriggerQueue(!showTriggerQueue)}
                >
                  <IconButton size="small">
                    {showTriggerQueue ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Milestones Triggered — Invoice Queue
                  </Typography>
                  <Chip size="small" label={`${invoiceQueueRows.length}`} color={invoiceQueueRows.length > 0 ? 'warning' : 'default'} />
                </Stack>
                <Collapse in={showTriggerQueue}>
                  <Box sx={{ mt: 1 }}>
                    {renderTriggerQueueTable(invoiceQueueRows, { ...triggerActions, readOnly: true })}
                  </Box>
                </Collapse>
              </Section>
              <Section>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setShowUnpaidInvoices(!showUnpaidInvoices)}
                >
                  <IconButton size="small">
                    {showUnpaidInvoices ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  </IconButton>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Unpaid Invoices 30+ Days
                  </Typography>
                  <Chip size="small" label={`${unpaidRows.length}`} color={unpaidRows.length > 0 ? 'error' : 'default'} />
                </Stack>
                <Collapse in={showUnpaidInvoices}>
                  <Box sx={{ mt: 1 }}>
                    {renderUnpaidInvoicesTable(unpaidRows, navigate)}
                  </Box>
                </Collapse>
              </Section>
            </>
          )}

          {/* B&C Attorney View — My Projects */}
          {activeTab === (permissions.isAdmin ? 2 : 0) && (
            <>
              {!myStaffId ? (
                <Section>
                  <Alert severity="info">Your user account is not linked to a staff profile. Contact an administrator to link your account.</Alert>
                </Section>
              ) : (
                <>
                  <Section>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setShowLongStopRisks(!showLongStopRisks)}
                    >
                      <IconButton size="small">
                        {showLongStopRisks ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Projects Past Long Stop Date
                      </Typography>
                      {(() => {
                        const pastDueCount = myLongStopRows.filter((r) => r.daysToLongStop < 0).length;
                        return (
                          <>
                            <Chip size="small" label={`${pastDueCount} past due`} color={pastDueCount > 0 ? 'error' : 'default'} />
                            <Chip size="small" label={`${myLongStopRows.length} at risk`} color={myLongStopRows.length > 0 ? 'warning' : 'default'} />
                          </>
                        );
                      })()}
                    </Stack>
                    <Collapse in={showLongStopRisks}>
                      <Box sx={{ mt: 1 }}>
                        {renderLongStopRiskTable(myLongStopRows, navigate)}
                      </Box>
                    </Collapse>
                  </Section>
                  <Section>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setShowMyTriggerQueue(!showMyTriggerQueue)}
                    >
                      <IconButton size="small">
                        {showMyTriggerQueue ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Milestones Triggered — Invoice Queue
                      </Typography>
                      <Chip size="small" label={`${myInvoiceQueueRows.length}`} color={myInvoiceQueueRows.length > 0 ? 'warning' : 'default'} />
                    </Stack>
                    <Collapse in={showMyTriggerQueue}>
                      <Box sx={{ mt: 1 }}>
                        {renderTriggerQueueTable(myInvoiceQueueRows, { ...triggerActions, readOnly: true })}
                      </Box>
                    </Collapse>
                  </Section>
                  <Section>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setShowMyUnpaidInvoices(!showMyUnpaidInvoices)}
                    >
                      <IconButton size="small">
                        {showMyUnpaidInvoices ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Unpaid Invoices 30+ Days
                      </Typography>
                      <Chip size="small" label={`${myUnpaidRows.length}`} color={myUnpaidRows.length > 0 ? 'error' : 'default'} />
                    </Stack>
                    <Collapse in={showMyUnpaidInvoices}>
                      <Box sx={{ mt: 1 }}>
                        {renderUnpaidInvoicesTable(myUnpaidRows, navigate)}
                      </Box>
                    </Collapse>
                  </Section>
                </>
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
};

export default BillingControlTower;
