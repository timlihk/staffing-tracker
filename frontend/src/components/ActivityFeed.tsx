import { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Box,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ChangeCircle,
  PersonAdd,
} from '@mui/icons-material';
import api from '../api/client';
import type { ActivityLog } from '../types';

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'create':
      return <Add color="success" />;
    case 'update':
      return <Edit color="primary" />;
    case 'delete':
      return <Delete color="error" />;
    case 'status_change':
      return <ChangeCircle color="warning" />;
    case 'assign':
      return <PersonAdd color="info" />;
    default:
      return <ChangeCircle />;
  }
};

const ActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await api.get('/dashboard/activity-log', {
          params: { limit: 10 },
        });
        setActivities(response.data.data);
      } catch (error) {
        console.error('Failed to fetch activity log:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Recent Activity
      </Typography>
      <List>
        {activities.length === 0 ? (
          <ListItem>
            <ListItemText primary="No recent activity" />
          </ListItem>
        ) : (
          activities.map((activity) => (
            <ListItem key={activity.id}>
              <ListItemIcon>{getActionIcon(activity.actionType)}</ListItemIcon>
              <ListItemText
                primary={activity.description}
                secondary={new Date(activity.createdAt).toLocaleString()}
              />
              <Chip
                label={activity.entityType}
                size="small"
                variant="outlined"
              />
            </ListItem>
          ))
        )}
      </List>
    </Paper>
  );
};

export default ActivityFeed;
