import {
  Box,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Section } from './ui';
import { DashboardSummary } from '../types';

const CATEGORY_COLORS = ['#2563EB', '#1D4ED8', '#38BDF8', '#60A5FA', '#818CF8'];
const STATUS_COLORS = ['#22C55E', '#F59E0B', '#EF4444'];
const SECTOR_COLORS = ['#8B5CF6', '#D946EF', '#EC4899', '#F472B6'];
const SIDE_COLORS = ['#14B8A6', '#2DD4BF'];

interface InsightsPanelProps {
  data: DashboardSummary;
}

const MetricCard = ({ label, value, helper }: { label: string; value: number; helper?: string }) => (
  <Paper
    sx={{
      borderRadius: 12,
      border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.8)}`,
      bgcolor: 'background.paper',
      p: { xs: 2.25, md: 2.5 },
      minWidth: 220,
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}
  >
    <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.72rem' }}>
      {label}
    </Typography>
    <Typography variant="h3" sx={{ lineHeight: 1 }}>
      {value}
    </Typography>
    {helper && (
      <Typography variant="body2" color="text.secondary">
        {helper}
      </Typography>
    )}
  </Paper>
);

const TrendCard = ({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'error' | 'info';
  icon: React.ReactNode;
}) => (
  <Paper
    sx={{
      borderRadius: 12,
      border: (theme) => `1px solid ${alpha(theme.palette[tone].main, 0.25)}`,
      bgcolor: (theme) => alpha(theme.palette[tone].main, 0.08),
      p: { xs: 2, md: 2.25 },
      display: 'flex',
      flexDirection: 'column',
      gap: 0.75,
    }}
  >
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 1,
          backgroundColor: (theme) => alpha(theme.palette[tone].main, 0.18),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: `${tone}.main`,
        }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
    <Typography variant="h4">{value}</Typography>
    <Typography variant="caption" color="text.secondary">
      Compared to last week
    </Typography>
  </Paper>
);

const DonutChart: React.FC<{
  data: Array<{ name: string; value: number }>;
  colors: string[];
  title: string;
}> = ({ data, colors, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper
          sx={{
            p: 1,
            bgcolor: 'rgba(15, 23, 42, 0.92)',
            color: 'common.white',
            borderRadius: 1,
          }}
        >
          <Typography variant="caption" display="block">
            {payload[0].name}
          </Typography>
          <Typography variant="caption" fontWeight={600}>
            {payload[0].value} ({((payload[0].value / total) * 100).toFixed(1)}%)
          </Typography>
        </Paper>
      );
    }
    return null;
  };

  return (
    <Paper
      sx={{
        borderRadius: 12,
        border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        p: { xs: 2.5, md: 2.75 },
        minWidth: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.72rem' }}>
        {title}
      </Typography>
      <Box sx={{ position: 'relative', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={70} paddingAngle={2} dataKey="value">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography variant="h4" fontWeight={700} color="primary.main">
            {total}
          </Typography>
          <Typography variant="caption" color="text.secondary">Total</Typography>
        </Box>
      </Box>
      <Stack spacing={0.6}>
        {data.map((item, index) => (
          <Stack key={item.name} direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: colors[index % colors.length],
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ flex: 1 }}>
              {item.name}
            </Typography>
            <Typography variant="caption" fontWeight={600}>
              {item.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
};

const InsightsPanel: React.FC<InsightsPanelProps> = ({ data }) => {
  return (
    <Section sx={{ p: { xs: 3, md: 3.5 }, display: 'grid', gap: 3 }}> 
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.75, md: 2 },
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <MetricCard label="Active Projects" value={data.summary.activeProjects} helper={`${data.summary.totalProjects} total`} />
        <MetricCard label="Upcoming Filings" value={data.summary.upcomingFilings30Days} helper="Within 30 days" />
        <MetricCard label="Upcoming Listings" value={data.summary.upcomingListings30Days} helper="Within 30 days" />
        <MetricCard label="Active Team Members" value={data.summary.activeStaff} helper={`${data.summary.totalStaff} total`} />
      </Box>

      <Stack spacing={1.25}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          Last 7 days
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 1.75,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <TrendCard label="New Projects" value={data.sevenDayTrends.newProjects} tone="success" icon={<TrendingUpIcon fontSize="small" />} />
          <TrendCard label="Suspended" value={data.sevenDayTrends.suspended} tone="error" icon={<TrendingDownIcon fontSize="small" />} />
          <TrendCard label="Slow-down" value={data.sevenDayTrends.slowdown} tone="warning" icon={<TrendingDownIcon fontSize="small" />} />
          <TrendCard label="Resumed" value={data.sevenDayTrends.resumed} tone="info" icon={<TrendingUpIcon fontSize="small" />} />
        </Box>
      </Stack>

      <Stack spacing={1.25}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          Portfolio breakdown
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 1.75,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          <DonutChart
            data={data.projectsByCategory
              .map((item) => ({ name: item.category, value: item.count }))
              .sort((a, b) => b.value - a.value)}
            colors={CATEGORY_COLORS}
            title="Projects by Category"
          />
          <DonutChart
            data={data.projectsByStatus
              .map((item) => ({ name: item.status, value: item.count }))
              .sort((a, b) => b.value - a.value)}
            colors={STATUS_COLORS}
            title="Projects by Status"
          />
          {data.projectsBySector.length > 0 ? (
            <DonutChart
              data={data.projectsBySector
                .map((item) => ({ name: item.sector || 'Unknown', value: item.count }))
                .sort((a, b) => b.value - a.value)}
              colors={SECTOR_COLORS}
              title="Projects by Sector"
            />
          ) : (
            <Paper
              sx={{
                borderRadius: 12,
                border: (theme) => `1px dashed ${alpha(theme.palette.divider, 0.7)}`,
                p: { xs: 2.5, md: 2.75 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
              }}
            >
              <Typography variant="caption">No sector data</Typography>
            </Paper>
          )}
          {data.projectsBySide.length > 0 ? (
            <DonutChart
              data={data.projectsBySide
                .map((item) => ({ name: item.side || 'Unknown', value: item.count }))
                .sort((a, b) => b.value - a.value)}
              colors={SIDE_COLORS}
              title="Projects by Side"
            />
          ) : (
            <Paper
              sx={{
                borderRadius: 12,
                border: (theme) => `1px dashed ${alpha(theme.palette.divider, 0.7)}`,
                p: { xs: 2.5, md: 2.75 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
              }}
            >
              <Typography variant="caption">No side data</Typography>
            </Paper>
          )}
        </Box>
      </Stack>
    </Section>
  );
};

export default InsightsPanel;
