import { Box, Button, Stack, Typography } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';

export interface MilestoneReferenceSectionProps {
  referenceText: string | null | undefined;
  saving: boolean;
  onEdit: () => void;
}

/**
 * Displays milestone reference text with an edit button
 */
export function MilestoneReferenceSection({ referenceText, saving, onEdit }: MilestoneReferenceSectionProps) {
  const hasText = Boolean(referenceText && referenceText.trim());

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
        <Typography variant="subtitle2" color="text.secondary">
          Milestone Reference Text
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditIcon fontSize="small" />}
          onClick={onEdit}
          disabled={saving}
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
        {hasText ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {referenceText?.trim()}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No reference text captured yet.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
