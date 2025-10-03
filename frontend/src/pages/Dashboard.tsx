import { useEffect, useMemo, useState } from 'react';
import {
  Grid,
  Typography,
  Box,
  Paper,
  Stack,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Page, DashboardSkeleton } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { useNavigate } from 'react-router-dom';
import type { DashboardSummary } from '../types';

const Dashboard = () => {
  const { data, isLoading, error } = useDashboard();
  const navigate = useNavigate();

  const dealRadarGroups = useMemo(
    () => groupDealRadar(data?.dealRadar ?? []),
    [data?.dealRadar]
  );

  const heatmapWeeks = useMemo(() => {
    const set = new Set<string>();
    (data?.staffingHeatmap ?? []).forEach((row) => {
      row.weeks.forEach((week) => set.add(week.week));
    });
    return Array.from(set).sort();
  }, [data?.staffingHeatmap]);

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

  return (
    <Page title="Dashboard">
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} sx={{ display: 'flex' }}>
          <DealRadarCard
            groups={dealRadarGroups}
            onSelectProject={(id) => navigate(`/projects/${id}`)}
          />
        </Grid>

        <Grid item xs={12} sx={{ display: 'flex' }}>
          <StaffingHeatmapCard
            weeks={heatmapWeeks}
            groups={groupHeatmapByRole(data.staffingHeatmap)}
            onSelectStaff={(id) => navigate(`/staff/${id}`)}
          />
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
  <Paper sx={{ p: 3, flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
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
      <Stack spacing={2} sx={{ flex: 1 }}>
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
  <Paper sx={{ p: 2.25, display: 'grid', gap: 1.25 }}>
    <Typography variant="subtitle1" fontWeight={700}>
      Staffing Load – Legend
    </Typography>
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 18, height: 18, bgcolor: getHeatColor(0), borderRadius: 1 }} />
        <Typography variant="body2">No milestones</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 18, height: 18, bgcolor: getHeatColor(1), borderRadius: 1 }} />
        <Typography variant="body2">1 milestone</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 18, height: 18, bgcolor: getHeatColor(3), borderRadius: 1 }} />
        <Typography variant="body2">2–3 milestones</Typography>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 18, height: 18, bgcolor: getHeatColor(5), borderRadius: 1 }} />
        <Typography variant="body2">4+ milestones (consider relief)</Typography>
      </Stack>
    </Stack>
    <Typography variant="caption" color="text.secondary">
      Weeks shown:{' '}
      {weeks.length === 0
        ? '—'
        : weeks
            .map((week) => formatWeekLabel(week))
            .join(' • ')}
    </Typography>
  </Paper>
);

const StaffingHeatmapCard = ({
  weeks,
  groups,
  onSelectStaff,
}: {
  weeks: string[];
  groups: Array<{ label: string; rows: DashboardSummary['staffingHeatmap']; count: number }>;
  onSelectStaff: (id: number) => void;
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = {};
      groups.forEach((group) => {
        next[group.label] = prev[group.label] ?? true;
      });
      return next;
    });
  }, [groups]);

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    groups.forEach((group) => {
      next[group.label] = true;
    });
    setExpandedGroups(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    groups.forEach((group) => {
      next[group.label] = false;
    });
    setExpandedGroups(next);
  };

  const allExpanded = groups.length > 0 && groups.every((group) => expandedGroups[group.label]);
  const allCollapsed = groups.length > 0 && groups.every((group) => expandedGroups[group.label] === false);

  return (
    <Paper sx={{ p: 3, flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} spacing={2}>
        <Typography variant="h6" fontWeight={700}>
          Staffing Heatmap (Next 30 Days)
        </Typography>
        {groups.length > 0 && (
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="text" onClick={expandAll} disabled={allExpanded}>
              Expand all
            </Button>
            <Button size="small" variant="text" onClick={collapseAll} disabled={allCollapsed}>
              Collapse all
            </Button>
          </Stack>
        )}
      </Stack>
      {groups.length === 0 ? (
        <Typography color="text.secondary">No staffing data for upcoming milestones.</Typography>
      ) : (
        <Stack spacing={1} sx={{ flex: 1 }}>
          {groups.map((group) => (
            <Accordion
              key={group.label}
              disableGutters
              square
              expanded={expandedGroups[group.label] ?? true}
              onChange={(_, expanded) =>
                setExpandedGroups((prev) => ({ ...prev, [group.label]: expanded }))
              }
              sx={{
                '&:before': { display: 'none' },
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
                sx={{
                  minHeight: 40,
                  '& .MuiAccordionSummary-content': {
                    margin: 0,
                    alignItems: 'center',
                  },
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1" fontWeight={600}>
                    {group.label}
                  </Typography>
                  <Chip label={`${group.count} staff`} size="small" />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                <TableContainer>
                  <Table size="small" stickyHeader={false}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ py: 1 }}>Name</TableCell>
                        {weeks.map((week) => (
                          <TableCell key={week} align="center" sx={{ py: 1 }}>
                            <Typography variant="caption" fontWeight={600}>
                              {formatWeekLabel(week)}
                            </Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.rows.map((row) => (
                        <TableRow
                          key={row.staffId}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '& .MuiTableCell-root': { py: 0.75 },
                          }}
                          onClick={() => onSelectStaff(row.staffId)}
                        >
                          <TableCell sx={{ minWidth: 150 }}>
                            <Typography variant="body2" fontWeight={600} color="primary.main">
                              {row.name}
                            </Typography>
                          </TableCell>
                          {weeks.map((week) => {
                            const match = row.weeks.find((w) => w.week === week);
                            const count = match?.count ?? 0;
                            return (
                              <TableCell key={`${row.staffId}-${week}`} align="center">
                                <Box
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 28,
                                    height: 28,
                                    borderRadius: 1,
                                    bgcolor: getHeatColor(count),
                                    color: count > 0 ? 'common.white' : 'text.secondary',
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {count > 0 ? count : ''}
                                </Box>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
    </Paper>
  );
};

const getHeatColor = (count: number) => {
  if (count === 0) return 'grey.200';
  if (count === 1) return 'rgba(21, 101, 192, 0.4)';
  if (count === 2 || count === 3) return 'rgba(30, 136, 229, 0.7)';
  return 'rgba(198, 40, 40, 0.85)';
};

const groupHeatmapByRole = (heatmap: DashboardSummary['staffingHeatmap']) => {
  const order = ['Partner', 'Associate', 'Senior FLIC', 'Junior FLIC', 'Intern'];
  const map = new Map<string, DashboardSummary['staffingHeatmap']>();

  heatmap.forEach((row) => {
    const key = order.includes(row.role) ? row.role : 'Other Roles';
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

export default Dashboard;
