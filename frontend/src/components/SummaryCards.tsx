import { Grid, Paper, Typography, Box } from '@mui/material';
import { FolderOpen, People, TrendingDown, PauseCircle } from '@mui/icons-material';
import type { DashboardSummary } from '../types';

interface SummaryCardsProps {
  summary: DashboardSummary;
}

const SummaryCards = ({ summary }: SummaryCardsProps) => {
  const cards = [
    {
      title: 'Active Projects',
      value: summary.summary.activeProjects,
      icon: <FolderOpen sx={{ fontSize: 40 }} />,
      color: '#4CAF50',
    },
    {
      title: 'Total Staff',
      value: summary.summary.totalStaff,
      icon: <People sx={{ fontSize: 40 }} />,
      color: '#2196F3',
    },
    {
      title: 'Slow-down',
      value: summary.summary.slowdownProjects,
      icon: <TrendingDown sx={{ fontSize: 40 }} />,
      color: '#FF9800',
    },
    {
      title: 'Suspended',
      value: summary.summary.suspendedProjects,
      icon: <PauseCircle sx={{ fontSize: 40 }} />,
      color: '#F44336',
    },
  ];

  return (
    <Grid container spacing={3}>
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Paper
            sx={{
              p: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography color="text.secondary" variant="body2" gutterBottom>
                {card.title}
              </Typography>
              <Typography variant="h4">{card.value}</Typography>
            </Box>
            <Box sx={{ color: card.color }}>{card.icon}</Box>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};

export default SummaryCards;
