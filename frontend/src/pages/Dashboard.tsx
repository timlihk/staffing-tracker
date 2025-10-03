import { Fragment } from 'react';
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
} from '@mui/material';
import SummaryCards from '../components/SummaryCards';
import ActivityFeed from '../components/ActivityFeed';
import { Page, DashboardSkeleton } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { ProjectStatusChart, ProjectCategoryChart } from '../components/dashboard';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { data: summary, isLoading, error } = useDashboard();
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

  if (!summary) {
    return <Typography>No dashboard data available</Typography>;
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

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

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Upcoming Milestones (Next 60 Days)
            </Typography>
            {summary.timeline.length === 0 ? (
              <Typography color="text.secondary">No upcoming filing or listing dates.</Typography>
            ) : (
              <List sx={{ display: 'grid', gap: 1 }}>
                {summary.timeline.map((event) => (
                  <Paper
                    key={`${event.projectId}-${event.type}-${event.date}`}
                    variant="outlined"
                    sx={{ p: 2, cursor: 'pointer' }}
                    onClick={() => navigate(`/projects/${event.projectId}`)}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                        {event.projectName}
                      </Typography>
                      <Chip
                        label={event.type}
                        size="small"
                        color={event.type === 'Filing' ? 'info' : 'secondary'}
                      />
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {event.category} • {event.status}
                        {event.priority ? ` • Priority ${event.priority}` : ''}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {formatDate(event.date)}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Busy Staff (Next 60 Days)
            </Typography>
            {summary.busyStaff.length === 0 ? (
              <Typography color="text.secondary">No staff assigned to upcoming milestones.</Typography>
            ) : (
              <List dense>
                {summary.busyStaff.map((staff) => (
                  <Fragment key={staff.staffId}>
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/staff/${staff.staffId}`)}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle1" fontWeight={700}>
                              {staff.name}
                            </Typography>
                            <Chip label={staff.role} size="small" />
                            <Chip label={`${staff.upcomingProjects.length} proj.`} size="small" color="primary" />
                          </Stack>
                        }
                        secondary={
                          staff.upcomingProjects.slice(0, 2).map((project) => (
                            <Typography variant="body2" color="text.secondary" key={project.projectId}>
                              {formatDate(project.date)} • {project.type} • {project.projectName}
                            </Typography>
                          ))
                        }
                      />
                    </ListItem>
                    <Divider component="li" />
                  </Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <ActivityFeed />
        </Grid>
      </Grid>
    </Page>
  );
};

export default Dashboard;
