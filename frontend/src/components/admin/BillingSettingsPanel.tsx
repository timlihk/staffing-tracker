import { Box, CircularProgress, Stack, Switch, Typography } from '@mui/material';
import type { BillingSettings } from '../../hooks/useBilling';
import { toast } from '../../lib/toast';

export interface BillingSettingsPanelProps {
  billingSettings: BillingSettings | undefined;
  loading: boolean;
  onUpdate: (data: Partial<BillingSettings>) => Promise<void>;
  extractError: (error: unknown, fallback: string) => string;
}

/**
 * Billing module settings panel
 * Manages billing module access control
 */
export function BillingSettingsPanel({ billingSettings, loading, onUpdate, extractError }: BillingSettingsPanelProps) {
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
          Billing Module Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure access to the billing and collection module.
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
              Enable Billing Module
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Master toggle to enable or disable the billing module for all users
            </Typography>
          </Stack>
          <Switch
            checked={billingSettings?.billing_module_enabled ?? false}
            onChange={async (e) => {
              const isEnabled = e.target.checked;
              const currentAccessLevel = billingSettings?.access_level ?? 'admin_only';

              try {
                await onUpdate({
                  billing_module_enabled: isEnabled,
                  access_level: isEnabled ? currentAccessLevel : 'admin_only',
                });
                toast.success('Settings updated', 'Billing module settings have been saved.');
              } catch (error: unknown) {
                toast.error('Update failed', extractError(error, 'Failed to update settings.'));
              }
            }}
          />
        </Box>

        <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Access Control
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Control which user roles can access the billing module
          </Typography>

          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack>
                <Typography variant="body1" fontWeight={600}>
                  Admin Access
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Allow administrators to access billing
                </Typography>
              </Stack>
              <Switch checked={true} disabled color="primary" />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack>
                <Typography variant="body1" fontWeight={600}>
                  B&C Attorney Access
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Allow B&C attorneys to access billing
                </Typography>
              </Stack>
              <Switch
                checked={billingSettings?.access_level === 'admin_and_bc_attorney'}
                onChange={async (e) => {
                  const nextAccessLevel = e.target.checked ? 'admin_and_bc_attorney' : 'admin_only';
                  const billingEnabled = billingSettings?.billing_module_enabled ?? false;

                  try {
                    await onUpdate({
                      billing_module_enabled: billingEnabled,
                      access_level: nextAccessLevel,
                    });
                    toast.success('Settings updated', 'Billing access level has been saved.');
                  } catch (error: unknown) {
                    toast.error('Update failed', extractError(error, 'Failed to update settings.'));
                  }
                }}
                disabled={!billingSettings?.billing_module_enabled}
                color="primary"
              />
            </Box>
          </Stack>
        </Box>

        <Box sx={{ p: 2, bgcolor: 'info.50', borderRadius: 2, borderLeft: 4, borderColor: 'info.main' }}>
          <Typography variant="body2" color="info.dark">
            <strong>Note:</strong> When set to "Admin and B&C Attorneys", B&C attorneys will only see billing projects
            they are assigned to. Admins always have full access to all billing data.
          </Typography>
        </Box>
      </Stack>

    </Stack>
  );
}
