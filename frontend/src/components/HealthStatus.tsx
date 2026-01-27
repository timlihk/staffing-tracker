import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { useHealthCheck } from '../hooks/useHealthCheck';

export const HealthStatus: React.FC = () => {
  const { isHealthy, isChecking, lastChecked, error, checkHealth } = useHealthCheck();

  if (isHealthy) return null;

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999 }}>
      <Alert 
        severity="error" 
        action={
          <Button 
            color="inherit" 
            size="small" 
            onClick={checkHealth}
            disabled={isChecking}
          >
            Retry
          </Button>
        }
      >
        <Typography variant="body2">
          Server connection issue. {error}
        </Typography>
        {lastChecked && (
          <Typography variant="caption" display="block">
            Last checked: {lastChecked.toLocaleTimeString()}
          </Typography>
        )}
      </Alert>
    </Box>
  );
};
