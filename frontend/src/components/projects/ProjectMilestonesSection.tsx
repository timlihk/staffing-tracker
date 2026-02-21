import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { isAxiosError } from 'axios';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Collapse,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import api from '../../api/client';
import { toast } from '../../lib/toast';
import MilestoneCard from './MilestoneCard';
import type {
  ProjectBillingMilestoneRow,
  ProjectBillingMilestoneResponse,
  MilestoneCreateFormState,
  LifecycleStep,
} from '../../types/projectBilling';
import { createMilestoneFormState } from '../../types/projectBilling';

interface ProjectMilestonesSectionProps {
  projectId: number;
  permissions: {
    isAdmin: boolean;
    canEditBillingMilestones: boolean;
  };
  refreshKey?: number;
  onDataLoaded?: (data: ProjectBillingMilestoneResponse | null) => void;
}

interface EngagementGroup {
  engagementId: number;
  engagementTitle: string | null;
  cmNumber: string | null;
  billingProjectName: string | null;
  feeArrangementText: string | null;
  milestones: ProjectBillingMilestoneRow[];
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const ProjectMilestonesSection: React.FC<ProjectMilestonesSectionProps> = ({
  projectId,
  permissions,
  refreshKey,
  onDataLoaded,
}) => {
  const [data, setData] = useState<ProjectBillingMilestoneResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingSteps, setSavingSteps] = useState<Record<number, LifecycleStep | null>>({});
  const [savingNotes, setSavingNotes] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<MilestoneCreateFormState>(() => createMilestoneFormState());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectBillingMilestoneRow | null>(null);
  const [editForm, setEditForm] = useState({ title: '', triggerText: '', dueDate: '', amountValue: '', amountCurrency: 'USD' });
  const [savingEdit, setSavingEdit] = useState(false);

  const canEdit = permissions.canEditBillingMilestones;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<ProjectBillingMilestoneResponse>(
        `/projects/${projectId}/billing-milestones`
      );
      setData(response.data);
      onDataLoaded?.(response.data);
    } catch {
      // Silent fail — data stays null, empty state shown
    } finally {
      setLoading(false);
    }
  }, [projectId, onDataLoaded]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Summary
  const summary = useMemo(() => {
    const ms = data?.milestones ?? [];
    const overdue = ms.filter((m) => m.milestoneStatus === 'overdue');
    const readyToInvoice = ms.filter((m) => m.completed && !m.invoiceSentDate);
    return {
      total: ms.length,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((sum, m) => sum + (m.amountValue ?? 0), 0),
      readyToInvoice: readyToInvoice.length,
    };
  }, [data]);

  // Group by CM → engagement
  const groups = useMemo((): EngagementGroup[] => {
    const ms = data?.milestones ?? [];
    const groupMap = new Map<string, EngagementGroup>();

    for (const m of ms) {
      const key = `${m.cmNumber ?? 'unknown'}::${m.engagementId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          engagementId: m.engagementId,
          engagementTitle: m.engagementTitle,
          cmNumber: m.cmNumber,
          billingProjectName: m.billingProjectName,
          feeArrangementText: m.feeArrangementText,
          milestones: [],
        });
      }
      groupMap.get(key)!.milestones.push(m);
    }

    return Array.from(groupMap.values());
  }, [data]);

  // Engagement options for create dialog
  const engagementOptions = useMemo(() => {
    const map = new Map<number, { id: number; label: string }>();
    for (const g of groups) {
      if (!map.has(g.engagementId)) {
        const label = g.engagementTitle
          ? `${g.engagementTitle} (${g.cmNumber || 'C/M --'})`
          : `Engagement ${g.engagementId} (${g.cmNumber || 'C/M --'})`;
        map.set(g.engagementId, { id: g.engagementId, label });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [groups]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Auto-save lifecycle toggle
  const handleToggleLifecycle = async (milestoneId: number, step: LifecycleStep) => {
    const milestone = data?.milestones.find((m) => m.milestoneId === milestoneId);
    if (!milestone) return;

    const today = new Date().toISOString().slice(0, 10);
    const payload: Record<string, unknown> = { milestone_id: milestoneId };

    if (step === 'completed') {
      payload.completed = !milestone.completed;
    } else if (step === 'invoiceSentDate') {
      payload.invoice_sent_date = milestone.invoiceSentDate ? null : today;
    } else if (step === 'paymentReceivedDate') {
      payload.payment_received_date = milestone.paymentReceivedDate ? null : today;
    }

    setSavingSteps((prev) => ({ ...prev, [milestoneId]: step }));

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        milestones: prev.milestones.map((m) => {
          if (m.milestoneId !== milestoneId) return m;
          if (step === 'completed') {
            return { ...m, completed: !m.completed, completionDate: !m.completed ? today : null };
          }
          if (step === 'invoiceSentDate') {
            return { ...m, invoiceSentDate: m.invoiceSentDate ? null : today };
          }
          if (step === 'paymentReceivedDate') {
            return { ...m, paymentReceivedDate: m.paymentReceivedDate ? null : today };
          }
          return m;
        }),
      };
    });

    try {
      await api.patch(`/projects/${projectId}/billing-milestones`, { milestones: [payload] });
      // Refresh to get server-computed fields (milestoneStatus etc.)
      await fetchData();
    } catch (error) {
      const message = isAxiosError<{ error?: string }>(error)
        ? (error.response?.data?.error ?? 'Please try again')
        : 'Please try again';
      toast.error('Failed to update milestone', message);
      // Revert optimistic update
      await fetchData();
    } finally {
      setSavingSteps((prev) => ({ ...prev, [milestoneId]: null }));
    }
  };

  // Notes save on blur
  const handleSaveNotes = async (milestoneId: number, notes: string) => {
    setSavingNotes((prev) => new Set(prev).add(milestoneId));
    try {
      await api.patch(`/projects/${projectId}/billing-milestones`, {
        milestones: [{ milestone_id: milestoneId, notes: notes || null }],
      });
      await fetchData();
    } catch (error) {
      const message = isAxiosError<{ error?: string }>(error)
        ? (error.response?.data?.error ?? 'Please try again')
        : 'Please try again';
      toast.error('Failed to save notes', message);
    } finally {
      setSavingNotes((prev) => {
        const next = new Set(prev);
        next.delete(milestoneId);
        return next;
      });
    }
  };

  // Edit dialog
  const handleOpenEdit = (milestone: ProjectBillingMilestoneRow) => {
    setEditingMilestone(milestone);
    setEditForm({
      title: milestone.title ?? '',
      triggerText: milestone.triggerText ?? '',
      dueDate: milestone.dueDate ? milestone.dueDate.slice(0, 10) : '',
      amountValue: milestone.amountValue != null ? String(milestone.amountValue) : '',
      amountCurrency: milestone.amountCurrency ?? 'USD',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingMilestone) return;
    setSavingEdit(true);

    const payload: Record<string, unknown> = { milestone_id: editingMilestone.milestoneId };

    if (editForm.title !== (editingMilestone.title ?? '')) {
      payload.title = editForm.title.trim() || null;
    }
    if (editForm.triggerText !== (editingMilestone.triggerText ?? '')) {
      payload.trigger_text = editForm.triggerText.trim() || null;
    }
    if (editForm.dueDate !== (editingMilestone.dueDate ? editingMilestone.dueDate.slice(0, 10) : '')) {
      payload.due_date = editForm.dueDate || null;
    }
    if (editForm.amountCurrency !== (editingMilestone.amountCurrency ?? 'USD')) {
      payload.amount_currency = editForm.amountCurrency.trim() || null;
    }

    const newAmount = editForm.amountValue.trim();
    const oldAmount = editingMilestone.amountValue != null ? String(editingMilestone.amountValue) : '';
    if (newAmount !== oldAmount) {
      if (newAmount === '') {
        payload.amount_value = null;
      } else {
        const num = Number(newAmount);
        if (!Number.isFinite(num)) {
          toast.error('Invalid amount value', 'Please enter a valid number');
          setSavingEdit(false);
          return;
        }
        payload.amount_value = num;
      }
    }

    // Only send if something changed beyond the milestone_id
    if (Object.keys(payload).length <= 1) {
      setEditDialogOpen(false);
      setEditingMilestone(null);
      setSavingEdit(false);
      return;
    }

    try {
      await api.patch(`/projects/${projectId}/billing-milestones`, { milestones: [payload] });
      setEditDialogOpen(false);
      setEditingMilestone(null);
      await fetchData();
      toast.success('Milestone updated');
    } catch (error) {
      const message = isAxiosError<{ error?: string }>(error)
        ? (error.response?.data?.error ?? 'Please try again')
        : 'Please try again';
      toast.error('Failed to update milestone', message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete
  const handleDelete = async (milestoneId: number) => {
    const confirmed = window.confirm('Remove this billing milestone?');
    if (!confirmed) return;

    setDeletingIds((prev) => [...prev, milestoneId]);
    try {
      await api.delete(`/billing/milestones/${milestoneId}`);
      await fetchData();
      toast.success('Milestone removed');
    } catch (error) {
      const message = isAxiosError<{ error?: string }>(error)
        ? (error.response?.data?.error ?? 'Please try again')
        : 'Please try again';
      toast.error('Failed to remove milestone', message);
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== milestoneId));
    }
  };

  // Create milestone
  const handleOpenCreate = () => {
    const defaultEngagementId = engagementOptions[0]?.id;
    setForm(createMilestoneFormState({
      engagementId: defaultEngagementId ? String(defaultEngagementId) : '',
    }));
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    const engagementId = Number(form.engagementId);
    if (!Number.isFinite(engagementId) || engagementId <= 0) {
      toast.error('Engagement is required');
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim() || null,
      trigger_text: form.triggerText.trim() || null,
      due_date: form.dueDate || null,
      notes: form.notes.trim() || null,
      amount_currency: form.amountCurrency.trim() || null,
    };

    if (form.amountValue.trim().length > 0) {
      const amount = Number(form.amountValue);
      if (!Number.isFinite(amount)) {
        toast.error('Invalid amount value', 'Please enter a valid number');
        return;
      }
      payload.amount_value = amount;
    } else {
      payload.amount_value = null;
    }

    setCreating(true);
    try {
      await api.post(`/billing/engagements/${engagementId}/milestones`, payload);
      setDialogOpen(false);
      setForm(createMilestoneFormState());
      await fetchData();
      toast.success('Milestone added');
    } catch (error) {
      const message = isAxiosError<{ error?: string }>(error)
        ? (error.response?.data?.error ?? 'Please try again')
        : 'Please try again';
      toast.error('Failed to add milestone', message);
    } finally {
      setCreating(false);
    }
  };

  // Loading state
  if (loading && !data) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      </Paper>
    );
  }

  const linked = data?.linked ?? false;

  return (
    <>
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Billing Milestones
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Linked by C/M: {data?.cmNumbers?.length ? data.cmNumbers.join(', ') : 'Not linked'}
            </Typography>
          </Box>
          {canEdit && linked && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              disabled={engagementOptions.length === 0}
            >
              Add Milestone
            </Button>
          )}
        </Stack>

        {/* Summary bar */}
        {linked && summary.total > 0 && (
          <Stack direction="row" spacing={1} mb={2.5} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`${summary.total} milestones`} variant="outlined" />
            <Chip
              size="small"
              label={`${summary.overdueCount} overdue`}
              color={summary.overdueCount > 0 ? 'error' : 'default'}
              variant={summary.overdueCount > 0 ? 'filled' : 'outlined'}
            />
            {summary.overdueCount > 0 && (
              <Chip
                size="small"
                label={`Overdue: ${currencyFormatter.format(summary.overdueAmount)}`}
                variant="outlined"
              />
            )}
            {summary.readyToInvoice > 0 && (
              <Chip
                size="small"
                label={`${summary.readyToInvoice} ready to invoice`}
                color="info"
                variant="filled"
              />
            )}
          </Stack>
        )}

        {/* Empty states */}
        {!linked && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No billing project linked. Link a billing project via C/M number to see milestones.
          </Typography>
        )}

        {linked && summary.total === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No milestones yet.{canEdit ? ' Click "Add Milestone" to create one.' : ''}
          </Typography>
        )}

        {/* Grouped milestone cards */}
        {groups.map((group) => {
          const groupKey = `${group.cmNumber ?? 'unknown'}::${group.engagementId}`;
          const isCollapsed = collapsedGroups.has(groupKey);
          const groupMilestoneCount = group.milestones.length;
          const groupCompletedCount = group.milestones.filter((m) => m.completed).length;

          return (
            <Box key={groupKey} sx={{ mb: 2 }}>
              {/* Group header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 1,
                  px: 0.5,
                  cursor: 'pointer',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  mb: isCollapsed ? 0 : 1.5,
                  '&:hover': { bgcolor: 'action.hover' },
                  borderRadius: 0.5,
                }}
                onClick={() => toggleGroup(groupKey)}
              >
                <IconButton size="small" sx={{ p: 0 }}>
                  {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                </IconButton>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {group.engagementTitle || `Engagement ${group.engagementId}`}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      C/M {group.cmNumber || '--'}
                    </Typography>
                    {group.feeArrangementText && (
                      <Tooltip title={group.feeArrangementText}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {group.feeArrangementText}
                        </Typography>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
                <Chip
                  size="small"
                  label={`${groupCompletedCount}/${groupMilestoneCount}`}
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              </Box>

              {/* Milestone cards */}
              <Collapse in={!isCollapsed}>
                <Box sx={{ pl: 1, pt: 0.5 }}>
                  {group.milestones.map((milestone) => (
                    <MilestoneCard
                      key={milestone.milestoneId}
                      milestone={milestone}
                      canEdit={canEdit && !deletingIds.includes(milestone.milestoneId)}
                      savingStep={savingSteps[milestone.milestoneId] ?? null}
                      onToggleLifecycle={handleToggleLifecycle}
                      onSaveNotes={handleSaveNotes}
                      onEdit={handleOpenEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Paper>

      {/* Create Milestone Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (!creating) {
            setDialogOpen(false);
            setForm(createMilestoneFormState());
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Billing Milestone</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              select
              label="Engagement"
              value={form.engagementId}
              onChange={(e) => setForm((prev) => ({ ...prev, engagementId: e.target.value }))}
              fullWidth
              disabled={creating}
            >
              {engagementOptions.map((option) => (
                <MenuItem key={option.id} value={String(option.id)}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              disabled={creating}
              fullWidth
            />

            <TextField
              label="Trigger description"
              value={form.triggerText}
              onChange={(e) => setForm((prev) => ({ ...prev, triggerText: e.target.value }))}
              disabled={creating}
              fullWidth
              placeholder="What event triggers this milestone?"
              helperText="e.g. Upon filing of A1, Upon listing approval"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Due Date"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                disabled={creating}
                fullWidth
              />
              <TextField
                label="Amount"
                type="number"
                value={form.amountValue}
                onChange={(e) => setForm((prev) => ({ ...prev, amountValue: e.target.value }))}
                inputProps={{ step: '0.01', min: 0 }}
                disabled={creating}
                fullWidth
              />
              <TextField
                label="Currency"
                value={form.amountCurrency}
                onChange={(e) => setForm((prev) => ({ ...prev, amountCurrency: e.target.value }))}
                disabled={creating}
                fullWidth
              />
            </Stack>

            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              multiline
              minRows={2}
              disabled={creating}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!creating) {
                setDialogOpen(false);
                setForm(createMilestoneFormState());
              }
            }}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating || !form.engagementId}
          >
            {creating ? 'Adding...' : 'Add Milestone'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Milestone Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          if (!savingEdit) {
            setEditDialogOpen(false);
            setEditingMilestone(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Milestone</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Title"
              value={editForm.title}
              onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              disabled={savingEdit}
              fullWidth
            />

            <TextField
              label="Trigger description"
              value={editForm.triggerText}
              onChange={(e) => setEditForm((prev) => ({ ...prev, triggerText: e.target.value }))}
              disabled={savingEdit}
              fullWidth
              placeholder="What event triggers this milestone?"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Due Date"
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                disabled={savingEdit}
                fullWidth
              />
              <TextField
                label="Amount"
                type="number"
                value={editForm.amountValue}
                onChange={(e) => setEditForm((prev) => ({ ...prev, amountValue: e.target.value }))}
                inputProps={{ step: '0.01', min: 0 }}
                disabled={savingEdit}
                fullWidth
              />
              <TextField
                label="Currency"
                value={editForm.amountCurrency}
                onChange={(e) => setEditForm((prev) => ({ ...prev, amountCurrency: e.target.value }))}
                disabled={savingEdit}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!savingEdit) {
                setEditDialogOpen(false);
                setEditingMilestone(null);
              }
            }}
            disabled={savingEdit}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={savingEdit}>
            {savingEdit ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProjectMilestonesSection;
