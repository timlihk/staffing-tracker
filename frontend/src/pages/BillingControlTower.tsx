import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Page, PageHeader, Section } from '../components/ui';
import {
  useBillingTriggers,
  useConfirmBillingTrigger,
  useOverdueByAttorney,
  useRejectBillingTrigger,
} from '../hooks/useBilling';
import type { BillingOverdueRow, BillingTriggerRow } from '../api/billing';

type SortField = 'overdueAmount' | 'overdueCount' | 'avgDaysOverdue' | 'projectCount';

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

const BillingControlTower: React.FC = () => {
  const [attorneyFilter, setAttorneyFilter] = useState<number | undefined>(undefined);
  const [minAmount, setMinAmount] = useState<number | undefined>(undefined);
  const [triggerStatus, setTriggerStatus] = useState<'pending' | 'confirmed' | 'rejected' | 'all'>('pending');
  const [sortField, setSortField] = useState<SortField>('overdueAmount');

  const overdueQuery = useOverdueByAttorney({
    attorneyId: attorneyFilter,
    minAmount,
  });

  const triggersQuery = useBillingTriggers({
    ...(triggerStatus === 'all' ? {} : { status: triggerStatus }),
  });

  const confirmTrigger = useConfirmBillingTrigger();
  const rejectTrigger = useRejectBillingTrigger();

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

  const handleConfirm = async (trigger: BillingTriggerRow) => {
    await confirmTrigger.mutateAsync(trigger.id);
  };

  const handleReject = async (trigger: BillingTriggerRow) => {
    await rejectTrigger.mutateAsync(trigger.id);
  };

  return (
    <Page>
      <PageHeader
        title="Billing Control Tower"
        subtitle="Manager view of overdue exposure, trigger operations, and B&C accountability"
      />

      {isLoading ? (
        <Section>
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
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
                {sortedAttorneySummary.map((row) => (
                  <TableRow key={row.staffId} hover>
                    <TableCell>{row.attorneyName}</TableCell>
                    <TableCell>{row.attorneyPosition || '—'}</TableCell>
                    <TableCell align="right">{row.projectCount}</TableCell>
                    <TableCell align="right">{row.overdueCount}</TableCell>
                    <TableCell align="right">{row.avgDaysOverdue.toFixed(1)}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(row.overdueAmount)}</TableCell>
                    <TableCell>{formatDate(row.nextDueDate)}</TableCell>
                  </TableRow>
                ))}
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
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {triggerRows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.project?.name || '—'}</TableCell>
                    <TableCell>{row.milestone?.title || '—'}</TableCell>
                    <TableCell>{row.triggerReason || '—'}</TableCell>
                    <TableCell align="right">{(row.matchConfidence * 100).toFixed(0)}%</TableCell>
                    <TableCell>{formatDate(row.createdAt)}</TableCell>
                    <TableCell align="right">
                      {row.status === 'pending' ? (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleConfirm(row)}
                            disabled={confirmTrigger.isPending || rejectTrigger.isPending}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleReject(row)}
                            disabled={confirmTrigger.isPending || rejectTrigger.isPending}
                          >
                            Reject
                          </Button>
                        </Stack>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
                {filteredOverdueRows.map((row) => (
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
                ))}
              </TableBody>
            </Table>
          </Section>
        </Stack>
      )}
    </Page>
  );
};

export default BillingControlTower;
