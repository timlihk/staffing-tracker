import { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => {
  const renderTitle =
    typeof title === 'string' ? (
      <Typography variant="h3" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
    ) : (
      title
    );

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      sx={{ mb: { xs: 2.5, md: 3 } }}
    >
      <Stack spacing={0.5} alignItems={{ xs: 'flex-start', sm: 'flex-start' }}>
        <Box>{renderTitle}</Box>
        {subtitle && (
          <Typography variant="subtitle1" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Stack>
      {actions && <Box>{actions}</Box>}
    </Stack>
  );
};

export default PageHeader;
