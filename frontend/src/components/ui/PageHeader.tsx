import { ReactNode } from 'react';
import { Box, Stack, Typography, alpha } from '@mui/material';
import { tokens } from '../../theme';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  variant?: 'default' | 'centered' | 'compact';
}

const PageHeader = ({ title, subtitle, actions, variant = 'default' }: PageHeaderProps) => {
  const { colors } = tokens;

  const renderTitle =
    typeof title === 'string' ? (
      <Typography
        variant="h3"
        sx={{
          fontWeight: 800,
          color: colors.slate[900],
          letterSpacing: '-0.03em',
          lineHeight: 1.2,
        }}
      >
        {title}
      </Typography>
    ) : (
      title
    );

  const renderSubtitle =
    typeof subtitle === 'string' ? (
      <Typography
        variant="body1"
        sx={{
          color: colors.slate[500],
          fontWeight: 500,
          fontSize: '1rem',
        }}
      >
        {subtitle}
      </Typography>
    ) : (
      subtitle
    );

  if (variant === 'centered') {
    return (
      <Stack
        spacing={1.5}
        alignItems="center"
        textAlign="center"
        sx={{ mb: { xs: 3, md: 4 }, width: '100%' }}
      >
        <Box>{renderTitle}</Box>
        {subtitle && <Box>{renderSubtitle}</Box>}
        {actions && <Box sx={{ mt: 2 }}>{actions}</Box>}
      </Stack>
    );
  }

  if (variant === 'compact') {
    return (
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2.5 }}
      >
        <Stack spacing={0.25}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: colors.slate[800],
              letterSpacing: '-0.02em',
            }}
          >
            {typeof title === 'string' ? title : title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              sx={{
                color: colors.slate[500],
                fontWeight: 500,
              }}
            >
              {typeof subtitle === 'string' ? subtitle : subtitle}
            </Typography>
          )}
        </Stack>
        {actions && <Box>{actions}</Box>}
      </Stack>
    );
  }

  // Default variant
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      sx={{ mb: { xs: 3, md: 4 } }}
    >
      <Stack spacing={0.75} alignItems={{ xs: 'flex-start', sm: 'flex-start' }}>
        <Box>{renderTitle}</Box>
        {subtitle && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&::before': {
                content: '""',
                width: 4,
                height: 4,
                borderRadius: '50%',
                backgroundColor: colors.indigo[400],
                display: subtitle ? 'inline-block' : 'none',
              },
            }}
          >
            {renderSubtitle}
          </Box>
        )}
      </Stack>
      {actions && (
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          }}
        >
          {actions}
        </Box>
      )}
    </Stack>
  );
};

export default PageHeader;
