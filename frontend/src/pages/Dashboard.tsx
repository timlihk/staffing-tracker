import { Fragment, useMemo } from 'react';
import {
  Grid,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Stack,
  Chip,
  Divider,
  Button,
} from '@mui/material';
import SummaryCards from '../components/SummaryCards';
import ActivityFeed from '../components/ActivityFeed';
import { Page, DashboardSkeleton } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { ProjectStatusChart, ProjectCategoryChart } from '../components/dashboard';
import { useNavigate } from 'react-router-dom';
import type { DashboardSummary } from '../types';

const Dashboard = () => {
  const { data, isLoading, error } = useDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Page title="Dashboard">
        <DashboardSkeleton />
      </Page>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography color="error">Failed to load dashboard data. Please try again.</Typography>
      </Box>
    );
  }

  if (!data) {
    return <Typography>No dashboard data available</Typography>;
  }

  const filingsUpcoming = data.dealRadar.filter((event) => event.type === 'Filing').length;
  const listingsUpcoming = data.dealRadar.filter((event) => event.type === 'Listing').length;
  const pendingResets = data.actionItems.pendingResets.length;

  const dealRadarGroups = useMemo(() => groupDealRadar(data.dealRadar), [data.dealRadar]);
  const heatmapWeeks = useMemo(() => {
    const set = new Set<string>();
    data.staffingHeatmap.forEach((row) => {
      row.weeks.forEach((week) => set.add(week.week));
    });
    return Array.from(set).sort();
  }, [data.staffingHeatmap]);

  return (
    <Page title="Dashboard">
      <SummaryCards
        activeProjects={data.summary.activeProjects}
        filingsUpcoming={filingsUpcoming}
        listingsUpcoming={listingsUpcoming}
        pendingResets={pendingResets}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <DealRadarCard groups={dealRadarGroups} onSelectProject={(id) => navigate(`/projects/${id}`)} />
        </Grid>

        <Grid item xs={12} md={4}>
          <ActionItemsCard actionItems={data.actionItems} onManageUsers={() => navigate('/users')} />
        </Grid>

        <Grid item xs={12} md={4}>
          <ProjectStatusChart data={data.projectsByStatus} />
        </Grid>

        <Grid item xs={12} md={4}>
          <ProjectCategoryChart data={data.projectsByCategory} />
        </Grid>

        <Grid item xs={12} md={4}>
          <StaffingHeatmapLegend weeks={heatmapWeeks} />
        </Grid>

        <Grid item xs={12} md={8}>
          <StaffingHeatmapCard
            weeks={heatmapWeeks}
            heatmap={data.staffingHeatmap}
            onSelectStaff={(id) => navigate(`/staff/${id}`)}
          />
        </Grid>

        <Grid item xs={12}>
          <ActivityFeed />
        </Grid>
      </Grid>
    </Page>
  );
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatWeekLabel = (weekKey: string) => {
  const [start, end] = weekKey.split('_');
  if (!start || !end) return weekKey;
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

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

const DealRadarCard = ({
  groups,
  onSelectProject,
}: {
  groups: Array<{ label: string; items: DashboardSummary['dealRadar'] }>;
  onSelectProject: (id: number) => void;
}) => (
  <Paper sx={{ p: 3, height: '100%' }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
      <Typography variant="h6" fontWeight={700}>
        Deal Radar (Next 30 Days)
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Click a project to view details
      </Typography>
    </Stack>
    {groups.length === 0 ? (
      <Typography color="text.secondary">No upcoming filing or listing dates.</Typography>
    ) : (
      <Stack spacing={2}>
        {groups.map((group) => (
          <Box key={group.label}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {group.label}
            </Typography>
            <Grid container spacing={1.5}>
              {group.items.map((event) => (
                <Grid item xs={12} md={6} key={`${event.projectId}-${event.type}`}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 1,
                      },
                    }}
                    onClick={() => onSelectProject(event.projectId)}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <Chip
                        label={event.type}
                        size="small"
                        color={event.type === 'Filing' ? 'info' : 'secondary'}
                      />
                      {event.priority && (
                        <Chip label={`Priority ${event.priority}`} size="small" variant="outlined" />
                      )}
                    </Stack>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {event.projectName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {event.category} • {event.status}
                    </Typography>
                    {event.partner && (
                      <Typography variant="caption" color="text.secondary">
                        Lead Partner: {event.partner}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Stack>
    )}
  </Paper>
);

const StaffingHeatmapLegend = ({ weeks }: { weeks: string[] }) => (
  <Paper sx={{ p: 3 }}>
    <Typography variant="h6" fontWeight={700} gutterBottom>
      Staffing Load – Legend
    </Typography>
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 20, height: 20, bgcolor: getHeatColor(0), borderRadius: 1 }} />
        <Typography variant="body2">No milestones</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 20, height: 20, bgcolor: getHeatColor(1), borderRadius: 1 }} />
        <Typography variant="body2">1 milestone</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 20, height: 20, bgcolor: getHeatColor(3), borderRadius: 1 }} />
        <Typography variant="body2">2–3 milestones</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 20, height: 20, bgcolor: getHeatColor(5), borderRadius: 1 }} />
        <Typography variant="body2">4+ milestones (consider relief)</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Weeks shown:{' '}
        {weeks.length === 0
          ? '—'
          : weeks
              .map((week) => formatWeekLabel(week))
              .join(' • ')}
      </Typography>
    </Stack>
  </Paper>
);

const StaffingHeatmapCard = ({
  weeks,
  heatmap,
  onSelectStaff,
}: {
  weeks: string[];
  heatmap: DashboardSummary['staffingHeatmap'];
  onSelectStaff: (id: number) => void;
}) => (
  <Paper sx={{ p: 3, overflowX: 'auto' }}>
    <Typography variant="h6" fontWeight={700} gutterBottom>
      Staffing Heatmap (Next 30 Days)
    </Typography>
    {heatmap.length === 0 ? (
      <Typography color="text.secondary">No staffing data for upcoming milestones.</Typography>
    ) : (
      <Box sx={{ minWidth: 480 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `220px repeat(${weeks.length}, minmax(90px, 1fr))`,
            rowGap: 1,
            columnGap: 1,
            alignItems: 'stretch',
          }}
        >
          <Box />
          {weeks.map((week) => (
            <Box key={week} sx={{ textAlign: 'center' }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                {formatWeekLabel(week)}
              </Typography>
            </Box>
          ))}

          {heatmap.map((row) => (
            <Fragment key={row.staffId}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
                onClick={() => onSelectStaff(row.staffId)}
              >
                <Typography variant="body2" fontWeight={600}>
                  {row.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.role}
                </Typography>
              </Box>
              {weeks.map((week) => {
                const match = row.weeks.find((w) => w.week === week);
                const count = match?.count ?? 0;
                return (
                  <Box
                    key={`${row.staffId}-${week}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 1,
                      bgcolor: getHeatColor(count),
                      height: 48,
                      color: count > 0 ? 'white' : 'text.secondary',
                      fontWeight: 600,
                    }}
                  >
                    {count > 0 ? count : ''}
                  </Box>
                );
              })}
            </Fragment>
          ))}
        </Box>
      </Box>
    )}
  </Paper>
);

const getHeatColor = (count: number) => {
  if (count === 0) return 'grey.200';
  if (count === 1) return 'rgba(21, 101, 192, 0.4)';
  if (count === 2 || count === 3) return 'rgba(30, 136, 229, 0.7)';
  return 'rgba(198, 40, 40, 0.85)';
};

const ActionItemsCard = ({
  actionItems,
  onManageUsers,
}: {
  actionItems: DashboardSummary['actionItems'];
  onManageUsers: () => void;
}) => (
  <Paper sx={{ p: 3, height: '100%' }}>
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" fontWeight={700}>
            Unstaffed Milestones
          </Typography>
        </Stack>
        {actionItems.unstaffedMilestones.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            All upcoming filings/listings have partner coverage.
          </Typography>
        ) : (
          <List dense>
            {actionItems.unstaffedMilestones.slice(0, 5).map((item) => (
              <ListItem key={item.projectId} alignItems="flex-start">
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1" fontWeight={600}>
                        {item.projectName}
                      </Typography>
                      <Chip label={item.category} size="small" />
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(item.milestoneDate)} • {item.status}
                      </Typography>
                      {item.needsUSPartner && <Chip size="small" color="warning" label="Missing US Partner" />}
                      {item.needsHKPartner && <Chip size="small" color="warning" label="Missing HK Partner" />}
                    </Stack>
                  }
                />
              </ListItem>
            ))}
            {actionItems.unstaffedMilestones.length > 5 && (
              <ListItem>
                <ListItemText
                  primary={`${actionItems.unstaffedMilestones.length - 5} more milestones need attention`}
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
            )}
          </List>
        )}
      </Box>

      <Divider />

      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" fontWeight={700}>
            Pending Password Resets
          </Typography>
          <Button size="small" onClick={onManageUsers}>
            Manage Users
          </Button>
        </Stack>
        {actionItems.pendingResets.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No users awaiting password setup.
          </Typography>
        ) : (
          <List dense>
            {actionItems.pendingResets.slice(0, 5).map((user) => (
              <ListItem key={user.id}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={600}>
                        {user.username}
                      </Typography>
                      <Chip label={user.role} size="small" />
                    </Stack>
                  }
                  secondary={`Last login: ${formatDate(user.lastLogin)}`}
                />
              </ListItem>
            ))}
            {actionItems.pendingResets.length > 5 && (
              <ListItem>
                <ListItemText
                  primary={`${actionItems.pendingResets.length - 5} more users pending`}
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
            )}
          </List>
        )}
      </Box>
    </Stack>
  </Paper>
);

export default Dashboard;
