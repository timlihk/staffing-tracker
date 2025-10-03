import { ReactNode } from 'react';
import { Box, Paper } from '@mui/material';

interface PageProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Page({ children }: PageProps) {
  return (
    <Box sx={{ display: 'grid', gap: 2, width: '100%', maxWidth: '100%' }}>
      <Box sx={{ display: 'grid', gap: 2, width: '100%', maxWidth: '100%' }}>{children}</Box>
    </Box>
  );
}

interface SectionProps {
  children: ReactNode;
}

export function Section({ children }: SectionProps) {
  return <Paper sx={{ p: 2 }}>{children}</Paper>;
}
