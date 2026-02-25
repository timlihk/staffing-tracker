import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { isAxiosError } from 'axios';
import { Page, PageHeader, Section } from '../components/ui';
import { BillingExcelSyncPanel } from '../components/admin/BillingExcelSyncPanel';
import {
  useBillingTriggers,
  useConfirmBillingTrigger,
  useOverdueByAttorney,
  useRejectBillingTrigger,
  useUpdateTriggerActionItem,
} from '../hooks/useBilling';
import type { BillingOverdueRow, BillingTriggerRow } from '../api/billing';

type SortField = 'overdueAmount' | 'overdueCount' | 'avgDaysOverdue' | 'projectCount';
type ActionStatus = 'pending' | 'completed' | 'cancelled';

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

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

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
const formatCode = (value?: string | null) => {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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
  const [activeTab, setActiveTab] = useState(0);
  const [attorneyFilter, setAttorneyFilter] = useState<number | undefined>(undefined);
  const [minAmount, setMinAmount] = useState<number | undefined>(undefined);
  const [triggerStatus, setTriggerStatus] = useState<'pending' | 'confirmed' | 'rejected' | 'all'>('pending');
  const [sortField, setSortField] = useState<SortField>('overdueAmount');
  const [editingTrigger, setEditingTrigger] = useState<BillingTriggerRow | null>(null);
  const [actionTypeInput, setActionTypeInput] = useState('general_followup');
  const [actionStatusInput, setActionStatusInput] = useState<ActionStatus>('pending');
  const [actionDueDateInput, setActionDueDateInput] = useState('');
  const [actionDescriptionInput, setActionDescriptionInput] = useState('');

  const overdueQuery = useOverdueByAttorney({
    attorneyId: attorneyFilter,
    minAmount,
  });

  const triggersQuery = useBillingTriggers({
    ...(triggerStatus === 'all' ? {} : { status: triggerStatus }),
  });

  const confirmTrigger = useConfirmBillingTrigger();
  const rejectTrigger = useRejectBillingTrigger();
  const updateTriggerActionItem = useUpdateTriggerActionItem();

  const overdueRows = overdueQuery.data ?? [];
  const triggerRows = triggersQuery.data ?? [];

  const attorneyOptions = useMemo(() => {
    const map = new Map<number, { staffId: number; attorneyName: string }>();
    for (const row of overdueRows) {
      if (!map.has(row.staffId)) {
        map.set(row.staffId, { staffId: row.staffId, attorneyName: row.attorneyName });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.attorneyName.localeCompare(b.attorneyName));
  }, [overdueRows]);

  const attorneySummary = useMemo<AttorneySummary[]>(() => {
    const grouped = new Map<number, {
      staffId: number;
      attorneyName: string;
      attorneyPosition: string | null;
      overdueAmount: number;
      overdueCount: number;
      overdueDaysTotal: number;
      overdueDaysCount: number;
      projectIds: Set<string>;
      nextDueDate: string | null;
    }>();

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

  const kpis = useMemo(() => {
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

  const filteredOverdueRows = useMemo(() => {
    if (!attorneyFilter) return overdueRows;
    return overdueRows.filter((row) => row.staffId === attorneyFilter);
  }, [overdueRows, attorneyFilter]);

  const isLoading = overdueQuery.isLoading || triggersQuery.isLoading;
  const loadError = overdueQuery.error || triggersQuery.error;

  const handleConfirm = async (trigger: BillingTriggerRow) => {
    await confirmTrigger.mutateAsync(trigger.id);
  };

  const handleReject = async (trigger: BillingTriggerRow) => {
    await rejectTrigger.mutateAsync(trigger.id);
  };

  const openActionEditor = (trigger: BillingTriggerRow) => {
    setEditingTrigger(trigger);
    setActionTypeInput(trigger.actionItem?.actionType || trigger.actionTaken || 'general_followup');
    setActionStatusInput(trigger.actionItem?.status || 'pending');
    setActionDueDateInput(toInputDate(trigger.actionItem?.dueDate));
    setActionDescriptionInput(trigger.actionItem?.description || '');
  };

  const closeActionEditor = () => {
    if (updateTriggerActionItem.isPending) return;
    setEditingTrigger(null);
  };

  const handleSaveActionItem = async () => {
    if (!editingTrigger) return;
    await updateTriggerActionItem.mutateAsync({
      id: editingTrigger.id,
      data: {
        actionType: actionTypeInput || undefined,
        status: actionStatusInput,
        dueDate: actionDueDateInput ? actionDueDateInput : null,
        description: actionDescriptionInput.trim() ? actionDescriptionInput.trim() : undefined,
      },
    });
    setEditingTrigger(null);
  };

  return (
    <Page>
      <PageHeader
        title="Billing Control Tower"
        subtitle="Central hub for billing operations, oversight, and finance data sync"
      />

      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Management View" />
          <Tab label="Finance View" />
        </Tabs>
      </Paper>

      {activeTab === 1 && (
        <Stack spacing={2.5}>
          <Section>
            <BillingExcelSyncPanel />
          </Section>
        </Stack>
      )}

      {activeTab === 0 && (isLoading ? (
        <Section>
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        </Section>
      ) : loadError ? (
        <Section>
          <Alert severity="error">
            {getErrorMessage(loadError)}
          </Alert>
        </Section>
      ) : (
        <Stack spacing={2.5}>
          <Section>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              {[
                { label: 'Total Overdue', value: currencyFormatter.format(kpis.totalOverdueAmount) },
                { label: 'Overdue Milestones', value: String(kpis.overdueMilestones) },
                { label: 'Pending Triggers', value: String(kpis.pendingTriggers) },
                { label: '31+ Day Risks', value: String(kpis.severeOverdueCount) },
                { label: 'Attorneys At Risk', value: String(kpis.attorneysAtRisk) },
              ].map((item) => (
                <Paper key={item.label} sx={{ p: 2, flex: 1, bgcolor: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {item.value}
                  </Typography>
                </Paper>
              ))}
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
                sx={{ minWidth: 200 }}
              />

              <TextField
                select
                label="Trigger Status"
                value={triggerStatus}
                onChange={(e) => setTriggerStatus(e.target.value as 'pending' | 'confirmed' | 'rejected' | 'all')}
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </TextField>
            </Stack>

            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              B&C Accountability Board
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>B&C Attorney</TableCell>
                  <TableCell>Position</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setSortField('projectCount')}>Projects</Button>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setSortField('overdueCount')}>Overdue Milestones</Button>
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
                    <TableCell colSpan={7} align="center">
                      No overdue milestones found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedAttorneySummary.map((row) => (
                    <TableRow key={row.staffId} hover>
                      <TableCell>{row.attorneyName}</TableCell>
                      <TableCell>{row.attorneyPosition || '—'}</TableCell>
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
          </Section>

          <Section>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Trigger Queue
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Milestone</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Confidence</TableCell>
                  <TableCell>Consequence / Action</TableCell>
                  <TableCell>Action Status</TableCell>
                  <TableCell>Action Due</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {triggerRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      No triggers found for the selected filter
                    </TableCell>
                  </TableRow>
                ) : (
                  triggerRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{row.project?.name || '—'}</TableCell>
                      <TableCell>{row.milestone?.title || '—'}</TableCell>
                      <TableCell>{row.triggerReason || '—'}</TableCell>
                      <TableCell align="right">{(row.matchConfidence * 100).toFixed(0)}%</TableCell>
                      <TableCell>{formatCode(row.actionItem?.actionType || row.actionTaken)}</TableCell>
                      <TableCell>{formatCode(row.actionItem?.status)}</TableCell>
                      <TableCell>{formatDate(row.actionItem?.dueDate)}</TableCell>
                      <TableCell>{formatDate(row.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {row.status === 'pending' && (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => handleConfirm(row)}
                                disabled={confirmTrigger.isPending || rejectTrigger.isPending || updateTriggerActionItem.isPending}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleReject(row)}
                                disabled={confirmTrigger.isPending || rejectTrigger.isPending || updateTriggerActionItem.isPending}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openActionEditor(row)}
                            disabled={confirmTrigger.isPending || rejectTrigger.isPending || updateTriggerActionItem.isPending}
                          >
                            {row.actionItem ? 'Edit Action' : 'Add Action'}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Section>

          <Section>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Overdue Milestones
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>B&C Attorney</TableCell>
                  <TableCell>Billing Project</TableCell>
                  <TableCell>Milestone</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell align="right">Days Overdue</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOverdueRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No overdue milestones found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOverdueRows.map((row) => (
                    <TableRow key={`${row.staffId}-${row.milestoneId}`} hover>
                      <TableCell>{row.attorneyName}</TableCell>
                      <TableCell>{row.billingProjectName}</TableCell>
                      <TableCell>{row.milestoneTitle || '—'}</TableCell>
                      <TableCell>{formatDate(row.milestoneDueDate)}</TableCell>
                      <TableCell align="right">{daysOverdue(row.milestoneDueDate)}</TableCell>
                      <TableCell align="right">
                        {currencyFormatter.format(toNumber(row.milestoneAmount ?? row.overdueAmount))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Section>
        </Stack>
      ))}

      <Dialog open={!!editingTrigger} onClose={closeActionEditor} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTrigger?.actionItem ? 'Edit Trigger Action' : 'Add Trigger Action'}
        </DialogTitle>
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
          <Button variant="contained" onClick={handleSaveActionItem} disabled={updateTriggerActionItem.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
};

export default BillingControlTower;
