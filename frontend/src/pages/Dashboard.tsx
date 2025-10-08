import { useEffect, useMemo, useState } from 'react';
import {
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
  TableSortLabel,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { Page, DashboardSkeleton, PageHeader } from '../components/ui';
import InsightsPanel from '../components/InsightsPanel';
import { useDashboard } from '../hooks/useDashboard';
import { useNavigate } from 'react-router-dom';
import type { DashboardSummary } from '../types';

// Helper function to categorize team members by position
const categorizeTeamMembers = (members: Array<{ id: number; name: string; position: string }>) => {
  const partners: typeof members = [];
  const associates: typeof members = [];
  const flics: typeof members = [];
  const interns: typeof members = [];

  members.forEach((member) => {
    const positionLower = member.position.toLowerCase();
    if (positionLower.includes('partner')) {
      partners.push(member);
    } else if (positionLower.includes('associate')) {
      associates.push(member);
    } else if (positionLower.includes('flic')) {
      flics.push(member);
    } else if (positionLower.includes('intern')) {
      interns.push(member);
    }
  });

  // Sort alphabetically within each category
  const sortByName = (a: typeof members[0], b: typeof members[0]) => a.name.localeCompare(b.name);

  return {
    partners: partners.sort(sortByName),
    associates: associates.sort(sortByName),
    flics: flics.sort(sortByName),
    interns: interns.sort(sortByName),
  };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState(120);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const { data, isLoading, error } = useDashboard(timeRange);

  const dealRadarGroups = useMemo(
    () => groupDealRadar(data?.dealRadar ?? []),
    [data?.dealRadar]
  );

  // Reset show all events when time range changes
  useEffect(() => {
    setShowAllEvents(false);
  }, [timeRange]);

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
          weeks={heatmapWeeks}
          groups={groupHeatmapByRole(data.staffingHeatmap)}
          onSelectStaff={(id) => navigate(`/staff/${id}`)}
        />
      </Stack>
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

interface DealRadarEvent {
  date: string;
  filingCount: number;
  listingCount: number;
  events: DashboardSummary['dealRadar'];
}

const DealRadarCard = ({
  groups,
  onSelectProject,
  timeRange,
  showAllEvents,
  setShowAllEvents,
}: {
  groups: Array<{ label: string; items: DashboardSummary['dealRadar'] }>;
  onSelectProject: (id: number) => void;
  timeRange: number;
  showAllEvents: boolean;
  setShowAllEvents: (show: boolean) => void;
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const getTimeRangeLabel = (days: number) => {
    if (days === 30) return 'Next 30 Days';
    if (days === 60) return 'Next 2 Months';
    if (days === 90) return 'Next 3 Months';
    if (days === 120) return 'Next 4 Months';
    return `Next ${days} Days`;
  };

  // Calculate number of months to display based on time range
  const numMonths = useMemo(() => {
    if (timeRange <= 30) return 1;
    if (timeRange <= 60) return 2;
    if (timeRange <= 90) return 3;
    return 4;
  }, [timeRange]);

  // Generate array of months to display
  const months = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 0; i < numMonths; i++) {
      const month = new Date(today.getFullYear(), today.getMonth() + i, 1);
      result.push(month);
    }
    return result;
  }, [numMonths]);

  // Build event map by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, DealRadarEvent>();
    groups.forEach((group) => {
      group.items.forEach((event) => {
        if (!event.date) return;
        // Extract date string directly without timezone conversion
        const dateKey = event.date.split('T')[0];
        if (!map.has(dateKey)) {
          map.set(dateKey, {
            date: dateKey,
            filingCount: 0,
            listingCount: 0,
            events: [],
          });
        }
        const entry = map.get(dateKey)!;
        entry.events.push(event);
        if (event.type === 'Filing') {
          entry.filingCount += 1;
        } else if (event.type === 'Listing') {
          entry.listingCount += 1;
        }
      });
    });
    return map;
  }, [groups]);

  const CustomDay = (props: PickersDayProps<Date>) => {
    const { day, outsideCurrentMonth, ...other } = props;
    // Format date in local timezone to avoid UTC conversion issues
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(day.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${dayOfMonth}`;
    const eventData = eventsByDate.get(dateKey);

    // Don't show dots for days outside the current month
    if (outsideCurrentMonth || !eventData || (eventData.filingCount === 0 && eventData.listingCount === 0)) {
      return <PickersDay day={day} outsideCurrentMonth={outsideCurrentMonth} {...other} />;
    }

    const isSelected = selectedDate === dateKey;

    return (
      <Box sx={{ position: 'relative' }}>
        <PickersDay
          day={day}
          outsideCurrentMonth={outsideCurrentMonth}
          {...other}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedDate(selectedDate === dateKey ? null : dateKey);
          }}
          sx={{
            cursor: 'pointer',
            bgcolor: isSelected ? 'primary.main' : undefined,
            color: isSelected ? 'common.white' : undefined,
            '&:hover': {
              bgcolor: isSelected ? 'primary.dark' : 'action.hover',
            },
          }}
        />
        <Stack
          direction="row"
          spacing={0.2}
          sx={{
            position: 'absolute',
            bottom: 1.5,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          {eventData.filingCount > 0 && (
            <Box
              sx={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                bgcolor: isSelected ? 'common.white' : 'info.main',
              }}
            />
          )}
          {eventData.listingCount > 0 && (
            <Box
              sx={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                bgcolor: isSelected ? 'common.white' : 'secondary.main',
              }}
            />
          )}
        </Stack>
      </Box>
    );
  };

  // Flatten all events and sort by date
  const allEvents = useMemo(() => {
    const events: Array<DashboardSummary['dealRadar'][0]> = [];
    groups.forEach((group) => {
      events.push(...group.items);
    });
    return events.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [groups]);

  // Filter events by selected date
  const filteredEvents = useMemo(() => {
    if (!selectedDate) return allEvents;
    return allEvents.filter(event => {
      if (!event.date) return false;
      const dateKey = event.date.split('T')[0];
      return dateKey === selectedDate;
    });
  }, [allEvents, selectedDate]);

  // Get displayed events (first 5 or all)
  const displayedEvents = useMemo(() => {
    return showAllEvents ? filteredEvents : filteredEvents.slice(0, 5);
  }, [filteredEvents, showAllEvents]);

  return (
    <Paper sx={{ p: 2.5, flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
          Deal Radar ({getTimeRangeLabel(timeRange)})
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'info.main' }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Filing</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'secondary.main' }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Listing</Typography>
          </Stack>
        </Stack>
      </Stack>
    {groups.length === 0 ? (
      <Typography color="text.secondary">No upcoming filing or listing dates.</Typography>
    ) : (
      <Stack spacing={2.5}>
        {/* Calendar Cards */}
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          {months.map((month) => (
            <Box
              key={`${month.getFullYear()}-${month.getMonth()}`}
              sx={{
                flex: numMonths === 1
                  ? '1 1 100%'
                  : numMonths === 2
                  ? '1 1 calc(50% - 6px)'
                  : numMonths === 3
                  ? '1 1 calc(33.333% - 8px)'
                  : '1 1 calc(25% - 9px)',
                minWidth: 220,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                bgcolor: 'grey.50',
                p: 0.75,
              }}
            >
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateCalendar
                  value={null}
                  referenceDate={month}
                  readOnly
                  slots={{
                    day: CustomDay,
                  }}
                  sx={{
                    width: '100%',
                    maxHeight: 260,
                    '& .MuiPickersCalendarHeader-root': {
                      paddingLeft: 0.75,
                      paddingRight: 0.75,
                      paddingTop: 0.25,
                      paddingBottom: 0.25,
                      marginTop: 0,
                      marginBottom: 0.5,
                    },
                    '& .MuiDayCalendar-header': {
                      paddingBottom: 0.5,
                    },
                    '& .MuiPickersDay-root': {
                      fontSize: '0.7rem',
                      width: 28,
                      height: 28,
                      margin: 0.15,
                    },
                    '& .MuiDayCalendar-weekContainer': {
                      margin: 0,
                    },
                    '& .MuiPickersCalendarHeader-label': {
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    },
                    '& .MuiDayCalendar-weekDayLabel': {
                      fontSize: '0.65rem',
                      width: 28,
                      height: 28,
                    },
                  }}
                />
              </LocalizationProvider>
            </Box>
          ))}
        </Box>

        {/* Events Table */}
        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="deal-radar-table-content"
            id="deal-radar-table-header"
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>
                Project Table (Showing {displayedEvents.length} of {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'})
              </Typography>
              {selectedDate && (
                <Chip
                  label={`Filtered: ${formatDate(selectedDate)}`}
                  size="small"
                  onDelete={() => setSelectedDate(null)}
                  color="primary"
                />
              )}
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Project</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Side</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Partner</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Associate</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>FLIC</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Intern</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedEvents.map((event, index) => {
                    const categorized = categorizeTeamMembers(event.teamMembers || []);

                    return (
                      <TableRow
                        key={`${event.projectId}-${event.type}-${index}`}
                        hover
                        sx={{
                          cursor: 'pointer',
                          bgcolor: index % 2 === 0 ? 'grey.50' : 'background.paper',
                          '&:hover': {
                            bgcolor: 'action.hover',
                          },
                        }}
                        onClick={() => onSelectProject(event.projectId)}
                      >
                        <TableCell>{formatDate(event.date)}</TableCell>
                        <TableCell>
                          <Chip
                            label={event.type}
                            size="small"
                            color={event.type === 'Filing' ? 'info' : 'secondary'}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} color="primary.main">
                            {event.projectName}
                          </Typography>
                        </TableCell>
                        <TableCell>{event.category}</TableCell>
                        <TableCell>{event.side || '—'}</TableCell>
                        <TableCell>
                          {categorized.partners.length > 0 ? (
                            <Stack direction="column" spacing={0.5}>
                              {categorized.partners.map((member) => (
                                <Typography key={member.id} variant="body2">
                                  {member.name}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {categorized.associates.length > 0 ? (
                            <Stack direction="column" spacing={0.5}>
                              {categorized.associates.map((member) => (
                                <Typography key={member.id} variant="body2">
                                  {member.name}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {categorized.flics.length > 0 ? (
                            <Stack direction="column" spacing={0.5}>
                              {categorized.flics.map((member) => (
                                <Typography key={member.id} variant="body2">
                                  {member.name}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {categorized.interns.length > 0 ? (
                            <Stack direction="column" spacing={0.5}>
                              {categorized.interns.map((member) => (
                                <Typography key={member.id} variant="body2">
                                  {member.name}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {filteredEvents.length > 5 && (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowAllEvents(!showAllEvents)}
                  size="small"
                >
                  {showAllEvents ? 'Show Less' : `Show More (${filteredEvents.length - 5} more)`}
                </Button>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      </Stack>
    )}
  </Paper>
  );
};

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
  const [sortConfig, setSortConfig] = useState<Record<string, { field: 'name' | string; order: 'asc' | 'desc' }>>({});

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

  const handleSort = (groupLabel: string, field: 'name' | string) => {
    setSortConfig((prev) => {
      const current = prev[groupLabel];
      const newOrder = current?.field === field && current.order === 'asc' ? 'desc' : 'asc';
      return { ...prev, [groupLabel]: { field, order: newOrder } };
    });
  };

  const getSortedRows = (rows: DashboardSummary['staffingHeatmap'], groupLabel: string) => {
    const config = sortConfig[groupLabel];
    if (!config) {
      // Default: sort by name alphabetically
      return [...rows].sort((a, b) => a.name.localeCompare(b.name));
    }

    return [...rows].sort((a, b) => {
      if (config.field === 'name') {
        return config.order === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      // Sorting by week column
      const weekA = a.weeks.find(w => w.week === config.field)?.count ?? 0;
      const weekB = b.weeks.find(w => w.week === config.field)?.count ?? 0;
      return config.order === 'asc' ? weekA - weekB : weekB - weekA;
    });
  };

  return (
    <Paper sx={{ p: 2.5, flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5} spacing={2}>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
          Staffing Heatmap
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
              <AccordionDetails sx={{ pt: 0, pb: 1 }}>
                <TableContainer>
                  <Table size="small" stickyHeader={false}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ py: 0.5, px: 1.5 }}>
                          <TableSortLabel
                            active={sortConfig[group.label]?.field === 'name' || !sortConfig[group.label]}
                            direction={sortConfig[group.label]?.field === 'name' ? sortConfig[group.label].order : 'asc'}
                            onClick={() => handleSort(group.label, 'name')}
                          >
                            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
                              Name
                            </Typography>
                          </TableSortLabel>
                        </TableCell>
                        {weeks.map((week) => (
                          <TableCell key={week} align="center" sx={{ py: 0.5, px: 0.75 }}>
                            <TableSortLabel
                              active={sortConfig[group.label]?.field === week}
                              direction={sortConfig[group.label]?.field === week ? sortConfig[group.label].order : 'asc'}
                              onClick={() => handleSort(group.label, week)}
                            >
                              <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                                {formatWeekLabel(week)}
                              </Typography>
                            </TableSortLabel>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {getSortedRows(group.rows, group.label).map((row) => (
                        <TableRow
                          key={row.staffId}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '& .MuiTableCell-root': { py: 0.5 },
                          }}
                          onClick={() => onSelectStaff(row.staffId)}
                        >
                          <TableCell sx={{ minWidth: 120, px: 1.5 }}>
                            <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ fontSize: '0.8rem' }}>
                              {row.name}
                            </Typography>
                          </TableCell>
                          {weeks.map((week) => {
                            const match = row.weeks.find((w) => w.week === week);
                            const count = match?.count ?? 0;
                            return (
                              <TableCell key={`${row.staffId}-${week}`} align="center" sx={{ px: 0.75 }}>
                                <Box
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 24,
                                    height: 24,
                                    borderRadius: 0.75,
                                    bgcolor: getHeatColor(count),
                                    color: count > 0 ? 'common.white' : 'text.secondary',
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
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

export default Dashboard;
