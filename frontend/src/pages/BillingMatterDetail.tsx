import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { Page, PageHeader } from '../components/ui';
import { CmSummaryCard, EngagementCard, EngagementFormDialog, BillingInfoEditDialog, type BillingInfoFormData } from '../components/billing';
import { useBillingProjectSummary, useCreateEngagement } from '../hooks/useBilling';
import { parseEngagementId } from '../lib/billing/utils';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api/client';
import { toast } from '../lib/toast';
import type {
  BillingProjectCM,
  CreateEngagementPayload,
  EngagementDetailResponse,
} from '../api/billing';

const cardSx = {
  p: { xs: 2.5, md: 3 },
  borderRadius: 1,
};

export default function BillingMatterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number.parseInt(id || '0', 10) || 0;
  const permissions = usePermissions();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [engagementDialogOpen, setEngagementDialogOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useBillingProjectSummary(projectId, { view: 'full' });

  const project = summary?.project;
  const cmNumbers = useMemo(() => summary?.cmNumbers ?? [], [summary?.cmNumbers]);

  const [selectedCmIndex, setSelectedCmIndex] = useState(0);
  const selectedCm: BillingProjectCM | null = cmNumbers[selectedCmIndex] ?? null;
  const selectedCmId = parseEngagementId(selectedCm?.cm_id);

  // All engagement details come from the full summary response
  const engagementDetails = useMemo<EngagementDetailResponse[]>(() => {
    const list = selectedCm?.engagements;
    return Array.isArray(list) ? list : [];
  }, [selectedCm?.engagements]);

  useEffect(() => {
    if (!cmNumbers.length) {
      setSelectedCmIndex(0);
      return;
    }
    setSelectedCmIndex((prev) => (prev < cmNumbers.length ? prev : 0));
  }, [cmNumbers]);

  const createEngagementMutation = useCreateEngagement();

  const handleSaveBillingInfo = async (data: BillingInfoFormData) => {
    try {
      await api.put(`/billing/projects/${projectId}`, data);
      await refetchSummary();
    } catch (error) {
      toast.error('Failed to update billing information', 'Please try again later');
      throw error;
    }
  };

  const handleCreateEngagement = async (data: CreateEngagementPayload) => {
    if (!selectedCmId) return;
    try {
      await createEngagementMutation.mutateAsync({
        projectId,
        cmId: selectedCmId,
        data,
      });
      setEngagementDialogOpen(false);
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
      ) : cmNumbers.length === 0 ? (
        <CardMessage
          title="No C/M numbers linked"
          description="Add a C/M number to this project to see billing activity and milestones."
        />
      ) : (
        <Stack spacing={3}>
          <Paper sx={{ p: { xs: 1, md: 1.5 }, borderRadius: 1 }}>
            <Tabs
              value={selectedCmIndex}
              onChange={(_, value) => setSelectedCmIndex(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {cmNumbers.map((cm, index) => (
                <Tab
                  key={String(cm.cm_id ?? cm.cm_no ?? index)}
                  value={index}
                  label={
                    <Stack spacing={0.25} alignItems="flex-start">
                      <Typography variant="body2" fontWeight={600}>
                        {cm.cm_no || 'CM \u2014'}
                      </Typography>
                    </Stack>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
              ))}
            </Tabs>
          </Paper>

          <CmSummaryCard
            project={project}
            cm={selectedCm}
            engagementSummary={null}
            detail={null}
            loading={summaryLoading}
            onEdit={() => setEditDialogOpen(true)}
            canEdit={permissions.isAdmin}
          />

          {engagementDetails.length === 0 ? (
            <Paper sx={cardSx}>
              <Stack spacing={1.5}>
                <Typography variant="h6">Engagements</Typography>
                <Alert severity="info">No engagements are linked to this C/M yet.</Alert>
              </Stack>
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
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setEngagementDialogOpen(true)}
              sx={{ alignSelf: 'flex-start' }}
            >
              Add Engagement
            </Button>
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

      <EngagementFormDialog
        open={engagementDialogOpen}
        saving={createEngagementMutation.isPending}
        onClose={() => setEngagementDialogOpen(false)}
        onSave={handleCreateEngagement}
      />
    </Page>
  );
}

function CardMessage({ title, description }: { title: string; description: string }) {
  return (
    <Paper sx={cardSx}>
      <Stack spacing={1.5}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </Paper>
  );
}
