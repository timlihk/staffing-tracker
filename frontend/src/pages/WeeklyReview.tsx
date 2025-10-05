import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Stack,
  Chip,
  Alert,
  AlertTitle,
  Divider,
  Card,
  CardContent,
  CardActions,
  Grid,
} from '@mui/material';
import {
  CheckCircleOutline,
  WarningAmber,
  Visibility,
  CheckCircle,
  Edit,
} from '@mui/icons-material';
import { Page, PageHeader } from '../components/ui';
import { useProjectsNeedingAttention, useConfirmProject } from '../hooks/useProjects';

const WeeklyReview: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useProjectsNeedingAttention();
  const confirmProject = useConfirmProject();

  if (isLoading) {
    return (
      <Page>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Page>
    );
  }

  const { needsAttention = [], allGood = [], summary } = data || {};

  const handleConfirm = async (projectId: number, attentionReasons: string[]) => {
    // Check if project has missing data issues
    const hasMissingData = attentionReasons.some(reason =>
      reason.includes('not assigned') ||
      reason.includes('not set') ||
      reason.includes('No team')
    );

    if (hasMissingData) {
      return; // Button should be disabled, but just in case
    }

    await confirmProject.mutateAsync(projectId);
    refetch();
  };

  return (
    <Page>
      <PageHeader
        title="Weekly Review"
        subtitle="Review and confirm your project details"
      />

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, bgcolor: 'primary.50', border: 1, borderColor: 'primary.200' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'primary.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h5" fontWeight={800} color="primary.dark">
                  {summary?.totalProjects || 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Projects
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  Assigned to You
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, bgcolor: 'warning.50', border: 1, borderColor: 'warning.200' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'warning.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h5" fontWeight={800} color="warning.dark">
                  {summary?.needingAttention || 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Need Attention
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  Require Review
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, bgcolor: 'success.50', border: 1, borderColor: 'success.200' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'success.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h5" fontWeight={800} color="success.dark">
                  {summary?.allGood || 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  All Good
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  Up to Date
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Projects Needing Attention */}
      {needsAttention.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <WarningAmber color="warning" fontSize="large" />
            <Box>
              <Typography variant="h5" fontWeight={700}>
                Projects Needing Attention ({needsAttention.length})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                These projects have issues or haven't been confirmed recently
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={2}>
            {needsAttention.map((project: any) => (
              <Card key={project.id} variant="outlined" sx={{ borderColor: 'warning.main', borderWidth: 2 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="h6" fontWeight={700} gutterBottom>
                          {project.name}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip label={project.status} size="small" color={project.status === 'Active' ? 'success' : 'warning'} />
                          <Chip label={project.category} size="small" variant="outlined" />
                          {project.priority && <Chip label={`Priority: ${project.priority}`} size="small" />}
                        </Stack>
                      </Box>
                      <Chip
                        label={`Urgency: ${project.urgencyScore || 0}`}
                        color="warning"
                        size="small"
                      />
                    </Stack>

                    {(() => {
                      const hasMissingData = project.attentionReasons?.some((reason: string) =>
                        reason.includes('not assigned') ||
                        reason.includes('not set') ||
                        reason.includes('No team')
                      );

                      return (
                        <Alert severity={hasMissingData ? 'error' : 'warning'} icon={<WarningAmber />}>
                          <AlertTitle>{hasMissingData ? 'Missing Information - Cannot Confirm!' : 'Issues Found:'}</AlertTitle>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {project.attentionReasons?.map((reason: string, idx: number) => (
                              <li key={idx}>
                                <Typography variant="body2">{reason}</Typography>
                              </li>
                            ))}
                          </ul>
                          {hasMissingData && (
                            <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>
                              Please edit this project to add the missing information.
                            </Typography>
                          )}
                        </Alert>
                      );
                    })()}

                    {project.assignments && project.assignments.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" gutterBottom fontWeight={600}>
                          Team Structure:
                        </Typography>
                        <Stack spacing={0.5}>
                          {/* Partner */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90, fontWeight: 600 }}>
                              Partner:
                            </Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {project.assignments
                                .filter((a: any) => a.staff?.position === 'Partner')
                                .map((assignment: any) => (
                                  <Chip
                                    key={assignment.id}
                                    label={assignment.staff?.name}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                ))}
                              {project.assignments.filter((a: any) => a.staff?.position === 'Partner').length === 0 && (
                                <Typography variant="caption" color="text.disabled">None</Typography>
                              )}
                            </Stack>
                          </Box>

                          {/* Associate */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90, fontWeight: 600 }}>
                              Associate:
                            </Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {project.assignments
                                .filter((a: any) => a.staff?.position === 'Associate')
                                .map((assignment: any) => (
                                  <Chip
                                    key={assignment.id}
                                    label={assignment.staff?.name}
                                    size="small"
                                    color="secondary"
                                    variant="outlined"
                                  />
                                ))}
                              {project.assignments.filter((a: any) => a.staff?.position === 'Associate').length === 0 && (
                                <Typography variant="caption" color="text.disabled">None</Typography>
                              )}
                            </Stack>
                          </Box>

                          {/* Senior FLIC */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90, fontWeight: 600 }}>
                              Senior FLIC:
                            </Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {project.assignments
                                .filter((a: any) => a.staff?.position === 'Senior FLIC')
                                .map((assignment: any) => (
                                  <Chip
                                    key={assignment.id}
                                    label={assignment.staff?.name}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              {project.assignments.filter((a: any) => a.staff?.position === 'Senior FLIC').length === 0 && (
                                <Typography variant="caption" color="text.disabled">None</Typography>
                              )}
                            </Stack>
                          </Box>

                          {/* Junior FLIC */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90, fontWeight: 600 }}>
                              Junior FLIC:
                            </Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {project.assignments
                                .filter((a: any) => a.staff?.position === 'Junior FLIC')
                                .map((assignment: any) => (
                                  <Chip
                                    key={assignment.id}
                                    label={assignment.staff?.name}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              {project.assignments.filter((a: any) => a.staff?.position === 'Junior FLIC').length === 0 && (
                                <Typography variant="caption" color="text.disabled">None</Typography>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', gap: 1, px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    startIcon={<Visibility />}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    View Details
                  </Button>
                  {(() => {
                    const hasMissingData = project.attentionReasons?.some((reason: string) =>
                      reason.includes('not assigned') ||
                      reason.includes('not set') ||
                      reason.includes('No team')
                    );

                    if (hasMissingData) {
                      return (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Edit />}
                          onClick={() => navigate(`/projects/${project.id}/edit`)}
                        >
                          Edit to Fix
                        </Button>
                      );
                    }

                    return (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<CheckCircleOutline />}
                        onClick={() => handleConfirm(project.id, project.attentionReasons)}
                        disabled={confirmProject.isPending}
                      >
                        Confirm Details
                      </Button>
                    );
                  })()}
                </CardActions>
              </Card>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Empty State */}
      {needsAttention.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CheckCircleOutline sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            All Projects Confirmed!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            All your projects are up to date. No action needed this week.
          </Typography>
        </Paper>
      )}
    </Page>
  );
};

export default WeeklyReview;
