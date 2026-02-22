import { createTheme } from '@mui/material/styles';
import { alpha } from '@mui/material';

// Modern Design Tokens
const tokens = {
  colors: {
    // Primary gradient colors
    indigo: {
      50: '#EEF2FF',
      100: '#E0E7FF',
      200: '#C7D2FE',
      300: '#A5B4FC',
      400: '#818CF8',
      500: '#6366F1',
      600: '#4F46E5',
      700: '#4338CA',
      800: '#3730A3',
      900: '#312E81',
    },
    violet: {
      400: '#A78BFA',
      500: '#8B5CF6',
      600: '#7C3AED',
    },
    cyan: {
      400: '#22D3EE',
      500: '#06B6D4',
    },
    // Semantic colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    // Neutral slate scale
    slate: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },
  gradients: {
    primary: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #06B6D4 100%)',
    success: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
    warm: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    subtle: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
    glass: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)',
  },
  shadows: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.05)',
    md: '0 4px 20px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.02)',
    lg: '0 10px 40px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.03)',
    glow: '0 0 40px rgba(99, 102, 241, 0.15)',
    colored: '0 10px 40px -10px rgba(99, 102, 241, 0.4)',
  },
};

export const getTheme = (mode: 'light' | 'dark' = 'light') => {
  const isDark = mode === 'dark';
  const { colors, gradients, shadows } = tokens;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.indigo[500],
        light: colors.indigo[400],
        dark: colors.indigo[600],
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: colors.violet[500],
        light: colors.violet[400],
        dark: colors.violet[600],
      },
      success: {
        main: colors.success,
        light: '#34D399',
        dark: '#059669',
      },
      warning: {
        main: colors.warning,
        light: '#FBBF24',
        dark: '#D97706',
      },
      error: {
        main: colors.error,
        light: '#F87171',
        dark: '#DC2626',
      },
      info: {
        main: colors.info,
        light: '#60A5FA',
        dark: '#2563EB',
      },
      background: {
        default: colors.slate[50],
        paper: '#FFFFFF',
      },
      text: {
        primary: colors.slate[900],
        secondary: colors.slate[500],
      },
      divider: colors.slate[200],
    },
    typography: {
      fontFamily:
        '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: {
        fontWeight: 800,
        fontSize: '2.5rem',
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
        color: colors.slate[900],
      },
      h2: {
        fontWeight: 700,
        fontSize: '2rem',
        letterSpacing: '-0.025em',
        lineHeight: 1.2,
        color: colors.slate[900],
      },
      h3: {
        fontWeight: 700,
        fontSize: '1.5rem',
        letterSpacing: '-0.02em',
        lineHeight: 1.25,
        color: colors.slate[800],
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.25rem',
        letterSpacing: '-0.01em',
        lineHeight: 1.3,
        color: colors.slate[800],
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.125rem',
        lineHeight: 1.4,
        color: colors.slate[800],
      },
      h6: {
        fontWeight: 600,
        fontSize: '1rem',
        lineHeight: 1.4,
        color: colors.slate[800],
      },
      subtitle1: {
        fontWeight: 600,
        fontSize: '0.9375rem',
        lineHeight: 1.5,
        color: colors.slate[600],
      },
      subtitle2: {
        fontWeight: 500,
        fontSize: '0.875rem',
        lineHeight: 1.45,
        color: colors.slate[500],
      },
      body1: {
        fontSize: '0.9375rem',
        lineHeight: 1.6,
        color: colors.slate[600],
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.55,
        color: colors.slate[500],
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.9375rem',
        letterSpacing: '-0.01em',
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.4,
        fontWeight: 500,
        color: colors.slate[400],
      },
    },
    shape: {
      borderRadius: 16,
    },
    spacing: 8,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          'html, body, #root': {
            height: '100%',
          },
          body: {
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.slate[300]} transparent`,
            background: `${colors.slate[50]}`,
          },
          '*::-webkit-scrollbar': {
            height: 8,
            width: 8,
          },
          '*::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: colors.slate[300],
            borderRadius: 8,
            border: '2px solid transparent',
            backgroundClip: 'content-box',
          },
          '*:focus-visible': {
            outline: 'none',
            boxShadow: `0 0 0 3px ${alpha(colors.indigo[500], 0.25)}`,
          },
          '@media print': {
            '.MuiAppBar-root, .MuiDrawer-root, .no-print': {
              display: 'none !important',
            },
            '.print-only': { display: 'block !important' },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none',
            border: `1px solid ${colors.slate[200]}`,
            boxShadow: shadows.md,
            transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            '&:hover': {
              boxShadow: shadows.lg,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            padding: '10px 24px',
            transition: 'all 0.2s ease',
          },
          containedPrimary: {
            background: gradients.primary,
            boxShadow: `${shadows.colored}, inset 0 1px 0 rgba(255,255,255,0.2)`,
            '&:hover': {
              boxShadow: `${shadows.colored}, 0 6px 20px rgba(99, 102, 241, 0.4)`,
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          },
          containedSecondary: {
            background: gradients.success,
            boxShadow: `0 10px 40px -10px rgba(16, 185, 129, 0.4)`,
            '&:hover': {
              boxShadow: `0 10px 40px -10px rgba(16, 185, 129, 0.6)`,
              transform: 'translateY(-1px)',
            },
          },
          outlined: {
            borderWidth: 1.5,
            borderColor: colors.slate[200],
            backgroundColor: '#FFFFFF',
            '&:hover': {
              borderColor: colors.indigo[300],
              backgroundColor: colors.indigo[50],
            },
          },
          text: {
            color: colors.slate[600],
            '&:hover': {
              backgroundColor: alpha(colors.slate[500], 0.08),
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'all 0.15s ease',
            '&:hover': {
              backgroundColor: alpha(colors.slate[500], 0.08),
              transform: 'scale(1.05)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.8125rem',
            height: 28,
          },
          filled: {
            backgroundColor: colors.slate[100],
            color: colors.slate[700],
          },
          filledPrimary: {
            background: alpha(colors.indigo[500], 0.12),
            color: colors.indigo[700],
          },
          filledSuccess: {
            background: alpha(colors.success, 0.12),
            color: '#059669',
          },
          filledWarning: {
            background: alpha(colors.warning, 0.12),
            color: '#B45309',
          },
          filledError: {
            background: alpha(colors.error, 0.12),
            color: '#DC2626',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            background: gradients.subtle,
            '& .MuiTableCell-root': {
              fontWeight: 700,
              color: colors.slate[700],
              fontSize: '0.8125rem',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${colors.slate[200]}`,
            padding: '16px 20px',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
              transition: 'all 0.2s ease',
              '& fieldset': {
                borderColor: colors.slate[200],
                borderWidth: 1.5,
              },
              '&:hover fieldset': {
                borderColor: colors.slate[300],
              },
              '&.Mui-focused fieldset': {
                borderColor: colors.indigo[500],
                borderWidth: 1.5,
              },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          outlined: {
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: alpha(colors.slate[50], 0.8),
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${colors.slate[200]}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: alpha('#FFFFFF', 0.95),
            backdropFilter: 'blur(20px)',
            borderRight: `1px solid ${colors.slate[200]}`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            paddingBlock: 10,
            paddingInline: 14,
            marginBottom: 4,
            transition: 'all 0.2s ease',
            color: colors.slate[500],
            '&:hover': {
              backgroundColor: alpha(colors.slate[500], 0.06),
              color: colors.slate[700],
            },
            '&.Mui-selected': {
              background: alpha(colors.indigo[500], 0.1),
              color: colors.indigo[600],
              '& .MuiListItemIcon-root': {
                color: colors.indigo[500],
              },
              '&:hover': {
                background: alpha(colors.indigo[500], 0.15),
              },
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 40,
            color: 'inherit',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: colors.slate[200],
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            fontWeight: 500,
          },
          filledSuccess: {
            background: gradients.success,
          },
          filledError: {
            background: gradients.warm,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            boxShadow: shadows.lg,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: colors.slate[800],
            borderRadius: 8,
            fontSize: '0.8125rem',
            fontWeight: 500,
            padding: '8px 12px',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: colors.slate[200],
          },
          bar: {
            borderRadius: 4,
            background: gradients.primary,
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: {
            backgroundColor: colors.slate[200],
            borderRadius: 8,
          },
        },
      },
      MuiBadge: {
        styleOverrides: {
          badge: {
            fontWeight: 600,
            fontSize: '0.6875rem',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            boxShadow: shadows.lg,
            border: `1px solid ${colors.slate[200]}`,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '2px 8px',
            padding: '10px 14px',
            fontWeight: 500,
            '&:hover': {
              backgroundColor: alpha(colors.indigo[500], 0.08),
            },
            '&.Mui-selected': {
              backgroundColor: alpha(colors.indigo[500], 0.12),
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9375rem',
            color: colors.slate[500],
            '&.Mui-selected': {
              color: colors.indigo[600],
            },
          },
        },
      },
    },
  });
};

// Export tokens for use in components
export { tokens };
