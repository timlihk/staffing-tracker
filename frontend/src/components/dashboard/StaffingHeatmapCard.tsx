import { useState, useEffect, useMemo } from 'react';
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
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useStaffingHeatmap } from '../../hooks/useStaffingHeatmap';
import type { DashboardSummary } from '../../types';

interface StaffingHeatmapCardProps {
  days: number;
  onSelectStaff: (id: number) => void;
}

const formatWeekLabel = (weekKey: string) => {
  const [start, end] = weekKey.split('_');
  if (!start || !end) return weekKey;
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
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

const StaffingHeatmapCard = ({ days, onSelectStaff }: StaffingHeatmapCardProps) => {
  const [milestoneType, setMilestoneType] = useState<'filing' | 'listing' | 'both'>('both');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [sortConfig, setSortConfig] = useState<Record<string, { field: 'name' | string; order: 'asc' | 'desc' }>>({});

  const { data, isLoading } = useStaffingHeatmap(days, milestoneType);

  const groups = useMemo(() => {
    return groupHeatmapByRole(data?.staffingHeatmap ?? []);
  }, [data?.staffingHeatmap]);

  const weeks = useMemo(() => {
    const set = new Set<string>();
    (data?.staffingHeatmap ?? []).forEach((row) => {
      row.weeks.forEach((week) => set.add(week.week));
    });
    return Array.from(set).sort();
  }, [data?.staffingHeatmap]);

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

  const sortedRowsByGroup = useMemo(() => {
    const map = new Map<string, DashboardSummary['staffingHeatmap']>();
    for (const group of groups) {
      const config = sortConfig[group.label];
      if (!config) {
        map.set(group.label, [...group.rows].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        map.set(group.label, [...group.rows].sort((a, b) => {
          if (config.field === 'name') {
            return config.order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
          }
          const weekA = a.weeks.find((w) => w.week === config.field)?.count ?? 0;
          const weekB = b.weeks.find((w) => w.week === config.field)?.count ?? 0;
          return config.order === 'asc' ? weekA - weekB : weekB - weekA;
        }));
      }
    }
    return map;
  }, [groups, sortConfig]);

  return (
    <Paper sx={{ p: 2.5, flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5} spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
            Staffing Heatmap
          </Typography>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={milestoneType}
              onChange={(e) => setMilestoneType(e.target.value as 'filing' | 'listing' | 'both')}
              sx={{ fontSize: '0.8rem', height: 32 }}
            >
              <MenuItem value="both">All Milestones</MenuItem>
              <MenuItem value="filing">Filing Only</MenuItem>
              <MenuItem value="listing">Listing Only</MenuItem>
            </Select>
          </FormControl>
        </Stack>
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
      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress size={24} />
        </Box>
      ) : groups.length === 0 ? (
        <Typography color="text.secondary">No staffing data for upcoming milestones.</Typography>
      ) : (
        <Stack spacing={1} sx={{ flex: 1 }}>
          {groups.map((group) => (
            <Accordion
              key={group.label}
              disableGutters
              square
              expanded={expandedGroups[group.label] ?? true}
              onChange={(_, expanded) => setExpandedGroups((prev) => ({ ...prev, [group.label]: expanded }))}
              sx={{
                '&:before': { display: 'none' },
                borderRadius: 2,
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
                            direction={
                              sortConfig[group.label]?.field === 'name' ? sortConfig[group.label].order : 'asc'
                            }
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
                      {(sortedRowsByGroup.get(group.label) ?? group.rows).map((row) => (
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
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              color="primary.main"
                              sx={{ fontSize: '0.8rem' }}
                            >
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

export default StaffingHeatmapCard;
