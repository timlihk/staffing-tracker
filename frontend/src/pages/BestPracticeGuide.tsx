import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { Page, PageHeader, Section } from '../components/ui';

const roleGuidelines = [
  {
    role: 'Deal Team Members',
    tasks: [
      'Create the project record first.',
      'Keep project status current for staffing visibility.',
      'Keep lifecycle stage current to support billing milestone tracking.',
      'Create a new engagement (not a new project) when scope changes under the same C/M number.',
      'Draft and maintain milestone reference language from the engagement letter.',
    ],
  },
  {
    role: 'Finance Team',
    tasks: [
      'Co-confirm billing details with Deal Team.',
      'Validate signed date and Long Stop Date (LSD) for each engagement.',
      'Review milestone structure and dates for billing accuracy.',
      'Ensure each engagement card only contains its own milestones.',
    ],
  },
  {
    role: 'Managers',
    tasks: [
      'Review data quality and role accountability.',
      'Escalate missing critical dates (signed date, LSD).',
      'Ensure status/lifecycle updates happen in time for reporting and billing operations.',
    ],
  },
];

const staffingStatuses = [
  'Active',
  'Slow-down',
  'Suspended (use as "Paused")',
  'Terminated',
  'Closed',
];

const lifecycleStages = [
  {
    stage: 'New engagement',
    appValue: 'Signed',
    purpose: 'Marks engagement start and triggers milestone tracking readiness.',
  },
  {
    stage: 'Kickoff',
    appValue: 'Kickoff',
    purpose: 'Confirms active execution phase.',
  },
  {
    stage: 'Confidential filing submitted',
    appValue: 'Confidential Filed',
    purpose: 'Captures a key filing milestone.',
  },
  {
    stage: 'A1 submitted',
    appValue: 'A1 Filed',
    purpose: 'Tracks major submission progression.',
  },
  {
    stage: 'Hearing passed',
    appValue: 'Hearing Passed',
    purpose: 'Marks approval checkpoint for upcoming listing work.',
  },
  {
    stage: 'Listing completed',
    appValue: 'Listed',
    purpose: 'Marks listing completion milestone.',
  },
  {
    stage: 'Renewal cycle started',
    appValue: 'Renewal Cycle',
    purpose: 'Tracks recurring post-listing lifecycle work.',
  },
];

export default function BestPracticeGuide() {
  return (
    <Page>
      <PageHeader
        title="Best Practice Guide"
        subtitle="Simple, first-principle rules for entering and editing project and billing information."
      />

      <Alert severity="info">
        First principle: one real-world unit of work should map to one clean record structure in the app.
      </Alert>

      <Section title="Core Principles">
        <Stack spacing={1}>
          <Typography variant="body2">
            1. Keep one source of truth per concept: one project, one C/M stream, one engagement card per engagement.
          </Typography>
          <Typography variant="body2">
            2. Update data at the time of change (status, lifecycle stage, milestone dates).
          </Typography>
          <Typography variant="body2">
            3. Prioritize critical dates over perfect completeness: signed date and LSD are mandatory checkpoints.
          </Typography>
          <Typography variant="body2">
            4. Do not combine different engagement milestones in a single engagement card.
          </Typography>
        </Stack>
      </Section>

      <Section title="Role Ownership">
        <Stack spacing={2}>
          {roleGuidelines.map((group) => (
            <Box
              key={group.role}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                {group.role}
              </Typography>
              <Stack spacing={0.75}>
                {group.tasks.map((task) => (
                  <Typography key={task} variant="body2" color="text.secondary">
                    - {task}
                  </Typography>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Section>

      <Section title="Deal Team: Project Setup and Maintenance">
        <Stack spacing={2}>
          <Typography variant="body2">
            1. Create the project first, then maintain status and lifecycle stage continuously.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {staffingStatuses.map((status) => (
              <Chip key={status} label={status} size="small" />
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary">
            Use these statuses to keep staffing input reliable. If your team says "Paused", select{' '}
            <strong>Suspended</strong> in the app.
          </Typography>
        </Stack>
      </Section>

      <Section title="Lifecycle Stage List (Billing Milestone Tracking)">
        <Stack spacing={1.25}>
          {lifecycleStages.map((item, index) => (
            <Box key={item.stage} sx={{ borderLeft: '3px solid', borderColor: 'divider', pl: 1.5 }}>
              <Typography variant="body2" fontWeight={600}>
                {index + 1}. {item.stage}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                App value: {item.appValue} | Purpose: {item.purpose}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>

      <Section title="Billing Best Practice (Deal Team + Finance)">
        <Stack spacing={1}>
          <Typography variant="body2">
            1. Under one C/M number, if there is new work scope, create a <strong>new engagement</strong> (do not
            create another project just to reuse the same C/M number).
          </Typography>
          <Typography variant="body2">
            2. In billing detail, add/select the correct engagement first, then paste engagement letter milestone
            language into <strong>Milestone Reference Text</strong>.
          </Typography>
          <Typography variant="body2">
            3. Add or edit milestones through <strong>Add milestone</strong> and keep them engagement-specific.
          </Typography>
          <Typography variant="body2">
            4. If milestones belong to a different engagement, create a new engagement card. Do not mix two
            engagements in one card.
          </Typography>
        </Stack>
      </Section>

      <Section title="Minimum Required Data Quality Standard">
        <Stack spacing={1}>
          <Typography variant="body2">
            Enter as much information as possible, but always ensure these are present and accurate:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            - Signed Date (engagement-level)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            - Long Stop Date / LSD (engagement fee arrangement)
          </Typography>
          <Typography variant="body2">
            These two dates are the minimum required foundation for reliable milestone tracking.
          </Typography>
        </Stack>
      </Section>
    </Page>
  );
}
