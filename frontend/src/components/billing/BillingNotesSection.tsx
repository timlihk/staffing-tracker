import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  NoteAdd as NoteAddIcon,
  AccountBalance as FinanceIcon,
  Person as PersonIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useBillingNotes, useCreateBillingNote } from '../../hooks/useBilling';
import type { BillingProjectCM } from '../../api/billing';

export interface BillingNotesSectionProps {
  projectId: number;
  cm: BillingProjectCM | null;
  engagementId?: number;
  canEdit: boolean;
}

/**
 * Build a combined finance note from imported Excel fields.
 * Returns null if none of the fields have content.
 */
function buildFinanceNoteContent(cm: BillingProjectCM | null): string | null {
  if (!cm) return null;

  const parts: string[] = [];

  if (cm.matter_notes) {
    parts.push(`Matter Notes: ${cm.matter_notes}`);
  }
  if (cm.finance_remarks) {
    parts.push(`Remarks: ${cm.finance_remarks}`);
  }
  if (cm.unbilled_per_el != null && cm.unbilled_per_el !== '') {
    const val = typeof cm.unbilled_per_el === 'string' ? parseFloat(cm.unbilled_per_el) : cm.unbilled_per_el;
    if (!isNaN(val)) {
      parts.push(`Unbilled per EL: $${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

export function BillingNotesSection({ projectId, cm, engagementId, canEdit }: BillingNotesSectionProps) {
  const { data: notes, isLoading } = useBillingNotes(projectId, engagementId);
  const createNote = useCreateBillingNote();
  const [newNote, setNewNote] = useState('');

  const financeContent = buildFinanceNoteContent(cm);
  const userNotes = notes ?? [];
  const totalCount = userNotes.length + (financeContent ? 1 : 0);

  const handleSubmit = async () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    await createNote.mutateAsync({ projectId, content: trimmed, engagementId });
    setNewNote('');
  };

  return (
    <Paper sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <NoteAddIcon color="action" />
        <Typography variant="h6">Notes</Typography>
        {totalCount > 0 && (
          <Chip label={totalCount} size="small" variant="outlined" />
        )}
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Stack spacing={0}>
          {/* Finance Team imported note */}
          {financeContent && (
            <NoteItem
              authorName="Finance Team"
              timestamp="Imported from billing data"
              content={financeContent}
              icon={<FinanceIcon fontSize="small" color="warning" />}
            />
          )}

          {financeContent && userNotes.length > 0 && <Divider sx={{ my: 1 }} />}

          {/* User-created notes */}
          {userNotes.map((note, idx) => (
            <Box key={note.id}>
              {idx > 0 && <Divider sx={{ my: 1 }} />}
              <NoteItem
                authorName={note.author_name}
                timestamp={new Date(note.created_at).toLocaleString()}
                content={note.content}
                icon={<PersonIcon fontSize="small" color="primary" />}
              />
            </Box>
          ))}

          {!financeContent && userNotes.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No notes yet.
            </Typography>
          )}
        </Stack>
      )}

      {/* Add note form */}
      {canEdit && (
        <Stack direction="row" spacing={1} alignItems="flex-start" mt={2}>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={1}
            maxRows={4}
            placeholder="Add a note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={createNote.isPending}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleSubmit}
            disabled={!newNote.trim() || createNote.isPending}
            sx={{ minWidth: 'auto', px: 2, height: 40 }}
          >
            {createNote.isPending ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
          </Button>
        </Stack>
      )}
    </Paper>
  );
}

function NoteItem({
  authorName,
  timestamp,
  content,
  icon,
}: {
  authorName: string;
  timestamp: string;
  content: string;
  icon: React.ReactNode;
}) {
  return (
    <Box sx={{ py: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
        {icon}
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {authorName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {timestamp}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line', pl: 4 }}>
        {content}
      </Typography>
    </Box>
  );
}
