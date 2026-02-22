import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
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
  TextField,
  Typography,
} from '@mui/material';
import { isAxiosError } from 'axios';
import { Page, PageHeader, Section } from '../components/ui';
import {
  useBillingPipelineInsights,
  useBillingTriggers,
  useConfirmBillingTrigger,
  useOverdueByAttorney,
  useRejectBillingTrigger,
  useUpdateTriggerActionItem,
} from '../hooks/useBilling';
import { usePermissions } from '../hooks/usePermissions';
import type { BillingTriggerRow } from '../api/billing';

type SortField = 'overdueAmount' | 'overdueCount' | 'avgDaysOverdue' | 'projectCount';
type ActionStatus = 'pending' | 'completed' | 'cancelled';
type TowerView = 'manager' | 'captain' | 'finance';
type TriggerFocus = 'all' | 'needs_review' | 'needs_action';
type MetricTone = 'neutral' | 'positive' | 'warning' | 'danger';

interface AttorneySummary {
  staffId: number;
  attorneyName: string;
  attorneyPosition: string | null;
  overdueAmount: number;
  overdueCount: number;
  projectCount: number;
  avgDaysOverdue: number;
  nextDueDate: string | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  helper?: string;
  tone?: MetricTone;
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
      minWidth: 180,
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

const daysOverdue = (dueDate?: string | null) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const now = new Date();
  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '—');
const toInputDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const toYmd = (value: Date) => value.toISOString().slice(0, 10);
const plusDaysYmd = (days: number) => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  return toYmd(dueDate);
};

const formatCode = (value?: string | null) => {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const statusChipColor = (value?: string | null) => {
  if (value === 'pending') return 'warning' as const;
  if (value === 'confirmed') return 'success' as const;
  if (value === 'rejected') return 'default' as const;
  return 'default' as const;
};

const actionStatusChipColor = (value?: string | null) => {
  if (value === 'completed') return 'success' as const;
  if (value === 'pending') return 'warning' as const;
  if (value === 'cancelled') return 'default' as const;
  return 'default' as const;
};

const getRiskChip = (dueDate?: string | null) => {
  const overdue = daysOverdue(dueDate);
  if (overdue >= 60) {
    return { label: `${overdue}d late`, color: 'error' as const };
  }
  if (overdue >= 31) {
    return { label: `${overdue}d late`, color: 'warning' as const };
  }
  if (overdue > 0) {
    return { label: `${overdue}d late`, color: 'info' as const };
  }
  return { label: 'On track', color: 'success' as const };
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

const BillingControlTower: React.FC = () => {
  const permissions = usePermissions();
  const canOperateQueue = permissions.isAdmin;

  const [view, setView] = useState<TowerView>('manager');
  const [attorneyFilter, setAttorneyFilter] = useState<number | undefined>(undefined);
  const [minAmount, setMinAmount] = useState<number | undefined>(undefined);
  const [triggerStatus, setTriggerStatus] = useState<'pending' | 'confirmed' | 'rejected' | 'all'>('all');
  const [triggerFocus, setTriggerFocus] = useState<TriggerFocus>('needs_review');
  const [triggerSearch, setTriggerSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('overdueAmount');

  const [editingTrigger, setEditingTrigger] = useState<BillingTriggerRow | null>(null);
  const [actionTypeInput, setActionTypeInput] = useState('general_followup');
  const [actionStatusInput, setActionStatusInput] = useState<ActionStatus>('pending');
  const [actionDueDateInput, setActionDueDateInput] = useState('');
  const [actionDescriptionInput, setActionDescriptionInput] = useState('');
  const [actionAssignedToInput, setActionAssignedToInput] = useState<number | ''>('');

  const overdueQuery = useOverdueByAttorney({
    attorneyId: attorneyFilter,
    minAmount,
  });

  const triggersQuery = useBillingTriggers({
    ...(triggerStatus === 'all' ? {} : { status: triggerStatus }),
  });
  const pipelineInsightsQuery = useBillingPipelineInsights();

  const confirmTrigger = useConfirmBillingTrigger();
  const rejectTrigger = useRejectBillingTrigger();
  const updateTriggerActionItem = useUpdateTriggerActionItem();

  const overdueRows = overdueQuery.data ?? [];
  const triggerRows = triggersQuery.data ?? [];
  const pipeline = pipelineInsightsQuery.data;

  const isLoading = overdueQuery.isLoading || triggersQuery.isLoading || pipelineInsightsQuery.isLoading;
  const loadError = overdueQuery.error || triggersQuery.error || pipelineInsightsQuery.error;
  const isMutating = confirmTrigger.isPending || rejectTrigger.isPending || updateTriggerActionItem.isPending;

  const attorneyOptions = useMemo(() => {
    const map = new Map<number, { staffId: number; attorneyName: string; attorneyPosition: string | null }>();

    for (const row of overdueRows) {
      if (!map.has(row.staffId)) {
        map.set(row.staffId, {
          staffId: row.staffId,
          attorneyName: row.attorneyName,
          attorneyPosition: row.attorneyPosition,
        });
      }
    }

    for (const row of pipeline?.byAttorney ?? []) {
      if (!map.has(row.staffId)) {
        map.set(row.staffId, {
          staffId: row.staffId,
          attorneyName: row.attorneyName,
          attorneyPosition: row.attorneyPosition,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.attorneyName.localeCompare(b.attorneyName));
  }, [overdueRows, pipeline?.byAttorney]);

  const milestoneToAttorney = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of overdueRows) {
      map.set(Number(row.milestoneId), row.staffId);
    }
    return map;
  }, [overdueRows]);

  const attorneySummary = useMemo<AttorneySummary[]>(() => {
    const grouped = new Map<
      number,
      {
        staffId: number;
        attorneyName: string;
        attorneyPosition: string | null;
        overdueAmount: number;
        overdueCount: number;
        overdueDaysTotal: number;
        overdueDaysCount: number;
        projectIds: Set<string>;
        nextDueDate: string | null;
      }
    >();

    for (const row of overdueRows) {
      const current = grouped.get(row.staffId) ?? {
        staffId: row.staffId,
        attorneyName: row.attorneyName,
        attorneyPosition: row.attorneyPosition,
        overdueAmount: 0,
        overdueCount: 0,
        overdueDaysTotal: 0,
        overdueDaysCount: 0,
        projectIds: new Set<string>(),
        nextDueDate: null,
      };

      const amount = toNumber(row.milestoneAmount ?? row.overdueAmount);
      current.overdueAmount += amount;
      current.overdueCount += 1;
      current.projectIds.add(String(row.billingProjectId));

      const d = daysOverdue(row.milestoneDueDate ?? row.nextDueDate);
      current.overdueDaysTotal += d;
      current.overdueDaysCount += 1;

      if (!current.nextDueDate || (row.nextDueDate && new Date(row.nextDueDate) < new Date(current.nextDueDate))) {
        current.nextDueDate = row.nextDueDate;
      }

      grouped.set(row.staffId, current);
    }

    return Array.from(grouped.values()).map((item) => ({
      staffId: item.staffId,
      attorneyName: item.attorneyName,
      attorneyPosition: item.attorneyPosition,
      overdueAmount: item.overdueAmount,
      overdueCount: item.overdueCount,
      projectCount: item.projectIds.size,
      avgDaysOverdue: item.overdueDaysCount ? item.overdueDaysTotal / item.overdueDaysCount : 0,
      nextDueDate: item.nextDueDate,
    }));
  }, [overdueRows]);

  const sortedAttorneySummary = useMemo(() => {
    return [...attorneySummary].sort((a, b) => {
      if (sortField === 'overdueAmount') return b.overdueAmount - a.overdueAmount;
      if (sortField === 'overdueCount') return b.overdueCount - a.overdueCount;
      if (sortField === 'projectCount') return b.projectCount - a.projectCount;
      return b.avgDaysOverdue - a.avgDaysOverdue;
    });
  }, [attorneySummary, sortField]);

  const filteredOverdueRows = useMemo(() => {
    if (!attorneyFilter) return overdueRows;
    return overdueRows.filter((row) => row.staffId === attorneyFilter);
  }, [overdueRows, attorneyFilter]);

  const baseFilteredTriggers = useMemo(() => {
    const normalizedSearch = triggerSearch.trim().toLowerCase();

    return triggerRows.filter((row) => {
      const amount = toNumber(row.milestone?.amountValue);
      if (minAmount !== undefined && amount < minAmount) {
        return false;
      }

      if (attorneyFilter) {
        const owner = milestoneToAttorney.get(Number(row.milestoneId));
        if (owner !== attorneyFilter) {
          return false;
        }
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
  }, [triggerRows, triggerSearch, minAmount, attorneyFilter, milestoneToAttorney]);

  const captainTriggerRows = useMemo(() => {
    if (triggerFocus === 'needs_review') {
      return baseFilteredTriggers.filter((row) => row.status === 'pending');
    }
    if (triggerFocus === 'needs_action') {
      return baseFilteredTriggers.filter((row) => row.status === 'confirmed' && row.actionItem?.status !== 'completed');
    }
    return baseFilteredTriggers;
  }, [baseFilteredTriggers, triggerFocus]);

  const pendingTriggerRows = useMemo(() => {
    return baseFilteredTriggers.filter((row) => row.status === 'pending');
  }, [baseFilteredTriggers]);

  const financeInvoiceQueue = useMemo(() => {
    return baseFilteredTriggers.filter((row) => {
      const actionType = (row.actionItem?.actionType || row.actionTaken || '').toLowerCase();
      const actionStatus = (row.actionItem?.status || 'pending').toLowerCase();
      return row.status === 'confirmed' && actionType === 'issue_invoice' && actionStatus !== 'completed';
    });
  }, [baseFilteredTriggers]);

  const financeFollowupQueue = useMemo(() => {
    return baseFilteredTriggers.filter((row) => {
      const actionType = (row.actionItem?.actionType || row.actionTaken || '').toLowerCase();
      const actionStatus = (row.actionItem?.status || 'pending').toLowerCase();
      const isFollowup = actionType === 'follow_up_payment' || actionType === 'general_followup';
      return row.status === 'confirmed' && isFollowup && actionStatus !== 'completed';
    });
  }, [baseFilteredTriggers]);

  const riskKpis = useMemo(() => {
    const uniqueMilestoneIds = new Set<string>();
    let totalOverdueAmount = 0;
    let severeOverdueCount = 0;

    for (const row of overdueRows) {
      const milestoneKey = String(row.milestoneId);
      if (uniqueMilestoneIds.has(milestoneKey)) {
        continue;
      }
      uniqueMilestoneIds.add(milestoneKey);
      totalOverdueAmount += toNumber(row.milestoneAmount ?? row.overdueAmount);
      if (daysOverdue(row.milestoneDueDate ?? row.nextDueDate) > 30) {
        severeOverdueCount += 1;
      }
    }

    const pendingTriggers = triggerRows.filter((row) => row.status === 'pending').length;

    return {
      totalOverdueAmount,
      overdueMilestones: uniqueMilestoneIds.size,
      pendingTriggers,
      severeOverdueCount,
      attorneysAtRisk: attorneySummary.filter((a) => a.overdueAmount > 0).length,
    };
  }, [overdueRows, triggerRows, attorneySummary]);

  const managerTotals = useMemo(() => {
    if (pipeline?.totals) {
      return pipeline.totals;
    }
    return {
      invoicableAmount: 0,
      invoicableCount: 0,
      outstandingArAmount: 0,
      outstandingArCount: 0,
      overdueAr30Amount: riskKpis.totalOverdueAmount,
      overdueAr30Count: riskKpis.overdueMilestones,
      collectedYtdAmount: 0,
      collectedYtdCount: 0,
      upcoming30Amount: 0,
      upcoming30Count: 0,
      pendingActionItems: triggerRows.filter((row) => row.actionItem?.status === 'pending').length,
      pendingTriggers: riskKpis.pendingTriggers,
    };
  }, [pipeline?.totals, riskKpis, triggerRows]);

  const resolveActionType = (trigger: BillingTriggerRow) => {
    return trigger.actionItem?.actionType || trigger.actionTaken || 'general_followup';
  };

  const handleConfirm = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue) return;
    await confirmTrigger.mutateAsync(trigger.id);
  };

  const handleReject = async (trigger: BillingTriggerRow) => {
    if (!canOperateQueue) return;
    await rejectTrigger.mutateAsync(trigger.id);
  };

  const handleSetActionStatus = async (trigger: BillingTriggerRow, status: ActionStatus) => {
    if (!canOperateQueue) return;
    await updateTriggerActionItem.mutateAsync({
      id: trigger.id,
      data: {
        actionType: resolveActionType(trigger),
        status,
      },
    });
  };

  const handleAssignActionType = async (trigger: BillingTriggerRow, actionType: string, dueInDays: number) => {
    if (!canOperateQueue) return;
    await updateTriggerActionItem.mutateAsync({
      id: trigger.id,
      data: {
        actionType,
        status: 'pending',
        dueDate: plusDaysYmd(dueInDays),
      },
    });
  };

  const handleConfirmAndSetInvoice = async (trigger: BillingTriggerRow) => {
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

  const openActionEditor = (trigger: BillingTriggerRow) => {
    setEditingTrigger(trigger);
    setActionTypeInput(trigger.actionItem?.actionType || trigger.actionTaken || 'general_followup');
    setActionStatusInput(trigger.actionItem?.status || 'pending');
    setActionDueDateInput(toInputDate(trigger.actionItem?.dueDate));
    setActionDescriptionInput(trigger.actionItem?.description || '');
    setActionAssignedToInput(trigger.actionItem?.assignedTo?.id ?? '');
  };

  const closeActionEditor = () => {
    if (updateTriggerActionItem.isPending) return;
    setEditingTrigger(null);
  };

  const handleSaveActionItem = async () => {
    if (!editingTrigger || !canOperateQueue) return;

    await updateTriggerActionItem.mutateAsync({
      id: editingTrigger.id,
      data: {
        actionType: actionTypeInput || undefined,
        status: actionStatusInput,
        dueDate: actionDueDateInput || null,
        description: actionDescriptionInput.trim() ? actionDescriptionInput.trim() : undefined,
        assignedTo: actionAssignedToInput === '' ? null : actionAssignedToInput,
      },
    });

    setEditingTrigger(null);
  };

  const renderCaptainSection = () => (
    <Stack spacing={2.5}>
      <Section>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <MetricCard
            label="Pending Trigger Decisions"
            value={String(pendingTriggerRows.length)}
            helper="Awaiting confirm/reject"
            tone="warning"
          />
          <MetricCard
            label="31+ Day Risk Milestones"
            value={String(riskKpis.severeOverdueCount)}
            helper="Needs immediate captain follow-through"
            tone="danger"
          />
          <MetricCard
            label="Total Overdue Exposure"
            value={currencyFormatter.format(riskKpis.totalOverdueAmount)}
            helper="Milestones already past due"
            tone="danger"
          />
        </Stack>
      </Section>

      <Section>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} mb={2}>
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
            type="number"
            label="Min Amount (USD)"
            value={minAmount ?? ''}
            onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : undefined)}
            size="small"
            sx={{ minWidth: 180 }}
          />

          <TextField
            select
            label="Trigger Status"
            value={triggerStatus}
            onChange={(e) => setTriggerStatus(e.target.value as 'pending' | 'confirmed' | 'rejected' | 'all')}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="confirmed">Confirmed</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </TextField>

          <TextField
            select
            label="Queue Focus"
            value={triggerFocus}
            onChange={(e) => setTriggerFocus(e.target.value as TriggerFocus)}
            size="small"
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="needs_review">Needs Review</MenuItem>
            <MenuItem value="needs_action">Needs Action</MenuItem>
            <MenuItem value="all">All Rows</MenuItem>
          </TextField>

          <TextField
            label="Search"
            value={triggerSearch}
            onChange={(e) => setTriggerSearch(e.target.value)}
            placeholder="Project, milestone, reason"
            size="small"
            sx={{ minWidth: 220 }}
          />
        </Stack>

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Trigger Decision Queue
        </Typography>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Milestone</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right">Confidence</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Action Status</TableCell>
                <TableCell>Action Due</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {captainTriggerRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    No triggers found for selected filters
                  </TableCell>
                </TableRow>
              ) : (
                captainTriggerRows.map((row) => {
                  const riskChip = getRiskChip(row.milestone?.dueDate);

                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Chip size="small" label={formatCode(row.status)} color={statusChipColor(row.status)} />
                      </TableCell>
                      <TableCell>{row.project?.name || '—'}</TableCell>
                      <TableCell>{row.milestone?.title || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={riskChip.label} color={riskChip.color} variant="outlined" />
                      </TableCell>
                      <TableCell>{row.triggerReason || '—'}</TableCell>
                      <TableCell align="right">{(row.matchConfidence * 100).toFixed(0)}%</TableCell>
                      <TableCell>{formatCode(row.actionItem?.actionType || row.actionTaken)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={formatCode(row.actionItem?.status || 'pending')}
                          color={actionStatusChipColor(row.actionItem?.status || 'pending')}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatDate(row.actionItem?.dueDate)}</TableCell>
                      <TableCell>{formatDate(row.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                          {row.status === 'pending' ? (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => handleConfirm(row)}
                                disabled={!canOperateQueue || isMutating}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleConfirmAndSetInvoice(row)}
                                disabled={!canOperateQueue || isMutating}
                              >
                                Confirm + Invoice
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleReject(row)}
                                disabled={!canOperateQueue || isMutating}
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}

                          {row.status === 'confirmed' && row.actionItem?.status !== 'completed' ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => handleSetActionStatus(row, 'completed')}
                              disabled={!canOperateQueue || isMutating}
                            >
                              Mark Done
                            </Button>
                          ) : null}

                          {row.status === 'confirmed' && row.actionItem?.status === 'completed' ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleSetActionStatus(row, 'pending')}
                              disabled={!canOperateQueue || isMutating}
                            >
                              Reopen
                            </Button>
                          ) : null}

                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openActionEditor(row)}
                            disabled={!canOperateQueue || isMutating}
                          >
                            {row.actionItem ? 'Edit Action' : 'Add Action'}
                          </Button>
                        </Stack>
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
          Overdue Milestone Risk Board
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>B&C Attorney</TableCell>
                <TableCell>Billing Project</TableCell>
                <TableCell>Milestone</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell align="right">Days Overdue</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOverdueRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No overdue milestones found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOverdueRows.map((row) => {
                  const risk = getRiskChip(row.milestoneDueDate);
                  return (
                    <TableRow key={`${row.staffId}-${row.milestoneId}`} hover>
                      <TableCell>{row.attorneyName}</TableCell>
                      <TableCell>{row.billingProjectName}</TableCell>
                      <TableCell>{row.milestoneTitle || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={risk.label} color={risk.color} variant="outlined" />
                      </TableCell>
                      <TableCell>{formatDate(row.milestoneDueDate)}</TableCell>
                      <TableCell align="right">{daysOverdue(row.milestoneDueDate)}</TableCell>
                      <TableCell align="right">
                        {currencyFormatter.format(toNumber(row.milestoneAmount ?? row.overdueAmount))}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Section>
    </Stack>
  );

  const renderManagerSection = () => (
    <Stack spacing={2.5}>
      <Section>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <MetricCard
            label="Invoicable Now"
            value={currencyFormatter.format(managerTotals.invoicableAmount)}
            helper={`${managerTotals.invoicableCount} milestones ready for invoice`}
            tone="positive"
          />
          <MetricCard
            label="Outstanding AR"
            value={currencyFormatter.format(managerTotals.outstandingArAmount)}
            helper={`${managerTotals.outstandingArCount} open receivables`}
            tone="warning"
          />
          <MetricCard
            label="Overdue AR (30+)"
            value={currencyFormatter.format(managerTotals.overdueAr30Amount)}
            helper={`${managerTotals.overdueAr30Count} milestones in risk window`}
            tone="danger"
          />
          <MetricCard
            label="Collected YTD"
            value={currencyFormatter.format(managerTotals.collectedYtdAmount)}
            helper={`${managerTotals.collectedYtdCount} payments recorded`}
            tone="positive"
          />
          <MetricCard
            label="Pending Triggers"
            value={String(managerTotals.pendingTriggers)}
            helper="Awaiting captain decision"
            tone="warning"
          />
          <MetricCard
            label="Pending Actions"
            value={String(managerTotals.pendingActionItems)}
            helper="Execution queue for finance"
            tone="warning"
          />
        </Stack>
      </Section>

      <Section>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          B&C Performance Lens
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>B&C Attorney</TableCell>
                <TableCell>Position</TableCell>
                <TableCell align="right">Invoicable</TableCell>
                <TableCell align="right">Outstanding AR</TableCell>
                <TableCell align="right">Overdue AR (30+)</TableCell>
                <TableCell align="right">Upcoming 30d</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(pipeline?.byAttorney || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No attorney pipeline data available
                  </TableCell>
                </TableRow>
              ) : (
                (pipeline?.byAttorney || []).map((row) => (
                  <TableRow key={`${row.staffId}-${row.attorneyName}`} hover>
                    <TableCell>{row.attorneyName}</TableCell>
                    <TableCell>{row.attorneyPosition || '—'}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(toNumber(row.invoicableAmount))}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(toNumber(row.outstandingArAmount))}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(toNumber(row.overdueAr30Amount))}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(toNumber(row.upcoming30Amount))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Section>

      <Section>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Exposure Snapshot
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <MetricCard
            label="Overdue Milestones"
            value={String(riskKpis.overdueMilestones)}
            helper="Immediate milestone slippage"
            tone="warning"
          />
          <MetricCard
            label="31+ Day Risks"
            value={String(riskKpis.severeOverdueCount)}
            helper="High-priority collection exposure"
            tone="danger"
          />
          <MetricCard
            label="Attorneys At Risk"
            value={String(riskKpis.attorneysAtRisk)}
            helper="B&C attorneys with overdue book"
            tone="warning"
          />
        </Stack>
      </Section>
    </Stack>
  );

  const renderFinanceSection = () => (
    <Stack spacing={2.5}>
      <Section>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <MetricCard
            label="Invoicable Now"
            value={currencyFormatter.format(managerTotals.invoicableAmount)}
            helper={`${managerTotals.invoicableCount} milestones ready`}
            tone="positive"
          />
          <MetricCard
            label="Outstanding AR"
            value={currencyFormatter.format(managerTotals.outstandingArAmount)}
            helper={`${managerTotals.outstandingArCount} invoices open`}
            tone="warning"
          />
          <MetricCard
            label="Overdue AR (30+)"
            value={currencyFormatter.format(managerTotals.overdueAr30Amount)}
            helper={`${managerTotals.overdueAr30Count} needs collection push`}
            tone="danger"
          />
          <MetricCard
            label="Collected YTD"
            value={currencyFormatter.format(managerTotals.collectedYtdAmount)}
            helper={`${managerTotals.collectedYtdCount} settled payments`}
            tone="positive"
          />
        </Stack>
      </Section>

      <Section>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Invoice Dispatch Queue
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Project</TableCell>
                <TableCell>Milestone</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Action Due</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {financeInvoiceQueue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No pending invoice actions
                  </TableCell>
                </TableRow>
              ) : (
                financeInvoiceQueue.map((row) => (
                  <TableRow key={`invoice-${row.id}`} hover>
                    <TableCell>{row.project?.name || '—'}</TableCell>
                    <TableCell>{row.milestone?.title || '—'}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(toNumber(row.milestone?.amountValue))}</TableCell>
                    <TableCell>{formatDate(row.actionItem?.dueDate)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={formatCode(row.actionItem?.status || 'pending')}
                        color={actionStatusChipColor(row.actionItem?.status || 'pending')}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => handleSetActionStatus(row, 'completed')}
                          disabled={!canOperateQueue || isMutating}
                        >
                          Mark Sent
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleAssignActionType(row, 'follow_up_payment', 14)}
                          disabled={!canOperateQueue || isMutating}
                        >
                          Move to Follow-up
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openActionEditor(row)}
                          disabled={!canOperateQueue || isMutating}
                        >
                          Edit Action
                        </Button>
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
          Collections Follow-up Queue
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Project</TableCell>
                <TableCell>Milestone</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Action Due</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {financeFollowupQueue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No pending follow-up actions
                  </TableCell>
                </TableRow>
              ) : (
                financeFollowupQueue.map((row) => (
                  <TableRow key={`followup-${row.id}`} hover>
                    <TableCell>{row.project?.name || '—'}</TableCell>
                    <TableCell>{row.milestone?.title || '—'}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(toNumber(row.milestone?.amountValue))}</TableCell>
                    <TableCell>{formatDate(row.actionItem?.dueDate)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={formatCode(row.actionItem?.status || 'pending')}
                        color={actionStatusChipColor(row.actionItem?.status || 'pending')}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => handleSetActionStatus(row, 'completed')}
                          disabled={!canOperateQueue || isMutating}
                        >
                          Mark Collected
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleAssignActionType(row, 'follow_up_payment', 7)}
                          disabled={!canOperateQueue || isMutating}
                        >
                          Schedule +7d
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openActionEditor(row)}
                          disabled={!canOperateQueue || isMutating}
                        >
                          Edit Action
                        </Button>
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
          Attorney Aging Risk
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>B&C Attorney</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setSortField('projectCount')}>Projects</Button>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setSortField('overdueCount')}>Overdue Count</Button>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setSortField('avgDaysOverdue')}>Avg Days Overdue</Button>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setSortField('overdueAmount')}>Overdue Amount</Button>
                </TableCell>
                <TableCell>Next Due</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedAttorneySummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No overdue milestones found
                  </TableCell>
                </TableRow>
              ) : (
                sortedAttorneySummary.map((row) => (
                  <TableRow key={`age-${row.staffId}`} hover>
                    <TableCell>{row.attorneyName}</TableCell>
                    <TableCell align="right">{row.projectCount}</TableCell>
                    <TableCell align="right">{row.overdueCount}</TableCell>
                    <TableCell align="right">{row.avgDaysOverdue.toFixed(1)}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(row.overdueAmount)}</TableCell>
                    <TableCell>{formatDate(row.nextDueDate)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Section>
    </Stack>
  );

  return (
    <Page>
      <PageHeader
        title="Billing Control Tower"
        subtitle="Role-focused workspace for manager visibility, deal-captain decisions, and finance execution."
      />

      {!canOperateQueue ? (
        <Section>
          <Alert severity="warning">Only administrators can access trigger operations in the billing control tower.</Alert>
        </Section>
      ) : null}

      <Section>
        <Tabs value={view} onChange={(_, next) => setView(next as TowerView)} aria-label="control tower role views">
          <Tab value="manager" label="Manager View" />
          <Tab value="captain" label="Deal Captain View" />
          <Tab value="finance" label="Finance View" />
        </Tabs>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`As of ${formatDate(pipeline?.asOf || new Date().toISOString())}`} />
          <Chip size="small" label={`Pending Triggers ${managerTotals.pendingTriggers}`} color="warning" variant="outlined" />
          <Chip size="small" label={`Pending Actions ${managerTotals.pendingActionItems}`} color="warning" variant="outlined" />
          <Chip size="small" label={canOperateQueue ? 'Admin Controls Enabled' : 'Read-only'} color={canOperateQueue ? 'success' : 'default'} variant="outlined" />
        </Stack>
      </Section>

      {isLoading ? (
        <Section>
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        </Section>
      ) : loadError ? (
        <Section>
          <Alert severity="error">{getErrorMessage(loadError)}</Alert>
        </Section>
      ) : (
        <>
          {view === 'manager' && renderManagerSection()}
          {view === 'captain' && renderCaptainSection()}
          {view === 'finance' && renderFinanceSection()}
        </>
      )}

      <Dialog open={!!editingTrigger} onClose={closeActionEditor} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTrigger?.actionItem ? 'Edit Trigger Action' : 'Add Trigger Action'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Action Type"
              value={actionTypeInput}
              onChange={(e) => setActionTypeInput(e.target.value)}
              fullWidth
            >
              <MenuItem value="issue_invoice">Issue Invoice</MenuItem>
              <MenuItem value="follow_up_payment">Follow Up Payment</MenuItem>
              <MenuItem value="pause_billing">Pause Billing</MenuItem>
              <MenuItem value="adjust_billing_schedule">Adjust Billing Schedule</MenuItem>
              <MenuItem value="review_billing_agreement">Review Billing Agreement</MenuItem>
              <MenuItem value="general_followup">General Follow-up</MenuItem>
            </TextField>

            <TextField
              select
              label="Action Status"
              value={actionStatusInput}
              onChange={(e) => setActionStatusInput(e.target.value as ActionStatus)}
              fullWidth
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>

            <TextField
              select
              label="Assigned To"
              value={actionAssignedToInput}
              onChange={(e) => setActionAssignedToInput(e.target.value === '' ? '' : Number(e.target.value))}
              fullWidth
            >
              <MenuItem value="">Unassigned</MenuItem>
              {attorneyOptions.map((attorney) => (
                <MenuItem key={attorney.staffId} value={attorney.staffId}>
                  {attorney.attorneyName}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="date"
              label="Action Due Date"
              value={actionDueDateInput}
              onChange={(e) => setActionDueDateInput(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="Description"
              value={actionDescriptionInput}
              onChange={(e) => setActionDescriptionInput(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActionEditor} disabled={updateTriggerActionItem.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveActionItem}
            disabled={updateTriggerActionItem.isPending || !canOperateQueue}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
};

export default BillingControlTower;
