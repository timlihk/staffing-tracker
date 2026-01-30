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
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Page, PageHeader } from '../components/ui';
import { InfoField, CmSummaryCard, FeeMilestonesCard, BillingInfoEditDialog, type BillingInfoFormData } from '../components/billing';
import { useBillingProjectSummary, useCMEngagements, useEngagementDetail } from '../hooks/useBilling';
import { parseEngagementId, mapToSummary } from '../lib/billing/utils';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api/client';
import { toast } from '../lib/toast';
import type {
  BillingProjectSummaryResponse,
  BillingProjectCM,
  CMEngagementSummary,
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

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useBillingProjectSummary(projectId, { view: 'full' });

  const project = summary?.project;
  const cmNumbers = useMemo(() => summary?.cmNumbers ?? [], [summary?.cmNumbers]);

  const [selectedCmIndex, setSelectedCmIndex] = useState(0);
  const selectedCm: BillingProjectCM | null = cmNumbers[selectedCmIndex] ?? null;
  const selectedCmId = parseEngagementId(selectedCm?.cm_id);

  const {
    data: cmEngagements = [],
    isLoading: engagementsLoading,
  } = useCMEngagements(projectId, selectedCmId ?? 0, Boolean(selectedCmId));

  const fallbackEngagements = useMemo<EngagementDetailResponse[]>(() => {
    const list = selectedCm?.engagements;
    return Array.isArray(list) ? list : [];
  }, [selectedCm?.engagements]);

  const engagementSummaries = useMemo<CMEngagementSummary[]>(() => {
    const list = cmEngagements.length ? cmEngagements : fallbackEngagements.map(mapToSummary);

    return list.reduce<CMEngagementSummary[]>((acc, eng) => {
      if (!eng) {
        return acc;
      }

      const numericId = parseEngagementId(eng.engagement_id);
      if (numericId == null) {
        return acc;
      }

      if (numericId === eng.engagement_id) {
        acc.push(eng);
      } else {
        acc.push({ ...eng, engagement_id: numericId });
      }

      return acc;
    }, []);
  }, [cmEngagements, fallbackEngagements]);
  const engagementDetails = fallbackEngagements;

  const [selectedEngagementId, setSelectedEngagementId] = useState<number | null>(() =>
    engagementSummaries[0]?.engagement_id ?? null
  );

  useEffect(() => {
    if (!cmNumbers.length) {
      setSelectedCmIndex(0);
      return;
    }

    setSelectedCmIndex((prev) => (prev < cmNumbers.length ? prev : 0));
  }, [cmNumbers]);

  useEffect(() => {
    if (!engagementSummaries.length) {
      setSelectedEngagementId(null);
      return;
    }

    setSelectedEngagementId((prev) => {
      if (
        typeof prev === 'number' &&
        !Number.isNaN(prev) &&
        engagementSummaries.some((eng) => eng.engagement_id === prev)
      ) {
        return prev;
      }

      const firstValid = engagementSummaries.find((eng) => parseEngagementId(eng.engagement_id) != null);

      return firstValid?.engagement_id ?? null;
    });
  }, [engagementSummaries]);

  const hasValidEngagementId = typeof selectedEngagementId === 'number' && !Number.isNaN(selectedEngagementId);
  const engagementIdForQuery = hasValidEngagementId ? (selectedEngagementId as number) : 0;
  const shouldFetchDetail = hasValidEngagementId && cmEngagements.length > 0;
  const {
    data: engagementDetail,
    isLoading: engagementDetailLoading,
  } = useEngagementDetail(projectId, engagementIdForQuery, shouldFetchDetail);

  const selectedEngagementSummary = useMemo<CMEngagementSummary | null>(() => {
    if (!engagementSummaries.length) return null;
    if (!hasValidEngagementId) {
      return engagementSummaries[0] ?? null;
    }
    return engagementSummaries.find((eng) => eng.engagement_id === selectedEngagementId) ?? engagementSummaries[0];
  }, [engagementSummaries, hasValidEngagementId, selectedEngagementId]);

  const fallbackDetail = useMemo<EngagementDetailResponse | null>(() => {
    if (!engagementDetails?.length) return null;
    if (!hasValidEngagementId) {
      return engagementDetails[0];
    }

    const matched = engagementDetails.find(
      (eng) => parseEngagementId(eng.engagement_id) === selectedEngagementId
    );

    return matched ?? engagementDetails[0];
  }, [engagementDetails, hasValidEngagementId, selectedEngagementId]);

  const selectedEngagement = (hasValidEngagementId ? engagementDetail : null) ?? fallbackDetail;
  const detailLoadingEffective = shouldFetchDetail ? engagementDetailLoading : false;

  const pageSubtitle = useMemo(() => {
    if (!project) return undefined;
    return project.client_name || undefined;
  }, [project]);

  const handleSaveBillingInfo = async (data: BillingInfoFormData) => {
    try {
      await api.put(`/billing/projects/${projectId}`, data);
      await refetchSummary();
    } catch (error) {
      toast.error('Failed to update billing information', 'Please try again later');
      throw error;
    }
  };

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
                        {cm.cm_no || 'CM —'}
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
            engagementSummary={selectedEngagementSummary}
            detail={selectedEngagement}
            loading={summaryLoading || engagementsLoading}
            onEdit={() => setEditDialogOpen(true)}
            canEdit={permissions.isAdmin}
          />

          <FeeMilestonesCard
            projectId={projectId}
            cmId={selectedCmId}
            engagements={engagementSummaries}
            selectedEngagementId={selectedEngagementId}
            onSelectEngagement={setSelectedEngagementId}
            detail={selectedEngagement}
            loading={engagementsLoading || detailLoadingEffective}
          />
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

// CmSummaryCard has been extracted to components/billing/CmSummaryCard.tsx
// FeeMilestonesCard has been extracted to components/billing/FeeMilestonesCard.tsx and its sub-components:
// - MilestoneReferenceSection.tsx
// - MilestoneTable.tsx
// - MilestoneReferenceDialog.tsx
// - MilestoneFormDialog.tsx
// - MilestoneDeleteDialog.tsx
