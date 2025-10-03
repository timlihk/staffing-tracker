import { Grid, Paper, Typography, Box } from '@mui/material';
import { FolderOpen, Event, EventAvailable } from '@mui/icons-material';

interface SummaryCardsProps {
  activeProjects: number;
  filingsUpcoming: number;
  listingsUpcoming: number;
}

const SummaryCards = ({ activeProjects, filingsUpcoming, listingsUpcoming }: SummaryCardsProps) => {
  const cards = [
    {
      title: 'Active Projects',
      value: activeProjects,
      icon: <FolderOpen sx={{ fontSize: 40 }} />,
      color: '#4CAF50',
    },
    {
      title: 'Filings (30 days)',
      value: filingsUpcoming,
      icon: <Event sx={{ fontSize: 40 }} />,
      color: '#2196F3',
    },
    {
      title: 'Listings (30 days)',
      value: listingsUpcoming,
      icon: <EventAvailable sx={{ fontSize: 40 }} />,
      color: '#673AB7',
    },
  ];

  return (
    <Grid container spacing={2} alignItems="stretch">
      {cards.map((card, index) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
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
