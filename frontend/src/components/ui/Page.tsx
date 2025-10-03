import * as React from 'react';
import { Box, Paper } from '@mui/material';

interface PageProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function Page({ title: _title, actions: _actions, children }: PageProps) {
  return (
    <Box sx={{ display: 'grid', gap: 2, width: '100%', maxWidth: '100%' }}>
      <Box sx={{ display: 'grid', gap: 2, width: '100%', maxWidth: '100%' }}>{children}</Box>
    </Box>
  );
}

interface SectionProps {
  children: React.ReactNode;
}

export function Section({ children }: SectionProps) {
  return <Paper sx={{ p: 2 }}>{children}</Paper>;
}
