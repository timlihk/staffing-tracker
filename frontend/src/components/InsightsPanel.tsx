import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { DashboardSummary } from '../types';

interface InsightsPanelProps {
  data: DashboardSummary;
  timeRange: number;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({ data }) => {
  // Calculate max values for progress bars
  const maxCategoryCount = Math.max(...data.projectsByCategory.map(c => c.count), 1);
  const maxStatusCount = Math.max(...data.projectsByStatus.map(s => s.count), 1);
  const maxSectorCount = Math.max(...data.projectsBySector.map(s => s.count), 1);
  const maxSideCount = Math.max(...data.projectsBySide.map(s => s.count), 1);
  const maxRoleCount = Math.max(...data.staffByRole.map(r => r.count), 1);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6" fontWeight={700}>
          Insights
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Summary Cards */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Paper sx={{
              flex: '1 1 calc(33.333% - 11px)',
              minWidth: 200,
              p: 3,
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                Active Projects
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                {data.summary.activeProjects}
              </Typography>
            </Paper>
            <Paper sx={{
              flex: '1 1 calc(33.333% - 11px)',
              minWidth: 200,
              p: 3,
              bgcolor: 'warning.main',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                Pending Confirm
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                {data.summary.pendingConfirmations}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9, mt: 0.5 }}>
                {'> 7 days'}
              </Typography>
            </Paper>
            <Paper sx={{
              flex: '1 1 calc(33.333% - 11px)',
              minWidth: 200,
              p: 3,
              bgcolor: 'success.main',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                Active Staff
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                {data.summary.activeStaff}
              </Typography>
            </Paper>
          </Box>

          {/* 7-Day Trends */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              7-Day Trends
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  flex: '1 1 calc(25% - 12px)',
                  minWidth: 180,
                  minHeight: 40
                }}
              >
                <TrendingUpIcon color="success" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">New Projects</Typography>
                </Box>
                <Chip label={data.sevenDayTrends.newProjects} color="success" />
              </Stack>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  flex: '1 1 calc(25% - 12px)',
                  minWidth: 180,
                  minHeight: 40
                }}
              >
                <TrendingDownIcon color="error" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">Suspended</Typography>
                </Box>
                <Chip label={data.sevenDayTrends.suspended} color="error" />
              </Stack>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  flex: '1 1 calc(25% - 12px)',
                  minWidth: 180,
                  minHeight: 40
                }}
              >
                <TrendingDownIcon color="warning" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">Slow-down</Typography>
                </Box>
                <Chip label={data.sevenDayTrends.slowdown} color="warning" />
              </Stack>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  flex: '1 1 calc(25% - 12px)',
                  minWidth: 180,
                  minHeight: 40
                }}
              >
                <TrendingUpIcon color="info" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">Resumed</Typography>
                </Box>
                <Chip label={data.sevenDayTrends.resumed} color="info" />
              </Stack>
            </Box>
          </Paper>

          {/* Projects Breakdown */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Paper sx={{
              flex: '1 1 calc(25% - 12px)',
              minWidth: 200,
              p: 2.5,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Projects by Category
              </Typography>
              <Stack spacing={1.5} sx={{ flex: 1 }}>
                {data.projectsByCategory.map((item) => (
                  <Box key={item.category}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="caption" fontWeight={500}>{item.category}</Typography>
                      <Typography variant="caption" fontWeight={700} color="primary.main">
                        {item.count}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(item.count / maxCategoryCount) * 100}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>
                ))}
              </Stack>
            </Paper>
            <Paper sx={{
              flex: '1 1 calc(25% - 12px)',
              minWidth: 200,
              p: 2.5,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Projects by Status
              </Typography>
              <Stack spacing={1.5} sx={{ flex: 1 }}>
                {data.projectsByStatus.map((item) => (
                  <Box key={item.status}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="caption" fontWeight={500}>{item.status}</Typography>
                      <Typography variant="caption" fontWeight={700} color="primary.main">
                        {item.count}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(item.count / maxStatusCount) * 100}
                      color={item.status === 'Active' ? 'success' : item.status === 'Slow-down' ? 'warning' : 'error'}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>
                ))}
              </Stack>
            </Paper>
            <Paper sx={{
              flex: '1 1 calc(25% - 12px)',
              minWidth: 200,
              p: 2.5,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Projects by Sector
              </Typography>
              <Stack spacing={1.5} sx={{ flex: 1 }}>
                {data.projectsBySector.length > 0 ? (
                  data.projectsBySector.map((item) => (
                    <Box key={item.sector || 'Unknown'}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="caption" fontWeight={500}>{item.sector || 'Unknown'}</Typography>
                        <Typography variant="caption" fontWeight={700} color="primary.main">
                          {item.count}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={(item.count / maxSectorCount) * 100}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>
                  ))
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No sector data
                  </Typography>
                )}
              </Stack>
            </Paper>
            <Paper sx={{
              flex: '1 1 calc(25% - 12px)',
              minWidth: 200,
              p: 2.5,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Projects by Side
              </Typography>
              <Stack spacing={1.5} sx={{ flex: 1 }}>
                {data.projectsBySide.length > 0 ? (
                  data.projectsBySide.map((item) => (
                    <Box key={item.side || 'Unknown'}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="caption" fontWeight={500}>{item.side || 'Unknown'}</Typography>
                        <Typography variant="caption" fontWeight={700} color="primary.main">
                          {item.count}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={(item.count / maxSideCount) * 100}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>
                  ))
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No side data
                  </Typography>
                )}
              </Stack>
            </Paper>
          </Box>

          {/* Staff Breakdown */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Paper sx={{
              flex: '1 1 calc(25% - 12px)',
              minWidth: 200,
              p: 2.5,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Staff by Role
              </Typography>
              <Stack spacing={1.5} sx={{ flex: 1 }}>
                {data.staffByRole.map((item) => (
                  <Box key={item.position}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="caption" fontWeight={500}>{item.position}</Typography>
                      <Typography variant="caption" fontWeight={700} color="primary.main">
                        {item.count}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(item.count / maxRoleCount) * 100}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>
                ))}
              </Stack>
            </Paper>
            <Paper sx={{
              flex: '1 1 calc(75% - 12px)',
              minWidth: 450,
              p: 2.5,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Top Assigned Staff
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {data.topAssignedStaff.length > 0 ? (
                  data.topAssignedStaff.map((staff, index) => (
                    <Paper
                      key={staff.staffId}
                      variant="outlined"
                      sx={{
                        flex: '1 1 calc(20% - 12px)',
                        minWidth: 80,
                        p: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center'
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ fontSize: '1.25rem' }}>
                        {staff.projectCount}
                      </Typography>
                      <Typography variant="caption" fontWeight={500} sx={{ mt: 0.5 }} noWrap>
                        {staff.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        project{staff.projectCount !== 1 ? 's' : ''}
                      </Typography>
                    </Paper>
                  ))
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2, width: '100%' }}>
                    No assignments yet
                  </Typography>
                )}
              </Box>
            </Paper>
          </Box>

        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export default InsightsPanel;
