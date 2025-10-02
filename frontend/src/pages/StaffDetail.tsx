import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stack,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Add,
  Update,
  Delete as DeleteIcon,
  ChangeCircle,
} from '@mui/icons-material';
import api from '../api/client';
import { Staff, ChangeHistory } from '../types';
import { Page, Section } from '../components/ui';

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'create':
      return <Add color="success" />;
    case 'update':
      return <Update color="primary" />;
    case 'delete':
      return <DeleteIcon color="error" />;
    case 'status_change':
      return <ChangeCircle color="warning" />;
    default:
      return <ChangeCircle />;
  }
};

const StaffDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [staffResponse, changeHistoryResponse] = await Promise.all([
          api.get(`/staff/${id}`),
          api.get(`/staff/${id}/change-history`),
        ]);
        setStaff(staffResponse.data);
        setChangeHistory(changeHistoryResponse.data);
      } catch (error) {
        console.error('Failed to fetch staff:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!staff) {
    return <Typography>Staff member not found</Typography>;
  }

  const activeProjects = staff.assignments?.filter(
    (a) => a.project?.status === 'Active' || a.project?.status === 'Slow-down'
  ) || [];

  return (
    <Page
      title={
        <Stack direction="row" spacing={2} alignItems="center">
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/staff')}>
            Back
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {staff.name}
          </Typography>
          <Chip label={staff.status} color={staff.status === 'active' ? 'success' : 'default'} />
        </Stack>
      }
      actions={
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={() => navigate(`/staff/${id}/edit`)}
        >
          Edit
        </Button>
      }
    >
      <Grid container spacing={2}>
        {/* First Row: Staff Information + Active Projects Count */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Role
                </Typography>
                <Typography>{staff.role}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Department
                </Typography>
                <Typography>{staff.department || '-'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Email
                </Typography>
                <Typography>{staff.email || '-'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">
                  Active Projects
                </Typography>
                <Typography variant="h6">{activeProjects.length}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Notes
                </Typography>
                <Typography>{staff.notes || 'No notes available'}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Projects Table */}
        <Grid item xs={12}>
          <Section title="Project Assignments">
            {staff.assignments && staff.assignments.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Project Name</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Jurisdiction</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {staff.assignments.map((assignment) => (
                      <TableRow
                        key={assignment.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/projects/${assignment.projectId}`)}
                      >
                        <TableCell>
                          <Typography variant="body2">{assignment.project?.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={assignment.project?.status}
                            color={
                              assignment.project?.status === 'Active'
                                ? 'success'
                                : assignment.project?.status === 'Slow-down'
                                  ? 'warning'
                                  : 'error'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{assignment.project?.category}</TableCell>
                        <TableCell>{assignment.roleInProject}</TableCell>
                        <TableCell>{assignment.jurisdiction || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No project assignments
              </Typography>
            )}
          </Section>
        </Grid>

        {/* Change History */}
        <Grid item xs={12}>
          <Section title="Change History">
            {changeHistory.length > 0 ? (
              <List>
                {changeHistory.map((change) => (
                  <ListItem key={change.id}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getActionIcon(change.changeType)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box>
                          <Typography variant="body2" component="span" fontWeight="medium">
                            {change.fieldName}:{' '}
                          </Typography>
                          <Typography variant="body2" component="span" color="text.secondary">
                            {change.oldValue || '(empty)'}
                          </Typography>
                          <Typography variant="body2" component="span">
                            {' '}
                            →{' '}
                          </Typography>
                          <Typography variant="body2" component="span" color="primary">
                            {change.newValue || '(empty)'}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <>
                          {new Date(change.changedAt).toLocaleString()}
                          {change.username && ` • by ${change.username}`}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No changes recorded
              </Typography>
            )}
          </Section>
        </Grid>
      </Grid>
    </Page>
  );
};

export default StaffDetail;
