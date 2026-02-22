import { ReactNode } from 'react';
import { Box, Paper, SxProps, Theme, Typography, alpha } from '@mui/material';
import { tokens } from '../../theme';

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
        gap: { xs: 2.5, md: 3.5 },
        width: '100%',
        maxWidth: { xs: '100%', lg: 1400 },
        mx: 'auto',
        px: { xs: 1, md: 0 },
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
  variant?: 'default' | 'glass' | 'elevated';
}

export function Section({ children, title, actions, sx, variant = 'default' }: SectionProps) {
  const { colors, gradients } = tokens;

  const variantStyles = {
    default: {
      backgroundColor: '#FFFFFF',
      border: `1px solid ${colors.slate[200]}`,
      boxShadow: tokens.shadows.md,
    },
    glass: {
      backgroundColor: alpha('#FFFFFF', 0.8),
      backdropFilter: 'blur(12px)',
      border: `1px solid ${alpha('#FFFFFF', 0.6)}`,
      boxShadow: tokens.shadows.md,
    },
    elevated: {
      backgroundColor: '#FFFFFF',
      border: `1px solid ${colors.slate[200]}`,
      boxShadow: tokens.shadows.lg,
    },
  };

  return (
    <Paper
      sx={{
        p: { xs: 2.5, md: 3.5 },
        borderRadius: 3,
        transition: 'all 0.25s ease',
        ...variantStyles[variant],
        '&:hover': {
          boxShadow: tokens.shadows.lg,
          transform: 'translateY(-1px)',
        },
        ...sx,
      }}
    >
      {(title || actions) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            mb: 3,
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          {typeof title === 'string' ? (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: colors.slate[800],
                letterSpacing: '-0.02em',
              }}
            >
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

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | false;
  sx?: SxProps<Theme>;
}

export function PageContainer({ children, maxWidth = 'xl', sx }: PageContainerProps) {
  const maxWidths = {
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1400,
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: maxWidth ? { xs: '100%', lg: maxWidths[maxWidth] } : 'none',
        mx: 'auto',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}

export function GradientHeader({ title, subtitle, icon }: GradientHeaderProps) {
  const { colors, gradients } = tokens;

  return (
    <Box
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: 3,
        background: gradients.primary,
        color: '#FFFFFF',
        mb: 3,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at top right, rgba(255,255,255,0.15) 0%, transparent 50%)',
        },
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            mb: subtitle ? 1 : 0,
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="body1"
            sx={{
              color: alpha('#FFFFFF', 0.85),
              fontWeight: 500,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
