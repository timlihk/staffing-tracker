import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LifecycleStepper from './LifecycleStepper';
import type { ProjectBillingMilestoneRow, LifecycleStep } from '../../types/projectBilling';

interface MilestoneCardProps {
  milestone: ProjectBillingMilestoneRow;
  canEdit: boolean;
  savingStep: LifecycleStep | null;
  onToggleLifecycle: (milestoneId: number, step: LifecycleStep) => void;
  onSaveNotes: (milestoneId: number, notes: string) => void;
  onEdit: (milestone: ProjectBillingMilestoneRow) => void;
  onDelete: (milestoneId: number) => void;
}

const formatAmount = (value: number | null, currency: string | null): string => {
  if (value == null) return '';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'USD'} ${value.toLocaleString()}`;
  }
};

const formatDueDate = (date: string | null): string => {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return date.slice(0, 10);
  }
};

const daysOverdue = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
};

const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  canEdit,
  savingStep,
  onToggleLifecycle,
  onSaveNotes,
  onEdit,
  onDelete,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(milestone.notes ?? '');
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Sync external notes changes
  useEffect(() => {
    if (!editingNotes) {
      setNotesValue(milestone.notes ?? '');
    }
  }, [milestone.notes, editingNotes]);

  const handleNotesBlur = () => {
    setEditingNotes(false);
    const trimmed = notesValue.trim();
    const original = (milestone.notes ?? '').trim();
    if (trimmed !== original) {
      onSaveNotes(milestone.milestoneId, trimmed);
    }
  };

  const handleNotesClick = () => {
    if (!canEdit) return;
    setEditingNotes(true);
    setTimeout(() => notesRef.current?.focus(), 0);
  };

  const overdue = milestone.milestoneStatus === 'overdue' ? daysOverdue(milestone.dueDate) : null;
  const amountStr = formatAmount(milestone.amountValue, milestone.amountCurrency);
  const ordinalLabel = milestone.ordinal != null ? `#${milestone.ordinal}` : '';

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5 }}>
      {/* Row 1: Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {ordinalLabel && (
              <Box
                component="span"
                sx={{
                  bgcolor: 'action.hover',
                  borderRadius: 0.5,
                  px: 0.75,
                  py: 0.25,
                  mr: 1,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {ordinalLabel}
              </Box>
            )}
            {milestone.title || 'Untitled milestone'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, flexShrink: 0 }}>
          {amountStr && (
            <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {amountStr}
            </Typography>
          )}
          {canEdit && (
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Row 2: Trigger text */}
      {milestone.triggerText && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {milestone.triggerText}
        </Typography>
      )}

      {/* Row 3: Due date + overdue badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        {milestone.dueDate ? (
          <Typography variant="caption" color="text.secondary">
            Due {formatDueDate(milestone.dueDate)}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.disabled">
            No due date
          </Typography>
        )}
        {overdue != null && (
          <Chip
            size="small"
            color="error"
            variant="filled"
            label={`${overdue}d overdue`}
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        )}
      </Box>

      {/* Row 4: Lifecycle stepper */}
      <LifecycleStepper
        completed={milestone.completed}
        completionDate={milestone.completionDate}
        invoiceSentDate={milestone.invoiceSentDate}
        paymentReceivedDate={milestone.paymentReceivedDate}
        disabled={!canEdit}
        savingStep={savingStep}
        onToggle={(step) => onToggleLifecycle(milestone.milestoneId, step)}
      />

      {/* Row 5: Notes */}
      <Box sx={{ mt: 0.5 }}>
        {editingNotes ? (
          <TextField
            inputRef={notesRef}
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            onBlur={handleNotesBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setNotesValue(milestone.notes ?? '');
                setEditingNotes(false);
              }
            }}
            multiline
            minRows={1}
            maxRows={4}
            fullWidth
            size="small"
            placeholder="Add notes..."
            sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
          />
        ) : (
          <Typography
            variant="caption"
            onClick={handleNotesClick}
            sx={{
              color: milestone.notes ? 'text.secondary' : 'text.disabled',
              cursor: canEdit ? 'pointer' : 'default',
              fontStyle: milestone.notes ? 'normal' : 'italic',
              '&:hover': canEdit ? { color: 'text.primary' } : {},
              display: 'block',
              whiteSpace: 'pre-wrap',
            }}
          >
            {milestone.notes || (canEdit ? 'Add notes...' : '')}
          </Typography>
        )}
      </Box>

      {/* Overflow menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onEdit(milestone);
          }}
        >
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit details</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onDelete(milestone.milestoneId);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default MilestoneCard;
