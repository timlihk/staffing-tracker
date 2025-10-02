import * as React from 'react';
import { Box, Paper, Typography, Stack } from '@mui/material';

interface PageProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function Page({ title, actions, children }: PageProps) {
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Paper sx={{ p: 2 }} className="no-print">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 700, mr: 'auto' }}>
            {title}
          </Typography>
          {actions}
        </Stack>
      </Paper>
      <Box sx={{ display: 'grid', gap: 2 }}>{children}</Box>
    </Box>
  );
}

interface SectionProps {
  children: React.ReactNode;
}

export function Section({ children }: SectionProps) {
  return <Paper sx={{ p: 2 }}>{children}</Paper>;
}
