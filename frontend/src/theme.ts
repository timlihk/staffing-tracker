import { createTheme, alpha } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark' = 'light') => {
  const isDark = mode === 'dark';

  const brand = {
    main: '#2563EB',     // Modern blue
    dark: '#1E40AF',
    light: '#60A5FA',
  };

  return createTheme({
    palette: {
      mode,
      primary: {
        main: brand.main,
        dark: brand.dark,
        light: brand.light,
      },
      secondary: { main: '#10B981' }, // Emerald green
      error: { main: '#EF4444' },
      warning: { main: '#F59E0B' },
      info: { main: '#3B82F6' },
      success: { main: '#10B981' },
      background: {
        default: isDark ? '#0F172A' : '#F8FAFC',
        paper: isDark ? '#1E293B' : '#FFFFFF',
      },
      divider: isDark ? alpha('#94A3B8', 0.2) : '#E2E8F0',
      text: {
        primary: isDark ? '#F1F5F9' : '#0F172A',
        secondary: isDark ? '#CBD5E1' : '#64748B',
      },
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: {
        fontWeight: 700,
        letterSpacing: -0.5,
        fontSize: '2.5rem',
      },
      h2: {
        fontWeight: 700,
        letterSpacing: -0.5,
        fontSize: '2rem',
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.75rem',
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.5rem',
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.25rem',
      },
      h6: {
        fontWeight: 600,
        fontSize: '1rem',
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.875rem',
      },
      subtitle1: {
        fontWeight: 600,
        fontSize: '1rem',
      },
      body1: {
        fontSize: '0.875rem',
      },
      body2: {
        fontSize: '0.8125rem',
      },
    },
    shape: {
      borderRadius: 12,
    },
    shadows: [
      'none',
      isDark
        ? '0 1px 2px 0 rgba(0, 0, 0, 0.4)'
        : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      isDark
        ? '0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px -1px rgba(0, 0, 0, 0.5)'
        : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
      isDark
        ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5)'
        : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      isDark
        ? '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5)'
        : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      isDark
        ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
        : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      ...Array(19).fill(isDark
        ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
        : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
      ),
    ],
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
            scrollbarColor: `${isDark ? '#475569' : '#CBD5E1'} transparent`,
          },
          '*::-webkit-scrollbar': {
            height: 8,
            width: 8,
          },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? '#475569' : '#CBD5E1',
            borderRadius: 8,
            '&:hover': {
              backgroundColor: isDark ? '#64748B' : '#94A3B8',
            },
          },
          '*:focus-visible': {
            outline: 'none',
            boxShadow: `0 0 0 3px ${alpha(brand.main, 0.4)}`,
            borderRadius: 4,
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 16,
            border: `1px solid ${theme.palette.divider}`,
            backgroundImage: 'none',
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none',
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
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            paddingInline: 20,
            paddingBlock: 10,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
          contained: {
            boxShadow: `0 4px 14px 0 ${alpha(brand.main, 0.25)}`,
            '&:hover': {
              boxShadow: `0 6px 20px 0 ${alpha(brand.main, 0.35)}`,
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${brand.main} 0%, ${brand.dark} 100%)`,
            '&:hover': {
              background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.main} 100%)`,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.75rem',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
            },
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.mode === 'dark' ? alpha('#1E293B', 0.5) : '#F8FAFC',
            '& .MuiTableCell-root': {
              fontWeight: 700,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: theme.palette.text.secondary,
              borderBottom: `1px solid ${theme.palette.divider}`,
            },
          }),
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: '1px solid',
            borderColor: 'divider',
          },
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
              backgroundColor: alpha(brand.main, 0.12),
              '&:hover': {
                backgroundColor: alpha(brand.main, 0.18),
              },
            },
          },
        },
      },
    },
  });
};
