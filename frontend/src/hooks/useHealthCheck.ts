import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

interface HealthStatus {
  isHealthy: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  error: string | null;
}

export const useHealthCheck = (intervalMs = 30000) => {
  const [status, setStatus] = useState<HealthStatus>({
    isHealthy: true,
    isChecking: false,
    lastChecked: null,
    error: null,
  });

  const checkHealth = useCallback(async () => {
    setStatus(prev => ({ ...prev, isChecking: true }));
    
    try {
      const response = await api.get('/health', { timeout: 5000 });
      setStatus({
        isHealthy: response.data.status === 'ok',
        isChecking: false,
        lastChecked: new Date(),
        error: null,
      });
    } catch (error) {
      setStatus({
        isHealthy: false,
        isChecking: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, intervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, intervalMs]);

  return { ...status, checkHealth };
};
