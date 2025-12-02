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

const groupHeatmapByRole = (heatmap: DashboardSummary['staffingHeatmap']) => {
  const order = ['Partner', 'Associate', 'Senior FLIC', 'Junior FLIC', 'Intern'];
  const map = new Map<string, DashboardSummary['staffingHeatmap']>();

  heatmap.forEach((row) => {
    const key = order.includes(row.position) ? row.position : 'Other Roles';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(row);
  });

  const result: Array<{ label: string; rows: DashboardSummary['staffingHeatmap']; count: number }> = [];

  order.forEach((key) => {
    if (map.has(key)) {
      const rows = map.get(key)!;
      result.push({ label: key, rows, count: rows.length });
      map.delete(key);
    }
  });

  map.forEach((rows, key) => {
    result.push({ label: key, rows, count: rows.length });
  });

  return result;
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
  const [milestoneType, setMilestoneType] = useState<'filing' | 'listing' | 'both'>('both');
  const [showAllEvents, setShowAllEvents] = useState(false);
  const { data, isLoading, error } = useDashboard(timeRange, milestoneType);

  const dealRadarGroups = useMemo(() => groupDealRadar(data?.dealRadar ?? []), [data?.dealRadar]);

  // Reset show all events when time range or milestone type changes
  useEffect(() => {
    setShowAllEvents(false);
  }, [timeRange, milestoneType]);

  const heatmapWeeks = useMemo(() => {
    const set = new Set<string>();
    (data?.staffingHeatmap ?? []).forEach((row) => {
      row.weeks.forEach((week) => set.add(week.week));
    });
    return Array.from(set).sort();
  }, [data?.staffingHeatmap]);

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
        <Stack direction="row" spacing={1}>
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
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={milestoneType}
              onChange={(e) => setMilestoneType(e.target.value as 'filing' | 'listing' | 'both')}
              sx={{ fontSize: '0.875rem' }}
            >
              <MenuItem value="both">Both Milestones</MenuItem>
              <MenuItem value="filing">Filing Only</MenuItem>
              <MenuItem value="listing">Listing Only</MenuItem>
            </Select>
          </FormControl>
        </Stack>
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
          weeks={heatmapWeeks}
          groups={groupHeatmapByRole(data.staffingHeatmap)}
          onSelectStaff={(id) => navigate(`/staff/${id}`)}
          milestoneType={milestoneType}
        />
      </Stack>
    </Page>
  );
};

export default Dashboard;
