import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  Autorenew as SweepIcon,
  Psychology as AIIcon,
} from '@mui/icons-material';
import type { AppSettings } from '../../hooks/useAppSettings';
import { toast } from '../../lib/toast';

export interface AppSettingsPanelProps {
  appSettings: AppSettings | undefined;
  loading: boolean;
  onUpdate: (data: Partial<AppSettings>) => Promise<void>;
  extractError: (error: unknown, fallback: string) => string;
}

const clampInt = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.floor(value), min), max);
};

const clampFloat = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

/**
 * Application settings panel
 * Manages global application settings including data export and billing sweep automation.
 */
export function AppSettingsPanel({ appSettings, loading, onUpdate, extractError }: AppSettingsPanelProps) {
  const [dateSweepEnabled, setDateSweepEnabled] = useState(false);
  const [dateSweepLimit, setDateSweepLimit] = useState(2000);
  const [aiSweepEnabled, setAiSweepEnabled] = useState(false);
  const [aiSweepLimit, setAiSweepLimit] = useState(300);
  const [aiSweepBatchSize, setAiSweepBatchSize] = useState(20);
  const [aiSweepMinConfidence, setAiSweepMinConfidence] = useState(0.75);
  const [aiSweepAutoConfirmConfidence, setAiSweepAutoConfirmConfidence] = useState(0.92);
  const [savingSweepSettings, setSavingSweepSettings] = useState(false);

  useEffect(() => {
    if (!appSettings) return;
    setDateSweepEnabled(appSettings.billingDateSweepEnabled ?? false);
    setDateSweepLimit(appSettings.billingDateSweepLimit ?? 2000);
    setAiSweepEnabled(appSettings.billingAiSweepEnabled ?? false);
    setAiSweepLimit(appSettings.billingAiSweepLimit ?? 300);
    setAiSweepBatchSize(appSettings.billingAiSweepBatchSize ?? 20);
    setAiSweepMinConfidence(appSettings.billingAiSweepMinConfidence ?? 0.75);
    setAiSweepAutoConfirmConfidence(appSettings.billingAiSweepAutoConfirmConfidence ?? 0.92);
  }, [appSettings]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Application Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure global application features and billing automation controls.
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            bgcolor: 'grey.50',
            borderRadius: 1,
          }}
        >
          <Stack>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ExportIcon fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                Enable Data Export
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Allow users to export data as CSV, JSON, and print reports.
            </Typography>
          </Stack>
          <Switch
            checked={appSettings?.enableDataExport ?? false}
            onChange={async (e) => {
              try {
                await onUpdate({
                  enableDataExport: e.target.checked,
                });
                toast.success(
                  'Settings updated',
                  `Data export is now ${e.target.checked ? 'enabled' : 'disabled'}.`
                );
              } catch (error: unknown) {
                toast.error('Update failed', extractError(error, 'Failed to update settings.'));
              }
            }}
          />
        </Box>

        <Box
          sx={{
            p: 2,
            bgcolor: appSettings?.enableDataExport ? 'warning.50' : 'success.50',
            borderRadius: 1,
            borderLeft: 4,
            borderColor: appSettings?.enableDataExport ? 'warning.main' : 'success.main',
          }}
        >
          <Typography variant="body2" color={appSettings?.enableDataExport ? 'warning.dark' : 'success.dark'}>
            {appSettings?.enableDataExport ? (
              <>
                <strong>Warning:</strong> Data export is enabled. Users can download project, staff, and billing data.
                Ensure this complies with your organization&apos;s confidentiality policies.
              </>
            ) : (
              <>
                <strong>Secure:</strong> Data export is disabled. Users cannot download or print reports.
              </>
            )}
          </Typography>
        </Box>

        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SweepIcon fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                Billing Sweep Automation
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Configure daily sweep behavior. Schedule timing remains on server cron; these settings control whether
              sweeps run and how they process milestones.
            </Typography>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>
                  Date Sweep
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Auto-complete due milestones with explicit dates and create invoice action items.
                </Typography>
              </Box>
              <Switch
                checked={dateSweepEnabled}
                onChange={(e) => setDateSweepEnabled(e.target.checked)}
              />
            </Box>

            <TextField
              label="Date Sweep Limit"
              type="number"
              size="small"
              value={dateSweepLimit}
              onChange={(e) => setDateSweepLimit(clampInt(Number(e.target.value), 1, 10000))}
              inputProps={{ min: 1, max: 10000 }}
              helperText="Max milestones scanned per run"
              sx={{ maxWidth: 260 }}
            />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AIIcon fontSize="small" color="action" />
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    AI Sweep
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Uses the configured AI provider to detect due milestones from complex text.
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={aiSweepEnabled}
                onChange={(e) => setAiSweepEnabled(e.target.checked)}
              />
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                label="AI Sweep Limit"
                type="number"
                size="small"
                value={aiSweepLimit}
                onChange={(e) => setAiSweepLimit(clampInt(Number(e.target.value), 1, 5000))}
                inputProps={{ min: 1, max: 5000 }}
                sx={{ maxWidth: 220 }}
              />
              <TextField
                label="AI Batch Size"
                type="number"
                size="small"
                value={aiSweepBatchSize}
                onChange={(e) => setAiSweepBatchSize(clampInt(Number(e.target.value), 1, 50))}
                inputProps={{ min: 1, max: 50 }}
                sx={{ maxWidth: 220 }}
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                label="AI Min Confidence"
                type="number"
                size="small"
                value={aiSweepMinConfidence}
                onChange={(e) => setAiSweepMinConfidence(clampFloat(Number(e.target.value), 0, 1))}
                inputProps={{ min: 0, max: 1, step: 0.01 }}
                helperText="Below this value is ignored"
                sx={{ maxWidth: 220 }}
              />
              <TextField
                label="AI Auto-confirm Confidence"
                type="number"
                size="small"
                value={aiSweepAutoConfirmConfidence}
                onChange={(e) =>
                  setAiSweepAutoConfirmConfidence(clampFloat(Number(e.target.value), 0, 1))
                }
                inputProps={{ min: 0, max: 1, step: 0.01 }}
                helperText="Above this value auto-confirms"
                sx={{ maxWidth: 240 }}
              />
            </Stack>

            <Box>
              <Button
                variant="contained"
                disabled={savingSweepSettings}
                onClick={async () => {
                  setSavingSweepSettings(true);
                  try {
                    await onUpdate({
                      billingDateSweepEnabled: dateSweepEnabled,
                      billingDateSweepLimit: clampInt(dateSweepLimit, 1, 10000),
                      billingAiSweepEnabled: aiSweepEnabled,
                      billingAiSweepLimit: clampInt(aiSweepLimit, 1, 5000),
                      billingAiSweepBatchSize: clampInt(aiSweepBatchSize, 1, 50),
                      billingAiSweepMinConfidence: clampFloat(aiSweepMinConfidence, 0, 1),
                      billingAiSweepAutoConfirmConfidence: clampFloat(
                        aiSweepAutoConfirmConfidence,
                        0,
                        1
                      ),
                    });
                    toast.success('Settings updated', 'Billing sweep settings saved.');
                  } catch (error: unknown) {
                    toast.error('Update failed', extractError(error, 'Failed to update settings.'));
                  } finally {
                    setSavingSweepSettings(false);
                  }
                }}
              >
                Save Billing Sweep Settings
              </Button>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
}
