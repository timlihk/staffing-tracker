import { Box, CircularProgress, Stack, Switch, Typography } from '@mui/material';
import { FileDownload as ExportIcon } from '@mui/icons-material';
import type { AppSettings } from '../../hooks/useAppSettings';
import { toast } from '../../lib/toast';

export interface AppSettingsPanelProps {
  appSettings: AppSettings | undefined;
  loading: boolean;
  onUpdate: (data: Partial<AppSettings>) => Promise<void>;
  extractError: (error: unknown, fallback: string) => string;
}

/**
 * Application settings panel
 * Manages global application settings including data export functionality
 */
export function AppSettingsPanel({ appSettings, loading, onUpdate, extractError }: AppSettingsPanelProps) {
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
          Configure global application features and security settings.
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
              Allow users to export data as CSV, JSON, and print reports
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
                  `Data export is now ${e.target.checked ? 'enabled' : 'disabled'}`
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
            borderColor: appSettings?.enableDataExport ? 'warning.main' : 'success.main'
          }}
        >
          <Typography variant="body2" color={appSettings?.enableDataExport ? 'warning.dark' : 'success.dark'}>
            {appSettings?.enableDataExport ? (
              <>
                <strong>Warning:</strong> Data export is enabled. Users can download project, staff, and billing data. 
                Ensure this complies with your organization's data confidentiality policies.
              </>
            ) : (
              <>
                <strong>Secure:</strong> Data export is disabled. Users cannot download or print reports. 
                This helps maintain data confidentiality.
              </>
            )}
          </Typography>
        </Box>

        {appSettings?.enableDataExport && (
          <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Export Features Enabled
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                <li>CSV export on Projects, Staff, and Billing pages</li>
                <li>JSON data export for raw data access</li>
                <li>Print functionality for reports</li>
              </ul>
            </Typography>
          </Box>
        )}
      </Stack>
    </Stack>
  );
}
