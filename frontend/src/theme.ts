import { createTheme } from '@mui/material/styles';
import { alpha } from '@mui/material';

export const getTheme = (mode: 'light' | 'dark' = 'light') => {
  const isDark = mode === 'dark';

  // Lovable Design Tokens
  const brand = {
    primary: '#3B82F6',
    secondary: '#10B981',
  };

  return createTheme({
    palette: {
      mode,
      primary: { main: brand.primary },
      secondary: { main: brand.secondary },
      background: {
        default: isDark ? '#0B1220' : '#F7F8FB',
        paper: isDark ? '#111827' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#E5E7EB' : '#0F172A',
        secondary: isDark ? '#CBD5E1' : '#475569',
      },
      divider: isDark ? alpha('#9CA3AF', 0.3) : '#E5E7EB',
    },
    typography: {
      fontFamily:
        '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: { fontWeight: 700, letterSpacing: '-0.5px' },
      h2: { fontWeight: 700, letterSpacing: '-0.5px' },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.1px' },
      subtitle1: { fontWeight: 600 },
      body1: { lineHeight: 1.6 },
      body2: { lineHeight: 1.6 },
    },
    shape: { borderRadius: 12 },
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
            border: `1px solid ${theme.palette.divider}`,
            backgroundImage: 'none',
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 10, paddingInline: 16, paddingBlock: 8 },
          containedPrimary: { boxShadow: '0 6px 20px rgba(59,130,246,0.28)' },
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
            borderRadius: 10,
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
