import { Box, Typography, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title = 'Nothing here yet',
  subtitle = 'Create your first record to get started.',
  actionLabel = 'Create',
  onAction,
}: EmptyStateProps) {
  return (
    <Box sx={{ p: 6, textAlign: 'center' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {subtitle}
      </Typography>
      {onAction && (
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
