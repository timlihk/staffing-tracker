import { useEffect, useState } from 'react';
import { Grid, Typography, Box, CircularProgress } from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import api from '../api/client';
import type { DashboardSummary } from '../types';
import SummaryCards from '../components/SummaryCards';
import ActivityFeed from '../components/ActivityFeed';
import { Page, Section } from '../components/ui';

const COLORS = ['#4CAF50', '#FF9800', '#F44336', '#2196F3'];

const Dashboard = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get('/dashboard/summary');
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!summary) {
    return <Typography>Failed to load dashboard data</Typography>;
  }

  const statusData = summary.projectsByStatus.map(s => ({ name: s.status, value: s.count }));

  const categoryData = summary.projectsByCategory.map(c => ({
    name: c.category.replace('Projects', '').trim(),
    value: c.count,
  }));

  return (
    <Page title="Dashboard">
      <SummaryCards summary={summary} />

      <Grid container spacing={2}>
        {/* Project Status Chart */}
        <Grid item xs={12} md={6}>
          <Section title="Projects by Status">
            <Box sx={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Section>
        </Grid>

        {/* Project Category Chart */}
        <Grid item xs={12} md={6}>
          <Section title="Projects by Category">
            <Box sx={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#003D7A" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Section>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <ActivityFeed />
        </Grid>
      </Grid>
    </Page>
  );
};

export default Dashboard;
