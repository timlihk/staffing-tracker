import { useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ChangeCircle as ChangeCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useBillingProjectChangeLog } from '../../hooks/useBilling';

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'create':
      return <AddIcon color="success" fontSize="small" />;
    case 'update':
      return <EditIcon color="primary" fontSize="small" />;
    case 'delete':
      return <DeleteIcon color="error" fontSize="small" />;
    default:
      return <ChangeCircleIcon fontSize="small" />;
  }
};

const formatEntityType = (entityType: string) => {
  return entityType
    .replace(/^billing_/, '')
    .replace(/_/g, ' ');
};

export interface BillingChangeLogProps {
  projectId: number;
}

export function BillingChangeLog({ projectId }: BillingChangeLogProps) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useBillingProjectChangeLog(projectId, { enabled: expanded });

  const entries = data?.data ?? [];

  return (
    <Paper sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setExpanded((prev) => !prev)}
        sx={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6">Change Log</Typography>
          {data && (
            <Chip label={`${data.total} entries`} size="small" variant="outlined" />
          )}
        </Stack>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          {isLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={24} />
            </Box>
          ) : entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No change history recorded for this project yet.
            </Typography>
          ) : (
            <List dense disablePadding>
              {entries.map((entry) => (
                <ListItem key={entry.id} sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {getActionIcon(entry.actionType)}
                  </ListItemIcon>
                  <ListItemText
                    primary={entry.description || `${entry.actionType} ${formatEntityType(entry.entityType)}`}
                    secondary={`${entry.username} \u00B7 ${new Date(entry.createdAt).toLocaleString()}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip
                    label={formatEntityType(entry.entityType)}
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1, fontSize: '0.7rem' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
