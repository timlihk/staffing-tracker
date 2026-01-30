import { ReactNode } from 'react';
import { Stack } from '@mui/material';

interface PageToolbarProps {
  children: ReactNode;
}

const PageToolbar = ({ children }: PageToolbarProps) => (
  <Stack
    direction="row"
    spacing={2}
    flexWrap="wrap"
    alignItems="center"
    className="page-toolbar"
    sx={{ 
      rowGap: 1.5, 
      width: '100%',
      '@media print': {
        display: 'none !important',
      },
    }}
  >
    {children}
  </Stack>
);

export default PageToolbar;
