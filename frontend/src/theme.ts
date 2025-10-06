import { createTheme } from '@mui/material/styles';
import { alpha } from '@mui/material';

export const getTheme = (mode: 'light' | 'dark' = 'light') => {
  const isDark = mode === 'dark';

  // Lovable Design Tokens
  const brand = {
    primary: '#2563EB',
    secondary: '#14B8A6',
    neutral: {
      0: '#FFFFFF',
      100: '#F8FAFC',
      200: '#F1F5F9',
      300: '#E2E8F0',
      400: '#CBD5F1',
      500: '#94A3B8',
      600: '#64748B',
      700: '#475569',
      800: '#1E293B',
      900: '#0F172A',
    },
  };

  return createTheme({
    palette: {
      mode,
      primary: { main: brand.primary },
      secondary: { main: brand.secondary },
      success: { main: '#22C55E' },
      warning: { main: '#F59E0B' },
      error: { main: '#EF4444' },
      info: { main: '#38BDF8' },
      background: {
        default: isDark ? brand.neutral[900] : brand.neutral[100],
        paper: isDark ? alpha('#0F172A', 0.92) : brand.neutral[0],
      },
      text: {
        primary: isDark ? brand.neutral[100] : brand.neutral[900],
        secondary: isDark ? alpha(brand.neutral[100], 0.72) : brand.neutral[600],
      },
      divider: isDark ? alpha(brand.neutral[500], 0.2) : brand.neutral[200],
    },
    typography: {
      fontFamily:
        '"Inter", "SF Pro Text", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: { fontWeight: 700, fontSize: '2.75rem', letterSpacing: '-0.032em', lineHeight: 1.1 },
      h2: { fontWeight: 700, fontSize: '2.125rem', letterSpacing: '-0.02em', lineHeight: 1.2 },
      h3: { fontWeight: 600, fontSize: '1.75rem', letterSpacing: '-0.015em', lineHeight: 1.25 },
      h4: { fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.01em', lineHeight: 1.3 },
      h5: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
      h6: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4 },
      subtitle1: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5, color: isDark ? alpha(brand.neutral[100], 0.8) : brand.neutral[600] },
      subtitle2: { fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.45, color: isDark ? alpha(brand.neutral[100], 0.7) : brand.neutral[500] },
      body1: { lineHeight: 1.6, fontSize: '1rem' },
      body2: { lineHeight: 1.55, fontSize: '0.95rem', color: isDark ? alpha(brand.neutral[100], 0.72) : brand.neutral[600] },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '-0.01em' },
      caption: { fontSize: '0.8rem', lineHeight: 1.4, color: isDark ? alpha(brand.neutral[100], 0.6) : brand.neutral[500] },
    },
    shape: { borderRadius: 16 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          'html, body, #root': { height: '100%' },
          body: {
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            scrollbarWidth: 'thin',
            scrollbarColor: `${isDark ? '#374151' : '#CBD5E1'} transparent`,
          },
          '*::-webkit-scrollbar': { height: 8, width: 8 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? '#374151' : '#CBD5E1',
            borderRadius: 8,
          },
          '*:focus-visible': {
            outline: 'none',
            boxShadow: `0 0 0 3px ${alpha(brand.primary, 0.35)}`,
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
          root: ({ theme }) => ({
            borderRadius: 12,
            border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.5 : 0.8)}`,
            backgroundImage: 'none',
            boxShadow: 'none',
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            paddingInline: 18,
            paddingBlock: 9,
            transition: 'all 200ms ease',
          },
          containedPrimary: {
            boxShadow: '0 14px 30px rgba(37, 99, 235, 0.22)',
            '&:hover': {
              boxShadow: '0 18px 40px rgba(37, 99, 235, 0.28)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
      },
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            background: theme.palette.mode === 'dark' ? '#0F172A' : '#F1F5F9',
            '& .MuiTableCell-root': { fontWeight: 700 },
          }),
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundImage: 'none',
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(20px)',
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            paddingBlock: 10,
            paddingInline: 14,
            transition: 'all 200ms ease',
            '&.Mui-selected': {
              backgroundColor: alpha(brand.primary, 0.12),
              '&:hover': {
                backgroundColor: alpha(brand.primary, 0.18),
              },
            },
          },
        },
      },
    },
  });
};
