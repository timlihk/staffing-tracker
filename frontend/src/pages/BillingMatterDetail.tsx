import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  DeleteOutline as DeleteOutlineIcon,
} from '@mui/icons-material';
import { Page, PageHeader } from '../components/ui';
import { CmSummaryCard, EngagementCard, EngagementFormCard, BillingInfoEditDialog, DeleteConfirmDialog, BillingChangeLog, BillingNotesSection, type BillingInfoFormData } from '../components/billing';
import { useBillingProjectSummary, useDeleteProject, useUpdateBillingProject } from '../hooks/useBilling';
import { parseEngagementId } from '../lib/billing/utils';
import { usePermissions } from '../hooks/usePermissions';
import type { EngagementDetailResponse } from '../api/billing';

export default function BillingMatterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number.parseInt(id || '0', 10) || 0;
  const permissions = usePermissions();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showEngagementForm, setShowEngagementForm] = useState(false);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useBillingProjectSummary(projectId, { view: 'full' });
  const deleteProjectMutation = useDeleteProject();
  const updateProjectMutation = useUpdateBillingProject();

  const project = summary?.project;

  // Always use the first (and only) C/M number
  const selectedCm = useMemo(() => summary?.cmNumbers?.[0] ?? null, [summary?.cmNumbers]);
  const selectedCmId = parseEngagementId(selectedCm?.cm_id);

  // All engagement details come from the full summary response
  const engagementDetails = useMemo<EngagementDetailResponse[]>(() => {
    const list = selectedCm?.engagements;
    return Array.isArray(list) ? list : [];
  }, [selectedCm?.engagements]);

  const handleSaveBillingInfo = async (data: BillingInfoFormData) => {
    await updateProjectMutation.mutateAsync({ projectId, data });
  };

  const handleConfirmDeleteProject = async () => {
    try {
      await deleteProjectMutation.mutateAsync({ projectId });
      setDeleteProjectDialogOpen(false);
      navigate('/billing');
    } catch {
      // handled by mutation toast
    }
  };

  const pageSubtitle = useMemo(() => {
    if (!project) return undefined;
    return project.client_name || undefined;
  }, [project]);

  if (!projectId) {
    return (
      <Page>
        <PageHeader title="Billing matter" />
        <Alert severity="error">Invalid billing project id.</Alert>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={project?.project_name || 'Billing matter'}
        subtitle={pageSubtitle}
        actions={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/billing')} variant="outlined">
              Back to list
            </Button>
            {permissions.isAdmin && project && (
              <Button
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setDeleteProjectDialogOpen(true)}
                variant="outlined"
                color="error"
              >
                Delete Project
              </Button>
            )}
          </Stack>
        }
      />

      {summaryLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={320}>
          <CircularProgress />
        </Box>
      ) : !project ? (
        <Alert severity="warning">We could not load this billing matter.</Alert>
      ) : !selectedCm ? (
        <CardMessage
          title="No C/M number linked"
          description="Link a C/M number to this project to view billing activity and milestones."
        />
      ) : (
        <Stack spacing={3}>
          <CmSummaryCard
            project={project}
            cm={selectedCm}
            engagementSummary={null}
            detail={null}
            loading={summaryLoading}
            onEdit={() => setEditDialogOpen(true)}
            canEdit={permissions.isAdmin}
          />

          {project.staffing_project_id && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">Staffing Project:</Typography>
              <MuiLink
                component={RouterLink}
                to={`/projects/${project.staffing_project_id}`}
                sx={{ fontWeight: 500, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {project.staffing_project_name || `Project ${project.staffing_project_id}`}
              </MuiLink>
              {project.staffing_project_status && (
                <Chip label={project.staffing_project_status} size="small" variant="outlined" />
              )}
            </Stack>
          )}

          <Stack spacing={0.5}>
            <Typography variant="h6">Engagements ({engagementDetails.length})</Typography>
            <Typography variant="body2" color="text.secondary">
              Each card below is a separate engagement under this client matter. Click the header to expand or collapse details.
            </Typography>
          </Stack>

          {engagementDetails.length === 0 ? (
            <Paper sx={{ p: { xs: 2.5, md: 3 } }}>
              <Alert severity="info">No engagements are linked to this client matter yet.</Alert>
            </Paper>
          ) : (
            engagementDetails.map((engagement) => (
              <EngagementCard
                key={engagement.engagement_id}
                projectId={projectId}
                cmId={selectedCmId}
                engagement={engagement}
              />
            ))
          )}

          {permissions.isAdmin && selectedCmId && (
            showEngagementForm ? (
              <EngagementFormCard
                projectId={projectId}
                cmId={selectedCmId}
                onClose={() => setShowEngagementForm(false)}
              />
            ) : (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setShowEngagementForm(true)}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add Engagement
              </Button>
            )
          )}

          <BillingNotesSection
            projectId={projectId}
            cm={selectedCm}
            canEdit={permissions.isAdmin}
          />

          <BillingChangeLog projectId={projectId} />
        </Stack>
      )}

      {project && (
        <BillingInfoEditDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSave={handleSaveBillingInfo}
          project={project}
          cmNo={selectedCm?.cm_no}
        />
      )}

      <DeleteConfirmDialog
        open={deleteProjectDialogOpen}
        title="Delete project"
        message={`Are you sure you want to delete "${project?.project_name || 'this project'}"? This will permanently remove all engagements, milestones, and related data.`}
        deleting={deleteProjectMutation.isPending}
        onClose={() => !deleteProjectMutation.isPending && setDeleteProjectDialogOpen(false)}
        onConfirm={handleConfirmDeleteProject}
      />

    </Page>
  );
}

function CardMessage({ title, description }: { title: string; description: string }) {
  return (
    <Paper sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack spacing={1.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </Paper>
  );
}
