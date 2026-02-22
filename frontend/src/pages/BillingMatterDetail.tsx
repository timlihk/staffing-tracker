import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { Page, PageHeader } from '../components/ui';
import { CmSummaryCard, EngagementCard, EngagementFormCard, BillingInfoEditDialog, type BillingInfoFormData } from '../components/billing';
import { useBillingProjectSummary } from '../hooks/useBilling';
import { parseEngagementId } from '../lib/billing/utils';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api/client';
import { toast } from '../lib/toast';
import type { EngagementDetailResponse } from '../api/billing';

export default function BillingMatterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number.parseInt(id || '0', 10) || 0;
  const permissions = usePermissions();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showEngagementForm, setShowEngagementForm] = useState(false);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useBillingProjectSummary(projectId, { view: 'full' });

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
    try {
      await api.put(`/billing/projects/${projectId}`, data);
      await refetchSummary();
    } catch (error) {
      toast.error('Failed to update billing information', 'Please try again later');
      throw error;
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
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/billing')} variant="outlined">
            Back to list
          </Button>
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
        </Stack>
      )}

      {project && (
        <BillingInfoEditDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSave={handleSaveBillingInfo}
          project={project}
        />
      )}

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
