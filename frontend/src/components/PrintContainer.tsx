import React from 'react';
import { Box, Typography, Divider } from '@mui/material';

interface PrintContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showTimestamp?: boolean;
}

/**
 * Container component that provides print-friendly layout
 * Shows additional information when printing (title, timestamp, etc.)
 */
export const PrintContainer: React.FC<PrintContainerProps> = ({
  title,
  subtitle,
  children,
  showTimestamp = true,
}) => {
  const timestamp = new Date().toLocaleString();

  return (
    <Box>
      {/* Print-only header */}
      <Box
        className="print-only"
        sx={{
          display: 'none',
          '@media print': {
            display: 'block',
            mb: 3,
          },
        }}
      >
        <Typography variant="h4" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {subtitle}
          </Typography>
        )}
        {showTimestamp && (
          <Typography variant="caption" color="text.secondary">
            Generated: {timestamp}
          </Typography>
        )}
        <Divider sx={{ mt: 2 }} />
      </Box>

      {/* Main content */}
      {children}

      {/* Print-only footer */}
      <Box
        className="print-only"
        sx={{
          display: 'none',
          '@media print': {
            display: 'block',
            mt: 4,
            pt: 2,
            borderTop: '1px solid #ccc',
          },
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Kirkland & Ellis - Capital Markets Staffing Tracker
        </Typography>
      </Box>
    </Box>
  );
};

export default PrintContainer;
