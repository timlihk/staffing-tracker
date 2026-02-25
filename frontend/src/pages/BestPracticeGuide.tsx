import {
  Alert,
  Box,
  Chip,
  Grid,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import {
  LightbulbOutlined,
  GroupsOutlined,
  SettingsOutlined,
  TimelineOutlined,
  ReceiptLongOutlined,
  VerifiedOutlined,
  EmojiObjectsOutlined,
  Hub,
  Update,
  CalendarMonth,
  CallSplit,
  Groups,
  AccountBalance,
  SupervisorAccount,
  AddCard,
  Link as LinkIcon,
  Checklist,
  Block,
  PriorityHighRounded,
  EventBusy,
} from '@mui/icons-material';
import { Page, PageHeader, Section } from '../components/ui';
import { tokens } from '../theme';

// ---------------------------------------------------------------------------
// Section IDs for anchor navigation
// ---------------------------------------------------------------------------
const SECTION_IDS = {
  corePrinciples: 'core-principles',
  roleOwnership: 'role-ownership',
  projectSetup: 'project-setup',
  lifecycle: 'lifecycle-stages',
  billing: 'billing-best-practice',
  dataQuality: 'data-quality',
} as const;

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { label: 'Principles', sectionId: SECTION_IDS.corePrinciples, icon: <LightbulbOutlined fontSize="small" /> },
  { label: 'Roles', sectionId: SECTION_IDS.roleOwnership, icon: <GroupsOutlined fontSize="small" /> },
  { label: 'Project Setup', sectionId: SECTION_IDS.projectSetup, icon: <SettingsOutlined fontSize="small" /> },
  { label: 'Lifecycle', sectionId: SECTION_IDS.lifecycle, icon: <TimelineOutlined fontSize="small" /> },
  { label: 'Billing', sectionId: SECTION_IDS.billing, icon: <ReceiptLongOutlined fontSize="small" /> },
  { label: 'Data Quality', sectionId: SECTION_IDS.dataQuality, icon: <VerifiedOutlined fontSize="small" /> },
];

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const corePrinciples = [
  {
    title: 'One source of truth',
    description: 'One project, one C/M stream, one engagement card per engagement.',
    Icon: Hub,
  },
  {
    title: 'Update at time of change',
    description: 'Status, lifecycle stage, and milestone dates — update when it happens.',
    Icon: Update,
  },
  {
    title: 'Critical dates first',
    description: 'Signed date and LSD are mandatory. Prioritize these over perfect completeness.',
    Icon: CalendarMonth,
  },
  {
    title: 'No mixing engagements',
    description: 'Each engagement card contains only its own milestones. Never combine.',
    Icon: CallSplit,
  },
];

const roleGuidelines = [
  {
    role: 'Deal Team Members',
    color: tokens.colors.indigo[500],
    Icon: Groups,
    keyTakeaway: 'Create projects, keep status and lifecycle current.',
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
    color: tokens.colors.success,
    Icon: AccountBalance,
    keyTakeaway: 'Validate billing details, signed dates, and LSD.',
    tasks: [
      'Co-confirm billing details with Deal Team.',
      'Validate signed date and Long Stop Date (LSD) for each engagement.',
      'Review milestone structure and dates for billing accuracy.',
      'Ensure each engagement card only contains its own milestones.',
    ],
  },
  {
    role: 'Managers',
    color: tokens.colors.violet[500],
    Icon: SupervisorAccount,
    keyTakeaway: 'Review data quality and escalate missing critical dates.',
    tasks: [
      'Review data quality and role accountability.',
      'Escalate missing critical dates (signed date, LSD).',
      'Ensure status/lifecycle updates happen in time for reporting and billing operations.',
    ],
  },
];

const staffingStatuses: { label: string; chipColor: 'success' | 'warning' | 'error' | 'default' }[] = [
  { label: 'Active', chipColor: 'success' },
  { label: 'Slow-down', chipColor: 'warning' },
  { label: 'Suspended', chipColor: 'warning' },
  { label: 'Terminated', chipColor: 'error' },
  { label: 'Closed', chipColor: 'default' },
];

const lifecycleStages = [
  { stage: 'New engagement', appValue: 'Signed', purpose: 'Marks engagement start and triggers milestone tracking.', color: tokens.colors.indigo[300] },
  { stage: 'Kickoff', appValue: 'Kickoff', purpose: 'Confirms active execution phase.', color: tokens.colors.indigo[400] },
  { stage: 'Confidential filing submitted', appValue: 'Confidential Filed', purpose: 'Captures a key filing milestone.', color: tokens.colors.indigo[500] },
  { stage: 'A1 submitted', appValue: 'A1 Filed', purpose: 'Tracks major submission progression.', color: tokens.colors.indigo[600] },
  { stage: 'Hearing passed', appValue: 'Hearing Passed', purpose: 'Marks approval checkpoint for upcoming listing work.', color: tokens.colors.indigo[700] },
  { stage: 'Listing completed', appValue: 'Listed', purpose: 'Marks listing completion milestone.', color: tokens.colors.success },
  { stage: 'Renewal cycle started', appValue: 'Renewal Cycle', purpose: 'Tracks recurring post-listing lifecycle work.', color: tokens.colors.violet[500] },
];

const billingPractices = [
  {
    title: 'New scope = new engagement',
    description: 'Under one C/M number, create a new engagement for new work scope. Do not create another project.',
    Icon: AddCard,
  },
  {
    title: 'Link engagement first',
    description: 'Select the correct engagement in billing detail, then paste milestone language into Milestone Reference Text.',
    Icon: LinkIcon,
  },
  {
    title: 'Keep milestones engagement-specific',
    description: 'Add or edit milestones through Add Milestone. Each milestone belongs to one engagement only.',
    Icon: Checklist,
  },
  {
    title: 'Never mix engagements',
    description: 'If milestones belong to a different engagement, create a new engagement card. Do not combine.',
    Icon: Block,
  },
];

const SCROLL_OFFSET = '140px';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const scrollToSection = (sectionId: string) => {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const SectionTitle = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    {icon}
    <Typography variant="h6" fontWeight={700} color={tokens.colors.slate[800]}>
      {label}
    </Typography>
  </Box>
);

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function BestPracticeGuide() {
  return (
    <Page>
      <PageHeader
        title="Best Practice Guide"
        subtitle="Quick-reference rules for project, engagement, and billing data."
      />

      {/* ---- Sticky Quick Nav ---- */}
      <Box
        component="nav"
        aria-label="Best practice guide sections"
        sx={{
          position: 'sticky',
          top: { xs: 56, sm: 64 },
          zIndex: 10,
          py: 1.5,
          px: 2,
          backgroundColor: alpha(tokens.colors.slate[50], 0.92),
          backdropFilter: 'blur(12px)',
          border: `1px solid ${tokens.colors.slate[200]}`,
          borderRadius: 3,
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {NAV_ITEMS.map((item) => (
          <Chip
            key={item.sectionId}
            icon={item.icon}
            label={item.label}
            onClick={() => scrollToSection(item.sectionId)}
            variant="outlined"
            clickable
            sx={{
              borderColor: tokens.colors.slate[300],
              '&:hover': {
                borderColor: tokens.colors.indigo[400],
                backgroundColor: alpha(tokens.colors.indigo[500], 0.08),
              },
            }}
          />
        ))}
      </Box>

      {/* ---- Golden Rule ---- */}
      <Alert
        severity="info"
        icon={<EmojiObjectsOutlined sx={{ fontSize: 28 }} />}
        sx={{
          background: `linear-gradient(135deg, ${alpha(tokens.colors.indigo[500], 0.08)} 0%, ${alpha(tokens.colors.violet[400], 0.08)} 100%)`,
          border: `1px solid ${alpha(tokens.colors.indigo[500], 0.2)}`,
          '& .MuiAlert-message': { fontWeight: 600, fontSize: '0.9375rem' },
        }}
      >
        Golden Rule: One real-world unit of work = one clean record in the app.
      </Alert>

      {/* ---- 1. Core Principles ---- */}
      <Box id={SECTION_IDS.corePrinciples} sx={{ scrollMarginTop: SCROLL_OFFSET }}>
        <Section title={<SectionTitle icon={<LightbulbOutlined sx={{ color: tokens.colors.indigo[500] }} />} label="Core Principles" />}>
          <Grid container spacing={2}>
            {corePrinciples.map((item) => (
              <Grid key={item.title} size={{ xs: 12, sm: 6 }}>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: alpha(tokens.colors.indigo[500], 0.04),
                    border: `1px solid ${tokens.colors.slate[200]}`,
                    height: '100%',
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(tokens.colors.indigo[500], 0.1),
                      color: tokens.colors.indigo[600],
                      flexShrink: 0,
                    }}
                  >
                    <item.Icon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.description}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Section>
      </Box>

      {/* ---- 2. Role Ownership ---- */}
      <Box id={SECTION_IDS.roleOwnership} sx={{ scrollMarginTop: SCROLL_OFFSET }}>
        <Section title={<SectionTitle icon={<GroupsOutlined sx={{ color: tokens.colors.indigo[500] }} />} label="Role Ownership" />}>
          <Stack spacing={2}>
            {roleGuidelines.map((group) => (
              <Box
                key={group.role}
                sx={{
                  borderLeft: `4px solid ${group.color}`,
                  backgroundColor: alpha(group.color, 0.04),
                  borderRadius: 2,
                  p: 2.5,
                }}
              >
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                  <group.Icon sx={{ color: group.color, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                    {group.role}
                  </Typography>
                </Stack>
                <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                  {group.keyTakeaway}
                </Typography>
                <Stack spacing={0.5}>
                  {group.tasks.map((task) => (
                    <Typography key={task} variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                      {'\u2022'} {task}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Section>
      </Box>

      {/* ---- 3. Project Setup & Status ---- */}
      <Box id={SECTION_IDS.projectSetup} sx={{ scrollMarginTop: SCROLL_OFFSET }}>
        <Section title={<SectionTitle icon={<SettingsOutlined sx={{ color: tokens.colors.indigo[500] }} />} label="Project Setup & Status" />}>
          <Stack spacing={2}>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              Create the project first, then keep status and lifecycle stage current.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {staffingStatuses.map((status) => (
                <Chip
                  key={status.label}
                  label={status.label}
                  size="small"
                  color={status.chipColor}
                  variant="filled"
                />
              ))}
            </Box>
            <Alert severity="warning" variant="outlined" sx={{ '& .MuiAlert-message': { fontSize: '0.875rem' } }}>
              If your team says &quot;Paused&quot;, select <strong>Suspended</strong> in the app.
            </Alert>
          </Stack>
        </Section>
      </Box>

      {/* ---- 4. Lifecycle Stages ---- */}
      <Box id={SECTION_IDS.lifecycle} sx={{ scrollMarginTop: SCROLL_OFFSET }}>
        <Section title={<SectionTitle icon={<TimelineOutlined sx={{ color: tokens.colors.indigo[500] }} />} label="Lifecycle Stages" />}>
          <Stack spacing={0}>
            {lifecycleStages.map((item, index) => (
              <Box
                key={item.appValue}
                sx={{
                  display: 'flex',
                  gap: 2,
                  position: 'relative',
                  pb: index < lifecycleStages.length - 1 ? 2.5 : 0,
                }}
              >
                {/* Timeline dot + connector */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      border: `3px solid ${alpha(item.color, 0.25)}`,
                      zIndex: 1,
                      flexShrink: 0,
                    }}
                  />
                  {index < lifecycleStages.length - 1 && (
                    <Box
                      sx={{
                        width: 2,
                        flex: 1,
                        backgroundColor: tokens.colors.slate[200],
                        mt: 0.5,
                      }}
                    />
                  )}
                </Box>
                {/* Content */}
                <Box sx={{ flex: 1, pb: 0.5 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                      {index + 1}. {item.stage}
                    </Typography>
                    <Chip
                      label={item.appValue}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        backgroundColor: alpha(item.color, 0.12),
                        color: item.color,
                        fontWeight: 600,
                      }}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {item.purpose}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Section>
      </Box>

      {/* ---- 5. Billing Best Practice ---- */}
      <Box id={SECTION_IDS.billing} sx={{ scrollMarginTop: SCROLL_OFFSET }}>
        <Section title={<SectionTitle icon={<ReceiptLongOutlined sx={{ color: tokens.colors.indigo[500] }} />} label="Billing Best Practice" />}>
          <Grid container spacing={2}>
            {billingPractices.map((practice, index) => (
              <Grid key={practice.title} size={{ xs: 12, sm: 6 }}>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: alpha(tokens.colors.success, 0.04),
                    border: `1px solid ${alpha(tokens.colors.success, 0.15)}`,
                    height: '100%',
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(tokens.colors.success, 0.1),
                      color: tokens.colors.success,
                      fontWeight: 800,
                      fontSize: '0.875rem',
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                      {practice.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {practice.description}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Section>
      </Box>

      {/* ---- 6. Data Quality Standard ---- */}
      <Box id={SECTION_IDS.dataQuality} sx={{ scrollMarginTop: SCROLL_OFFSET }}>
        <Section title={<SectionTitle icon={<VerifiedOutlined sx={{ color: tokens.colors.indigo[500] }} />} label="Data Quality Standard" />}>
          <Stack spacing={2}>
            <Alert
              severity="warning"
              icon={<PriorityHighRounded />}
              sx={{
                backgroundColor: alpha(tokens.colors.warning, 0.06),
                border: `1px solid ${alpha(tokens.colors.warning, 0.25)}`,
                '& .MuiAlert-message': { fontWeight: 600 },
              }}
            >
              Always ensure these two dates are present and accurate. They are the minimum foundation for reliable milestone tracking.
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box
                sx={{
                  flex: 1,
                  p: 2.5,
                  borderRadius: 2,
                  border: `2px solid ${alpha(tokens.colors.error, 0.3)}`,
                  backgroundColor: alpha(tokens.colors.error, 0.04),
                  textAlign: 'center',
                }}
              >
                <CalendarMonth sx={{ color: tokens.colors.error, fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                  Signed Date
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Engagement-level
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  p: 2.5,
                  borderRadius: 2,
                  border: `2px solid ${alpha(tokens.colors.error, 0.3)}`,
                  backgroundColor: alpha(tokens.colors.error, 0.04),
                  textAlign: 'center',
                }}
              >
                <EventBusy sx={{ color: tokens.colors.error, fontSize: 32, mb: 1 }} />
                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                  Long Stop Date (LSD)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Engagement fee arrangement
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Section>
      </Box>
    </Page>
  );
}
