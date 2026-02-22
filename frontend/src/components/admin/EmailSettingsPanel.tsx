import { Box, CircularProgress, Stack, Switch, Typography } from '@mui/material';
import type { EmailSettings } from '../../hooks/useEmailSettings';
import { toast } from '../../lib/toast';

export interface EmailSettingsPanelProps {
  emailSettings: EmailSettings | undefined;
  loading: boolean;
  onUpdate: (data: Partial<EmailSettings>) => Promise<void>;
  extractError: (error: unknown, fallback: string) => string;
}

/**
 * Email notification settings panel
 * Manages project update email notifications by staff position
 */
export function EmailSettingsPanel({ emailSettings, loading, onUpdate, extractError }: EmailSettingsPanelProps) {
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
          Email Notification Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure which staff positions receive email updates when projects are modified.
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
            borderRadius: 2,
          }}
        >
          <Stack>
            <Typography variant="subtitle1" fontWeight={600}>
              Enable Email Notifications
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Master toggle for all project update email notifications
            </Typography>
          </Stack>
          <Switch
            checked={emailSettings?.emailNotificationsEnabled ?? false}
            onChange={async (e) => {
              try {
                await onUpdate({
                  emailNotificationsEnabled: e.target.checked,
                });
                toast.success('Settings updated', 'Email notification settings have been saved.');
              } catch (error: unknown) {
                toast.error('Update failed', extractError(error, 'Failed to update settings.'));
              }
            }}
          />
        </Box>

        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Position-Based Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select which staff positions should receive email updates for project changes
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">Partner</Typography>
              <Switch
                checked={emailSettings?.notifyPartner ?? false}
                onChange={async (e) => {
                  try {
                    await onUpdate({ notifyPartner: e.target.checked });
                    toast.success('Settings updated', 'Partner notification preference saved.');
                  } catch (error: unknown) {
                    toast.error('Update failed', extractError(error, 'Failed to update settings.'));
                  }
                }}
                disabled={!emailSettings?.emailNotificationsEnabled}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">Associate</Typography>
              <Switch
                checked={emailSettings?.notifyAssociate ?? false}
                onChange={async (e) => {
                  try {
                    await onUpdate({ notifyAssociate: e.target.checked });
                    toast.success('Settings updated', 'Associate notification preference saved.');
                  } catch (error: unknown) {
                    toast.error('Update failed', extractError(error, 'Failed to update settings.'));
                  }
                }}
                disabled={!emailSettings?.emailNotificationsEnabled}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">Junior FLIC</Typography>
              <Switch
                checked={emailSettings?.notifyJuniorFlic ?? false}
                onChange={async (e) => {
                  try {
                    await onUpdate({ notifyJuniorFlic: e.target.checked });
                    toast.success('Settings updated', 'Junior FLIC notification preference saved.');
                  } catch (error: unknown) {
                    toast.error('Update failed', extractError(error, 'Failed to update settings.'));
                  }
                }}
                disabled={!emailSettings?.emailNotificationsEnabled}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">Senior FLIC</Typography>
              <Switch
                checked={emailSettings?.notifySeniorFlic ?? false}
                onChange={async (e) => {
                  try {
                    await onUpdate({ notifySeniorFlic: e.target.checked });
                    toast.success('Settings updated', 'Senior FLIC notification preference saved.');
                  } catch (error: unknown) {
                    toast.error('Update failed', extractError(error, 'Failed to update settings.'));
                  }
                }}
                disabled={!emailSettings?.emailNotificationsEnabled}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">Intern</Typography>
              <Switch
                checked={emailSettings?.notifyIntern ?? false}
                onChange={async (e) => {
                  try {
                    await onUpdate({ notifyIntern: e.target.checked });
                    toast.success('Settings updated', 'Intern notification preference saved.');
                  } catch (error: unknown) {
                    toast.error('Update failed', extractError(error, 'Failed to update settings.'));
                  }
                }}
                disabled={!emailSettings?.emailNotificationsEnabled}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">B&C Working Attorney</Typography>
              <Switch
                checked={emailSettings?.notifyBCWorkingAttorney ?? false}
                onChange={async (e) => {
                  try {
                    await onUpdate({ notifyBCWorkingAttorney: e.target.checked });
                    toast.success('Settings updated', 'B&C Working Attorney notification preference saved.');
                  } catch (error: unknown) {
                    toast.error('Update failed', extractError(error, 'Failed to update settings.'));
                  }
                }}
                disabled={!emailSettings?.emailNotificationsEnabled}
              />
            </Box>
          </Box>
        </Box>

        <Box sx={{ p: 2, bgcolor: 'info.50', borderRadius: 2, borderLeft: 4, borderColor: 'info.main' }}>
          <Typography variant="body2" color="info.dark">
            <strong>Note:</strong> When a project is updated, only staff members assigned to that project with
            positions that have notifications enabled will receive email updates.
          </Typography>
        </Box>
      </Stack>
    </Stack>
  );
}
