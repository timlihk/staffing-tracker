import { type ReactNode } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';

export interface InfoFieldProps {
  label: string;
  value: ReactNode;
  loading?: boolean;
}

/**
 * Reusable info field component for displaying label-value pairs with loading state
 */
export function InfoField({ label, value, loading }: InfoFieldProps) {
  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" width={120} sx={{ mt: 0.5 }} />
      ) : (
        <Typography variant="body1" sx={{ mt: 0.5 }}>
          {value ?? '—'}
        </Typography>
      )}
    </Box>
  );
}
