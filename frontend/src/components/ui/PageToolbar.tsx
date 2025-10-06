import { ReactNode } from 'react';
import { Stack } from '@mui/material';

interface PageToolbarProps {
  children: ReactNode;
}

const PageToolbar = ({ children }: PageToolbarProps) => (
  <Stack
    direction="row"
    spacing={1.5}
    flexWrap="wrap"
    alignItems="center"
    sx={{ rowGap: 1.5, width: '100%' }}
  >
    {children}
  </Stack>
);

export default PageToolbar;
