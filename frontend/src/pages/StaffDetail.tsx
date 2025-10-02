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
  Card,
  CardContent,
} from '@mui/material';
import { ArrowBack, Edit } from '@mui/icons-material';
import api from '../api/client';
import { Staff } from '../types';

const StaffDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await api.get(`/staff/${id}`);
        setStaff(response.data);
      } catch (error) {
        console.error('Failed to fetch staff:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
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

  const totalAllocation = activeProjects.reduce(
    (sum, assignment) => sum + assignment.allocationPercentage,
    0
  );

  const isOverAllocated = totalAllocation > 100;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/staff')}
          >
            Back
          </Button>
          <Typography variant="h4">{staff.name}</Typography>
          <Chip
            label={staff.status}
            color={staff.status === 'active' ? 'success' : 'default'}
          />
        </Box>
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={() => navigate(`/staff/${id}/edit`)}
        >
          Edit
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Staff Information */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Staff Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Role
                </Typography>
                <Typography>{staff.role}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Department
                </Typography>
                <Typography>{staff.department || '-'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Email
                </Typography>
                <Typography>{staff.email || '-'}</Typography>
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

        {/* Workload Summary */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Active Projects
                  </Typography>
                  <Typography variant="h4">{activeProjects.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Allocation
                  </Typography>
                  <Typography
                    variant="h4"
                    color={isOverAllocated ? 'error' : 'inherit'}
                  >
                    {totalAllocation}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Capacity Status
                  </Typography>
                  <Chip
                    label={isOverAllocated ? 'Over Allocated' : 'Available'}
                    color={isOverAllocated ? 'error' : 'success'}
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Projects List */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Project Assignments
            </Typography>
            <Divider sx={{ mb: 2 }} />
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
                      <TableCell align="right">Allocation</TableCell>
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
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2">
                              {assignment.project?.name}
                            </Typography>
                            {assignment.isLead && (
                              <Chip label="Lead" size="small" color="primary" />
                            )}
                          </Box>
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
                        <TableCell align="right">
                          <Typography
                            color={
                              assignment.project?.status === 'Active' ||
                              assignment.project?.status === 'Slow-down'
                                ? 'inherit'
                                : 'text.secondary'
                            }
                          >
                            {assignment.allocationPercentage}%
                          </Typography>
                        </TableCell>
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
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default StaffDetail;
