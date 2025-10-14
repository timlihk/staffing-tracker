import { ReactNode } from 'react';
import { Box, Paper, SxProps, Theme, Typography } from '@mui/material';

interface PageProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Page({ children }: PageProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        width: '100%',
        maxWidth: { xs: '100%', lg: 1280 },
        mx: 'auto',
        px: { xs: 2.5, md: 4 },
        pb: { xs: 6, md: 8 },
      }}
    >
      {children}
    </Box>
  );
}

interface SectionProps {
  children: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  sx?: SxProps<Theme>;
}

export function Section({ children, title, actions, sx }: SectionProps) {
  return (
    <Paper
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: (theme) => theme.shape.borderRadius,
        backgroundImage: 'none',
        ...sx,
      }}
    >
      {(title || actions) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
            gap: 2,
          }}
        >
          {typeof title === 'string' ? (
            <Typography variant="h6" fontWeight={700}>
              {title}
            </Typography>
          ) : (
            title
          )}
          {actions}
        </Box>
      )}
      {children}
    </Paper>
  );
}
