import { Box, Paper, Stack, Chip, Divider, Typography, IconButton, Tooltip } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { alpha, type Theme } from '@mui/material/styles';
import { InfoField } from './InfoField';
import { formatDate, formatDateYmd, formatCurrencyWholeWithFallback } from '../../lib/billing/utils';
import { formatCurrency } from '../../lib/currency';
import type {
  BillingProjectSummaryResponse,
  BillingProjectCM,
  CMEngagementSummary,
  EngagementDetailResponse,
} from '../../api/billing';

const cardSx = {
  p: { xs: 2.5, md: 3 },
  borderRadius: 1,
};

const summaryCardSx = (theme: Theme) => ({
  ...cardSx,
  border: `1px solid ${alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.45 : 0.2)}`,
  background:
    theme.palette.mode === 'dark'
      ? `linear-gradient(135deg, ${alpha(theme.palette.info.dark, 0.35)} 0%, ${alpha(theme.palette.background.paper, 0.97)} 60%)`
      : `linear-gradient(135deg, ${alpha(theme.palette.info.light, 0.26)} 0%, ${alpha(theme.palette.success.light, 0.14)} 42%, ${theme.palette.background.paper} 100%)`,
  boxShadow: `0 10px 24px ${alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.22 : 0.12)}`,
});

export interface CmSummaryCardProps {
  project: BillingProjectSummaryResponse['project'];
  cm: BillingProjectCM | null;
  engagementSummary: CMEngagementSummary | null;
  detail: EngagementDetailResponse | null;
  loading: boolean;
  onEdit?: () => void;
  canEdit?: boolean;
}

/**
 * Client Matter Summary Card
 * Displays key metrics for a specific C/M number including:
 * - C/M status and dates
 * - Financial metrics (agreed fee, billing, collection, UBT)
 * - Long stop date
 */
export function CmSummaryCard({
  project,
  cm,
  engagementSummary,
  detail,
  loading,
  onEdit,
  canEdit = false,
}: CmSummaryCardProps) {
  const statusNormalized = (cm?.status || '').trim().toLowerCase();
  const statusColor: 'default' | 'success' | 'warning' =
    statusNormalized === 'closed' ? 'default' : statusNormalized === 'active' ? 'success' : 'warning';

  const longStopDate = detail?.feeArrangement?.lsd_date || null;

  const agreedFeeValue =
    detail?.total_agreed_fee_value ??
    engagementSummary?.total_agreed_fee_value ??
    project.agreed_fee_usd ??
    project.agreed_fee_cny;
  const agreedFeeCurrency =
    detail?.total_agreed_fee_currency ??
    engagementSummary?.total_agreed_fee_currency ??
    (project.agreed_fee_usd ? 'USD' : project.agreed_fee_cny ? 'CNY' : undefined);

  return (
    <Paper sx={summaryCardSx}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ color: 'info.dark' }}>Client Matter Summary</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {cm?.status && <Chip label={cm.status} color={statusColor} size="small" />}
            {canEdit && onEdit && (
              <Tooltip title="Edit billing information">
                <IconButton size="small" onClick={onEdit} color="primary">
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        <Divider />

        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          <InfoField label="C/M Number" value={cm?.cm_no || '—'} loading={loading && !cm} />
          <InfoField label="B&C Attorney" value={project.bc_attorney_name || '—'} loading={loading} />
          <InfoField label="Opened" value={formatDate(cm?.open_date)} loading={loading} />
          <InfoField label="Closed" value={formatDate(cm?.closed_date)} loading={loading} />
          <InfoField label="Long Stop Date" value={formatDateYmd(longStopDate)} loading={loading} />
          <InfoField
            label="Agreed Fee"
            value={formatCurrency(agreedFeeValue ?? null, agreedFeeCurrency ?? null)}
            loading={loading}
          />
          <InfoField
            label="Billing To Date"
            value={formatCurrencyWholeWithFallback(
              detail?.billing_usd ?? project.billing_usd,
              detail?.billing_cny ?? project.billing_cny
            )}
            loading={loading}
          />
          <InfoField
            label="Collected"
            value={formatCurrencyWholeWithFallback(
              detail?.collection_usd ?? project.collection_usd,
              detail?.collection_cny ?? project.collection_cny
            )}
            loading={loading}
          />
          <InfoField
            label="UBT"
            value={formatCurrencyWholeWithFallback(
              detail?.ubt_usd ?? project.ubt_usd,
              detail?.ubt_cny ?? project.ubt_cny
            )}
            loading={loading}
          />
          <InfoField
            label="Billing Credits"
            value={formatCurrencyWholeWithFallback(
              detail?.billing_credit_usd ?? project.billing_credit_usd,
              detail?.billing_credit_cny ?? project.billing_credit_cny
            )}
            loading={loading}
          />
        </Box>
      </Stack>
    </Paper>
  );
}
