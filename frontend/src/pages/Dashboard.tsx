import { Grid, Typography, Box } from '@mui/material';
import SummaryCards from '../components/SummaryCards';
import ActivityFeed from '../components/ActivityFeed';
import { Page, DashboardSkeleton } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { ProjectStatusChart, ProjectCategoryChart } from '../components/dashboard';

const Dashboard = () => {
  const { data: summary, isLoading, error } = useDashboard();

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

  if (!summary) {
    return <Typography>No dashboard data available</Typography>;
  }

  return (
    <Page title="Dashboard">
      <SummaryCards summary={summary} />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <ProjectStatusChart data={summary.projectsByStatus} />
        </Grid>

        <Grid item xs={12} md={6}>
          <ProjectCategoryChart data={summary.projectsByCategory} />
        </Grid>

        <Grid item xs={12}>
          <ActivityFeed />
        </Grid>
      </Grid>
    </Page>
  );
};

export default Dashboard;
