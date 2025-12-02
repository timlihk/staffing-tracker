import { useEffect, useMemo, useState } from 'react';
import { Typography, Box, Stack, Select, MenuItem, FormControl } from '@mui/material';
import { Page, DashboardSkeleton, PageHeader } from '../components/ui';
import InsightsPanel from '../components/InsightsPanel';
import { DealRadarCard, StaffingHeatmapCard } from '../components/dashboard';
import { useDashboard } from '../hooks/useDashboard';
import { useNavigate } from 'react-router-dom';
import type { DashboardSummary } from '../types';

const groupDealRadar = (
  events: DashboardSummary['dealRadar']
): Array<{ label: string; items: DashboardSummary['dealRadar'] }> => {
  const map = new Map<string, DashboardSummary['dealRadar']>();
  events.forEach((event) => {
    const label = formatDate(event.date);
    if (!map.has(label)) {
      map.set(label, []);
    }
    map.get(label)!.push(event);
  });

  return Array.from(map.entries()).map(([label, items]) => ({
    label,
    items: items.sort((a, b) => a.projectName.localeCompare(b.projectName)),
  }));
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState(120);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const { data, isLoading, error } = useDashboard(timeRange);

  const dealRadarGroups = useMemo(() => groupDealRadar(data?.dealRadar ?? []), [data?.dealRadar]);

  // Reset show all events when time range changes
  useEffect(() => {
    setShowAllEvents(false);
  }, [timeRange]);

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="Dashboard" />
        <DashboardSkeleton />
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <PageHeader title="Dashboard" />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Typography color="error">Failed to load dashboard data. Please try again.</Typography>
        </Box>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page>
        <PageHeader title="Dashboard" />
        <Typography>No dashboard data available</Typography>
      </Page>
    );
  }

  return (
    <Page>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <PageHeader title="Dashboard" />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            sx={{ fontSize: '0.875rem' }}
          >
            <MenuItem value={30}>30 Days</MenuItem>
            <MenuItem value={60}>2 Months</MenuItem>
            <MenuItem value={90}>3 Months</MenuItem>
            <MenuItem value={120}>4 Months</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <Stack spacing={1.75}>
        <InsightsPanel data={data} timeRange={timeRange} />
        <DealRadarCard
          groups={dealRadarGroups}
          onSelectProject={(id) => navigate(`/projects/${id}`)}
          timeRange={timeRange}
          showAllEvents={showAllEvents}
          setShowAllEvents={setShowAllEvents}
        />
        <StaffingHeatmapCard
          days={timeRange}
          onSelectStaff={(id) => navigate(`/staff/${id}`)}
        />
      </Stack>
    </Page>
  );
};

export default Dashboard;
