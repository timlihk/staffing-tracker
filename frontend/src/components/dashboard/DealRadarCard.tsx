import { useState, useMemo } from 'react';
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
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import type { PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import type { DashboardSummary } from '../../types';

interface DealRadarEvent {
  date: string;
  filingCount: number;
  listingCount: number;
  events: DashboardSummary['dealRadar'];
}

interface DealRadarCardProps {
  groups: Array<{ label: string; items: DashboardSummary['dealRadar'] }>;
  onSelectProject: (id: number) => void;
  timeRange: number;
  showAllEvents: boolean;
  setShowAllEvents: (show: boolean) => void;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

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

const DealRadarCard = ({
  groups,
  onSelectProject,
  timeRange,
  showAllEvents,
  setShowAllEvents,
}: DealRadarCardProps) => {
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

  const CustomDay = (props: PickersDayProps) => {
    const { day, outsideCurrentMonth, ...other } = props;
    // Format date in local timezone to avoid UTC conversion issues
    const dayDate = day as Date;
    const year = dayDate.getFullYear();
    const month = String(dayDate.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(dayDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${dayOfMonth}`;
    const eventData = eventsByDate.get(dateKey);

    // Don't show dots for days outside the current month
    if (outsideCurrentMonth || !eventData || (eventData.filingCount === 0 && eventData.listingCount === 0)) {
      return <PickersDay day={day} outsideCurrentMonth={outsideCurrentMonth} {...other} />;
    }

    const isSelected = selectedDate === dateKey;

    // Create tooltip content showing events for this date
    const tooltipContent = (
      <Box sx={{ p: 0.5 }}>
        <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          {formatDate(dateKey)}
        </Typography>
        <Stack spacing={0.5}>
          {eventData.events.map((event, idx) => (
            <Box key={idx}>
              <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                <Chip
                  label={event.type}
                  size="small"
                  color={event.type === 'Filing' ? 'info' : 'secondary'}
                  sx={{ height: 16, fontSize: '0.65rem', mr: 0.5 }}
                />
                {event.projectName}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {event.category}
                {event.side ? ` • ${event.side}` : ''}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    );

    return (
      <Tooltip
        title={tooltipContent}
        placement="top"
        arrow
        enterDelay={300}
        leaveDelay={0}
        componentsProps={{
          tooltip: {
            sx: {
              bgcolor: 'background.paper',
              color: 'text.primary',
              boxShadow: 3,
              border: 1,
              borderColor: 'divider',
              maxWidth: 300,
            },
          },
          arrow: {
            sx: {
              color: 'background.paper',
              '&::before': {
                border: 1,
                borderColor: 'divider',
              },
            },
          },
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <PickersDay
            day={day}
            outsideCurrentMonth={outsideCurrentMonth}
            {...other}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDate((prev) => {
                if (prev === dateKey) {
                  return null;
                }
                setShowAllEvents(true);
                return dateKey;
              });
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
      </Tooltip>
    );
  };

  // Flatten all events and sort by date, filtering to show only today and future dates
  const allEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const events: Array<DashboardSummary['dealRadar'][0]> = [];
    groups.forEach((group) => {
      events.push(...group.items);
    });
    return events
      .filter((event) => {
        if (!event.date) return false;
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0); // Start of event day
        return eventDate >= today; // Only include today and future dates
      })
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  }, [groups]);

  // Filter events by selected date
  const filteredEvents = useMemo(() => {
    if (!selectedDate) return allEvents;
    return allEvents.filter((event) => {
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
            <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
              Filing
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'secondary.main' }} />
            <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
              Listing
            </Typography>
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
                  flex:
                    numMonths === 1
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
                  Project Table (Showing {displayedEvents.length} of {filteredEvents.length}{' '}
                  {filteredEvents.length === 1 ? 'event' : 'events'})
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
                              <Typography variant="body2" color="text.secondary">
                                —
                              </Typography>
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
                              <Typography variant="body2" color="text.secondary">
                                —
                              </Typography>
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
                              <Typography variant="body2" color="text.secondary">
                                —
                              </Typography>
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
                              <Typography variant="body2" color="text.secondary">
                                —
                              </Typography>
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
                  <Button variant="outlined" onClick={() => setShowAllEvents(!showAllEvents)} size="small">
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

export default DealRadarCard;
