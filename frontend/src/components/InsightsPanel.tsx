import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { DashboardSummary } from '../types';

// Color palettes for different categories
const CATEGORY_COLORS = ['#1976d2', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9'];
const STATUS_COLORS = ['#4caf50', '#ff9800', '#f44336'];
const SECTOR_COLORS = ['#9c27b0', '#ab47bc', '#ba68c8', '#ce93d8'];
const SIDE_COLORS = ['#00bcd4', '#26c6da'];

interface InsightsPanelProps {
  data: DashboardSummary;
  timeRange: number;
}

// Donut Chart Component with center label
const DonutChart: React.FC<{
  data: Array<{ name: string; value: number }>;
  colors: string[];
  title: string;
}> = ({ data, colors, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1, bgcolor: 'rgba(0, 0, 0, 0.87)', color: 'white' }}>
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
    <Paper sx={{
      flex: '1 1 calc(25% - 12px)',
      minWidth: 220,
      p: 2.5,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <Box sx={{ position: 'relative', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
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
            pointerEvents: 'none'
          }}
        >
          <Typography variant="h4" fontWeight={700} color="primary.main">
            {total}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total
          </Typography>
        </Box>
      </Box>
      <Stack spacing={0.5} sx={{ mt: 2 }}>
        {data.map((item, index) => (
          <Stack key={item.name} direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: colors[index % colors.length],
                flexShrink: 0
              }}
            />
            <Typography variant="caption" sx={{ flex: 1 }}>
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
              flex: '1 1 calc(25% - 12px)',
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
              flex: '1 1 calc(25% - 12px)',
              minWidth: 200,
              p: 3,
              bgcolor: 'info.main',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                Upcoming Filing
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                {data.summary.upcomingFilings30Days}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9, mt: 0.5 }}>
                in 30 days
              </Typography>
            </Paper>
            <Paper sx={{
              flex: '1 1 calc(25% - 12px)',
              minWidth: 200,
              p: 3,
              bgcolor: 'secondary.main',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                Upcoming Listing
              </Typography>
              <Typography variant="h3" fontWeight={700}>
                {data.summary.upcomingListings30Days}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9, mt: 0.5 }}>
                in 30 days
              </Typography>
            </Paper>
            <Paper sx={{
              flex: '1 1 calc(25% - 12px)',
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
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              7-Day Trends
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {/* New Projects */}
              <Paper sx={{
                flex: '1 1 calc(25% - 12px)',
                minWidth: 200,
                p: 2.5,
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%)',
                border: '1px solid',
                borderColor: 'success.light',
                '&:hover': {
                  boxShadow: 3,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <TrendingUpIcon sx={{ fontSize: 20, color: 'success.main' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    New Projects
                  </Typography>
                </Stack>
                <Typography variant="h3" fontWeight={800} color="success.main" sx={{ mb: 1 }}>
                  {data.sevenDayTrends.newProjects}
                </Typography>
                <Typography variant="caption" color="success.dark">
                  Last 7 days
                </Typography>
              </Paper>

              {/* Suspended */}
              <Paper sx={{
                flex: '1 1 calc(25% - 12px)',
                minWidth: 200,
                p: 2.5,
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(244, 67, 54, 0.1) 0%, rgba(244, 67, 54, 0.05) 100%)',
                border: '1px solid',
                borderColor: 'error.light',
                '&:hover': {
                  boxShadow: 3,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <TrendingDownIcon sx={{ fontSize: 20, color: 'error.main' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Suspended
                  </Typography>
                </Stack>
                <Typography variant="h3" fontWeight={800} color="error.main" sx={{ mb: 1 }}>
                  {data.sevenDayTrends.suspended}
                </Typography>
                <Typography variant="caption" color="error.dark">
                  Last 7 days
                </Typography>
              </Paper>

              {/* Slow-down */}
              <Paper sx={{
                flex: '1 1 calc(25% - 12px)',
                minWidth: 200,
                p: 2.5,
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)',
                border: '1px solid',
                borderColor: 'warning.light',
                '&:hover': {
                  boxShadow: 3,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <TrendingDownIcon sx={{ fontSize: 20, color: 'warning.main' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Slow-down
                  </Typography>
                </Stack>
                <Typography variant="h3" fontWeight={800} color="warning.main" sx={{ mb: 1 }}>
                  {data.sevenDayTrends.slowdown}
                </Typography>
                <Typography variant="caption" color="warning.dark">
                  Last 7 days
                </Typography>
              </Paper>

              {/* Resumed */}
              <Paper sx={{
                flex: '1 1 calc(25% - 12px)',
                minWidth: 200,
                p: 2.5,
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 150, 243, 0.05) 100%)',
                border: '1px solid',
                borderColor: 'info.light',
                '&:hover': {
                  boxShadow: 3,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <TrendingUpIcon sx={{ fontSize: 20, color: 'info.main' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Resumed
                  </Typography>
                </Stack>
                <Typography variant="h3" fontWeight={800} color="info.main" sx={{ mb: 1 }}>
                  {data.sevenDayTrends.resumed}
                </Typography>
                <Typography variant="caption" color="info.dark">
                  Last 7 days
                </Typography>
              </Paper>
            </Box>
          </Box>

          {/* Projects Breakdown */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <DonutChart
              data={data.projectsByCategory
                .map(item => ({
                  name: item.category,
                  value: item.count
                }))
                .sort((a, b) => b.value - a.value)}
              colors={CATEGORY_COLORS}
              title="Projects by Category"
            />
            <DonutChart
              data={data.projectsByStatus
                .map(item => ({
                  name: item.status,
                  value: item.count
                }))
                .sort((a, b) => b.value - a.value)}
              colors={STATUS_COLORS}
              title="Projects by Status"
            />
            {data.projectsBySector.length > 0 ? (
              <DonutChart
                data={data.projectsBySector
                  .map(item => ({
                    name: item.sector || 'Unknown',
                    value: item.count
                  }))
                  .sort((a, b) => b.value - a.value)}
                colors={SECTOR_COLORS}
                title="Projects by Sector"
              />
            ) : (
              <Paper sx={{
                flex: '1 1 calc(25% - 12px)',
                minWidth: 220,
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography variant="caption" color="text.secondary">
                  No sector data
                </Typography>
              </Paper>
            )}
            {data.projectsBySide.length > 0 ? (
              <DonutChart
                data={data.projectsBySide
                  .map(item => ({
                    name: item.side || 'Unknown',
                    value: item.count
                  }))
                  .sort((a, b) => b.value - a.value)}
                colors={SIDE_COLORS}
                title="Projects by Side"
              />
            ) : (
              <Paper sx={{
                flex: '1 1 calc(25% - 12px)',
                minWidth: 220,
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography variant="caption" color="text.secondary">
                  No side data
                </Typography>
              </Paper>
            )}
          </Box>

        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export default InsightsPanel;
