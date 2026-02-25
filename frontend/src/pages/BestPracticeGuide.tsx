import { useState } from 'react';
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
  FolderOutlined,
  BadgeOutlined,
  AccountBalanceWalletOutlined,
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
  howToProjects: 'how-to-projects',
  howToStaffing: 'how-to-staffing',
  howToBilling: 'how-to-billing',
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
  { label: 'Projects Guide', sectionId: SECTION_IDS.howToProjects, icon: <FolderOutlined fontSize="small" /> },
  { label: 'Staffing Guide', sectionId: SECTION_IDS.howToStaffing, icon: <BadgeOutlined fontSize="small" /> },
  { label: 'Billing Guide', sectionId: SECTION_IDS.howToBilling, icon: <AccountBalanceWalletOutlined fontSize="small" /> },
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
// Annotated screenshot helpers
// ---------------------------------------------------------------------------
const Callout = ({ n }: { n: number }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      borderRadius: '50%',
      bgcolor: tokens.colors.indigo[500],
      color: 'white',
      fontSize: '0.65rem',
      fontWeight: 800,
      flexShrink: 0,
    }}
  >
    {n}
  </Box>
);

const StepItem = ({ n, text }: { n: number; text: React.ReactNode }) => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start">
    <Callout n={n} />
    <Typography variant="body2" color="text.secondary" sx={{ pt: 0.15 }}>
      {text}
    </Typography>
  </Stack>
);

const ScreenFrame = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box sx={{ border: `1px solid ${tokens.colors.slate[300]}`, borderRadius: 2, overflow: 'hidden' }}>
    <Box sx={{ bgcolor: tokens.colors.slate[800], px: 2, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <Box key={c} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: c }} />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: tokens.colors.slate[400], fontSize: '0.65rem', ml: 0.5 }}>
        {title}
      </Typography>
    </Box>
    <Box sx={{ bgcolor: tokens.colors.slate[50], p: 2 }}>{children}</Box>
  </Box>
);

const MockField = ({ label }: { label: string }) => (
  <Box
    sx={{
      height: 30,
      flex: 1,
      bgcolor: 'white',
      border: `1px solid ${tokens.colors.slate[300]}`,
      borderRadius: 1,
      display: 'flex',
      alignItems: 'center',
      px: 1.5,
      minWidth: 0,
    }}
  >
    <Typography variant="caption" color="text.disabled" fontSize="0.65rem" noWrap>
      {label}
    </Typography>
  </Box>
);

const MockBtn = ({ label, primary }: { label: string; primary?: boolean }) => (
  <Box
    sx={{
      height: 30,
      px: 1.5,
      bgcolor: primary ? tokens.colors.indigo[500] : 'white',
      color: primary ? 'white' : tokens.colors.slate[700],
      border: primary ? 'none' : `1px solid ${tokens.colors.slate[300]}`,
      borderRadius: 1,
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
    }}
  >
    <Typography variant="caption" fontWeight={600} fontSize="0.65rem" noWrap>
      {label}
    </Typography>
  </Box>
);

const MockSelect = ({ label }: { label: string }) => (
  <Box
    sx={{
      height: 28,
      px: 1,
      bgcolor: 'white',
      border: `1px solid ${tokens.colors.slate[300]}`,
      borderRadius: 1,
      display: 'flex',
      alignItems: 'center',
      minWidth: 0,
    }}
  >
    <Typography variant="caption" fontSize="0.6rem" noWrap>
      {label} ▾
    </Typography>
  </Box>
);

const GuideCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${tokens.colors.slate[200]}`, bgcolor: 'white' }}>
    <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mb: 2 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function BestPracticeGuide() {
  type SectionKey = 'best-practices' | 'how-to-projects' | 'how-to-staffing' | 'how-to-billing';
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

  const LANDING_SECTIONS: {
    key: SectionKey;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
    chips: { label: string; sectionId: string }[];
  }[] = [
    {
      key: 'best-practices',
      title: 'Best Practices',
      subtitle: 'Core principles, roles, lifecycle stages, and data quality standards.',
      icon: <LightbulbOutlined sx={{ fontSize: 28 }} />,
      color: tokens.colors.indigo[500],
      chips: NAV_ITEMS.filter((n) => !n.sectionId.startsWith('how-to')),
    },
    {
      key: 'how-to-projects',
      title: 'How To — Projects',
      subtitle: 'Create projects, filter the list, manage details and team members.',
      icon: <FolderOutlined sx={{ fontSize: 28 }} />,
      color: tokens.colors.indigo[600],
      chips: [],
    },
    {
      key: 'how-to-staffing',
      title: 'How To — Staffing',
      subtitle: 'Add staff, browse the roster, and review workload timelines.',
      icon: <BadgeOutlined sx={{ fontSize: 28 }} />,
      color: tokens.colors.violet[500],
      chips: [],
    },
    {
      key: 'how-to-billing',
      title: 'How To — Billing',
      subtitle: 'Browse billing matters, review engagements, and track financials.',
      icon: <AccountBalanceWalletOutlined sx={{ fontSize: 28 }} />,
      color: tokens.colors.success,
      chips: [],
    },
  ];

  const handleCardClick = (key: SectionKey) => {
    setActiveSection((prev) => (prev === key ? null : key));
  };

  return (
    <Page>
      <PageHeader
        title="Guides"
        subtitle="Best practices, step-by-step how-tos, and quick-reference for every function."
      />

      {/* ---- Landing Navigation Cards ---- */}
      <Grid container spacing={2}>
        {LANDING_SECTIONS.map((section) => {
          const isActive = activeSection === section.key;
          return (
            <Grid key={section.key} size={{ xs: 12, sm: 6, md: 3 }}>
              <Box
                onClick={() => handleCardClick(section.key)}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  border: `2px solid ${isActive ? section.color : tokens.colors.slate[200]}`,
                  bgcolor: isActive ? alpha(section.color, 0.04) : 'white',
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  transition: 'all 0.15s ease',
                  ...(isActive
                    ? { boxShadow: `0 2px 12px ${alpha(section.color, 0.18)}` }
                    : {
                        '&:hover': {
                          borderColor: section.color,
                          boxShadow: `0 2px 12px ${alpha(section.color, 0.15)}`,
                          transform: 'translateY(-2px)',
                        },
                      }),
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(section.color, isActive ? 0.15 : 0.1),
                    color: section.color,
                  }}
                >
                  {section.icon}
                </Box>
                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                  {section.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                  {section.subtitle}
                </Typography>
                {section.chips.length > 0 && isActive && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 'auto', pt: 0.5 }}>
                    {section.chips.map((item) => (
                      <Chip
                        key={item.sectionId}
                        label={item.label}
                        size="small"
                        onClick={(e) => { e.stopPropagation(); scrollToSection(item.sectionId); }}
                        sx={{ height: 22, fontSize: '0.65rem', cursor: 'pointer' }}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>

      {/* ================ Best Practices content ================ */}
      {activeSection === 'best-practices' && (<>
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
      </>)}

      {/* ================ How To — Projects content ================ */}
      {activeSection === 'how-to-projects' && (
      <Box id={SECTION_IDS.howToProjects} sx={{ scrollMarginTop: SCROLL_OFFSET }}>
        <Section title={<SectionTitle icon={<FolderOutlined sx={{ color: tokens.colors.indigo[500] }} />} label="How To — Projects" />}>
          <Stack spacing={3}>
            {/* Guide 1: Browse & Filter */}
            <GuideCard title="Browse & Filter Projects">
              <Stack spacing={2}>
                <ScreenFrame title="CM Staffing — Projects">
                  {/* Toolbar */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Callout n={1} />
                    <MockField label="Search projects..." />
                    <Callout n={2} />
                    <MockBtn label="+ New Project" primary />
                  </Stack>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 0.75 }}>
                    <Callout n={3} />
                    <MockSelect label="Status" />
                    <MockSelect label="Category" />
                    <MockSelect label="Side" />
                    <MockSelect label="Sector" />
                    <Callout n={4} />
                    <MockSelect label="Team Member" />
                  </Stack>
                  {/* Table */}
                  <Box sx={{ bgcolor: 'white', border: `1px solid ${tokens.colors.slate[200]}`, borderRadius: 1, overflow: 'hidden' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 1fr 0.5fr', bgcolor: tokens.colors.slate[100], px: 1.5, py: 0.5, borderBottom: `1px solid ${tokens.colors.slate[200]}` }}>
                      {['Project Name', 'C/M Number', 'Status', 'Lifecycle', ''].map((h) => (
                        <Typography key={h} variant="caption" fontWeight={700} fontSize="0.55rem" color="text.secondary">
                          {h}
                        </Typography>
                      ))}
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 1fr 0.5fr', px: 1.5, py: 0.75, alignItems: 'center', borderBottom: `1px solid ${tokens.colors.slate[100]}` }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Callout n={5} />
                        <Typography variant="caption" fontWeight={600} sx={{ color: tokens.colors.indigo[500], fontSize: '0.6rem' }}>
                          Alpha Holdings IPO
                        </Typography>
                      </Stack>
                      <Typography variant="caption" fontSize="0.6rem" color="text.secondary">12345-00001</Typography>
                      <Chip label="Active" size="small" color="success" sx={{ height: 18, fontSize: '0.5rem' }} />
                      <Typography variant="caption" fontSize="0.6rem" color="text.secondary">Signed</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Callout n={6} />
                        <Typography variant="caption" fontSize="0.6rem" color="text.secondary">Edit</Typography>
                      </Stack>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 1fr 0.5fr', px: 1.5, py: 0.75, alignItems: 'center' }}>
                      <Typography variant="caption" fontWeight={600} sx={{ color: tokens.colors.indigo[500], fontSize: '0.6rem' }}>
                        Beta Corp Listing
                      </Typography>
                      <Typography variant="caption" fontSize="0.6rem" color="text.secondary">12345-00002</Typography>
                      <Chip label="Slow-down" size="small" color="warning" sx={{ height: 18, fontSize: '0.5rem' }} />
                      <Typography variant="caption" fontSize="0.6rem" color="text.secondary">A1 Filed</Typography>
                      <Typography variant="caption" fontSize="0.6rem" color="text.secondary">Edit</Typography>
                    </Box>
                  </Box>
                </ScreenFrame>
                <Stack spacing={1}>
                  <StepItem n={1} text={<>Type a keyword in <strong>Search</strong> to find projects by name or C/M number.</>} />
                  <StepItem n={2} text={<>Click <strong>+ New Project</strong> to create a new project (opens the project form).</>} />
                  <StepItem n={3} text={<>Use the <strong>Status</strong>, <strong>Category</strong>, <strong>Side</strong>, and <strong>Sector</strong> dropdowns to narrow the list.</>} />
                  <StepItem n={4} text={<>Filter by <strong>Team Member</strong> to see only projects assigned to a specific person.</>} />
                  <StepItem n={5} text={<>Click any <strong>project name</strong> (blue link) to open its detail page.</>} />
                  <StepItem n={6} text={<>Click the <strong>edit icon</strong> in the Actions column to jump straight to the edit form.</>} />
                </Stack>
              </Stack>
            </GuideCard>

            {/* Guide 2: Create a Project */}
            <GuideCard title="Create a New Project">
              <Stack spacing={2}>
                <ScreenFrame title="CM Staffing — New Project">
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Callout n={1} />
                      <MockField label="Project Name *" />
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Callout n={2} />
                      <MockSelect label="Category" />
                      <MockSelect label="Status" />
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Callout n={3} />
                      <MockSelect label="Lifecycle Stage" />
                      <MockSelect label="Priority" />
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Callout n={4} />
                      <MockField label="Filing Date" />
                      <MockField label="Listing Date" />
                      <MockSelect label="Side" />
                      <MockSelect label="Sector" />
                    </Stack>
                    <Box sx={{ borderTop: `1px solid ${tokens.colors.slate[200]}`, pt: 1, mt: 0.5 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Callout n={5} />
                        <MockField label="Select Staff Member" />
                        <MockBtn label="Add Member" />
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pt: 0.5 }}>
                      <Callout n={6} />
                      <MockBtn label="Create Project" primary />
                      <MockBtn label="Cancel" />
                    </Stack>
                  </Stack>
                </ScreenFrame>
                <Stack spacing={1}>
                  <StepItem n={1} text={<>Enter the <strong>Project Name</strong> — this is the only required field.</>} />
                  <StepItem n={2} text={<>Select a <strong>Category</strong> (HK Trx, US Trx, HK Comp, US Comp, Others) and set <strong>Status</strong> (defaults to Active).</>} />
                  <StepItem n={3} text={<>Set the <strong>Lifecycle Stage</strong> (e.g. New Engagement, Kickoff, Listed) and <strong>Priority</strong> (High, Medium, Low) if known.</>} />
                  <StepItem n={4} text={<>Fill in <strong>Filing Date</strong>, <strong>Listing Date</strong>, <strong>Side</strong>, and <strong>Sector</strong> as available.</>} />
                  <StepItem n={5} text={<>Under Team Members, search for staff and click <strong>Add Member</strong> to assign them before saving.</>} />
                  <StepItem n={6} text={<>Click <strong>Create Project</strong> to save. You&apos;ll be redirected to the project list.</>} />
                </Stack>
              </Stack>
            </GuideCard>

            {/* Guide 3: Manage Project Detail */}
            <GuideCard title="Manage Project Details">
              <Stack spacing={2}>
                <ScreenFrame title="CM Staffing — Project Detail">
                  <Stack spacing={1}>
                    {/* Header bar */}
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      sx={{ bgcolor: tokens.colors.indigo[500], borderRadius: 1, px: 1.5, py: 1, flexWrap: 'wrap', rowGap: 0.5 }}
                    >
                      <Typography variant="caption" fontWeight={700} fontSize="0.65rem" sx={{ color: 'white' }}>
                        Alpha Holdings IPO
                      </Typography>
                      <Chip label="Active" size="small" sx={{ height: 18, fontSize: '0.5rem', bgcolor: 'white', color: tokens.colors.success }} />
                      <Callout n={1} />
                      <Chip label="C/M: 12345-00001" size="small" sx={{ height: 18, fontSize: '0.5rem', bgcolor: alpha('#fff', 0.9) }} />
                      <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Callout n={2} />
                        <MockBtn label="Confirm Details" />
                        <Callout n={3} />
                        <MockBtn label="Edit Project" />
                      </Box>
                    </Stack>
                    {/* Info grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
                      {['Status', 'Lifecycle', 'Category', 'C/M Number', 'Side', 'Priority'].map((label) => (
                        <Box key={label} sx={{ bgcolor: tokens.colors.slate[50], borderRadius: 1, p: 0.75, border: `1px solid ${tokens.colors.slate[200]}` }}>
                          <Typography variant="caption" fontSize="0.5rem" color="text.secondary" fontWeight={600}>
                            {label.toUpperCase()}
                          </Typography>
                          <Typography variant="caption" fontSize="0.6rem" fontWeight={600} display="block">
                            Value
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    {/* Team table */}
                    <Box sx={{ bgcolor: 'white', border: `1px solid ${tokens.colors.slate[200]}`, borderRadius: 1, overflow: 'hidden' }}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ px: 1.5, py: 0.5, borderBottom: `1px solid ${tokens.colors.slate[200]}` }}
                      >
                        <Typography variant="caption" fontWeight={700} fontSize="0.6rem">Team Members</Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Callout n={4} />
                          <MockBtn label="+ Add" />
                        </Stack>
                      </Stack>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 0.8fr 0.5fr', px: 1.5, py: 0.5, alignItems: 'center' }}>
                        <Typography variant="caption" fontSize="0.55rem">Partner</Typography>
                        <Typography variant="caption" fontSize="0.55rem" fontWeight={600} color="primary.main">John Smith</Typography>
                        <Typography variant="caption" fontSize="0.55rem">HK Law</Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Callout n={5} />
                          <Typography variant="caption" fontSize="0.5rem">B&C ◉</Typography>
                        </Stack>
                        <Typography variant="caption" fontSize="0.55rem" color="text.secondary">Edit</Typography>
                      </Box>
                    </Box>
                    {/* Change History hint */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Callout n={6} />
                      <Box sx={{ flex: 1, bgcolor: tokens.colors.slate[50], borderRadius: 1, px: 1.5, py: 0.5, border: `1px solid ${tokens.colors.slate[200]}` }}>
                        <Typography variant="caption" fontWeight={700} fontSize="0.6rem">Change History</Typography>
                        <Typography variant="caption" fontSize="0.55rem" color="text.secondary" display="block">
                          status: Active → Slow-down • 2025-01-15 • jane.doe
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </ScreenFrame>
                <Stack spacing={1}>
                  <StepItem n={1} text={<>The <strong>C/M Number</strong> chip links to billing. Click the pencil icon next to it to edit — the system auto-validates against billing data.</>} />
                  <StepItem n={2} text={<>Click <strong>Confirm Details</strong> to timestamp that project info has been verified. The team can see when it was last confirmed.</>} />
                  <StepItem n={3} text={<>Click <strong>Edit Project</strong> to open the full form for changing status, lifecycle stage, dates, or any other field.</>} />
                  <StepItem n={4} text={<>In Team Members, click <strong>Add</strong> to assign a new staff member. Select from the autocomplete and set their jurisdiction.</>} />
                  <StepItem n={5} text={<>Use the <strong>B&C Attorney</strong> toggle to mark a team member as the responsible billing &amp; collections attorney.</>} />
                  <StepItem n={6} text={<>Scroll down to <strong>Change History</strong> to see an audit log of who changed what field and when.</>} />
                </Stack>
              </Stack>
            </GuideCard>
          </Stack>
        </Section>
      </Box>
      )}

      {/* ================ How To — Staffing content ================ */}
      {activeSection === 'how-to-staffing' && (
      <Box id={SECTION_IDS.howToStaffing} sx={{ scrollMarginTop: SCROLL_OFFSET }}>
        <Section title={<SectionTitle icon={<BadgeOutlined sx={{ color: tokens.colors.indigo[500] }} />} label="How To — Staffing" />}>
          <Stack spacing={3}>
            {/* Guide 1: Browse & Filter Staff */}
            <GuideCard title="Browse & Filter the Staff List">
              <Stack spacing={2}>
                <ScreenFrame title="CM Staffing — Staff">
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Callout n={1} />
                    <MockField label="Search staff..." />
                    <Callout n={2} />
                    <MockBtn label="+ New Staff" primary />
                  </Stack>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
                    <Callout n={3} />
                    <MockSelect label="Position" />
                    <Callout n={4} />
                    <MockSelect label="Department" />
                  </Stack>
                  <Box sx={{ bgcolor: 'white', border: `1px solid ${tokens.colors.slate[200]}`, borderRadius: 1, overflow: 'hidden' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.8fr 1.5fr 0.6fr 0.8fr', bgcolor: tokens.colors.slate[100], px: 1.5, py: 0.5, borderBottom: `1px solid ${tokens.colors.slate[200]}` }}>
                      {['Name', 'Position', 'Dept', 'Email', 'Status', 'Actions'].map((h) => (
                        <Typography key={h} variant="caption" fontWeight={700} fontSize="0.55rem" color="text.secondary">
                          {h}
                        </Typography>
                      ))}
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.8fr 1.5fr 0.6fr 0.8fr', px: 1.5, py: 0.75, alignItems: 'center' }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Callout n={5} />
                        <Typography variant="caption" fontWeight={600} sx={{ color: tokens.colors.indigo[500], fontSize: '0.6rem' }}>
                          Jane Chen
                        </Typography>
                      </Stack>
                      <Typography variant="caption" fontSize="0.6rem">Partner</Typography>
                      <Typography variant="caption" fontSize="0.6rem">HK Law</Typography>
                      <Typography variant="caption" fontSize="0.6rem" color="text.secondary">jane@firm.com</Typography>
                      <Chip label="active" size="small" color="success" sx={{ height: 18, fontSize: '0.5rem' }} />
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Callout n={6} />
                        <Typography variant="caption" fontSize="0.55rem" color="text.secondary">Edit | Del</Typography>
                      </Stack>
                    </Box>
                  </Box>
                </ScreenFrame>
                <Stack spacing={1}>
                  <StepItem n={1} text={<>Type in <strong>Search</strong> to find staff by name.</>} />
                  <StepItem n={2} text={<>Click <strong>+ New Staff</strong> to add a new team member.</>} />
                  <StepItem n={3} text={<>Filter by <strong>Position</strong> (Partner, Associate, Senior FLIC, Junior FLIC, Intern).</>} />
                  <StepItem n={4} text={<>Filter by <strong>Department</strong> (US Law, HK Law).</>} />
                  <StepItem n={5} text={<>Click a <strong>name</strong> (blue link) to view the staff member&apos;s full profile and workload.</>} />
                  <StepItem n={6} text={<>Use the <strong>Edit</strong> icon to update or <strong>Delete</strong> to remove. Prefer changing status to &quot;Leaving&quot; over deleting.</>} />
                </Stack>
              </Stack>
            </GuideCard>

            {/* Guide 2: Add Staff */}
            <GuideCard title="Add a New Staff Member">
              <Stack spacing={2}>
                <ScreenFrame title="CM Staffing — New Staff">
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Callout n={1} />
                      <MockField label="Name *" />
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Callout n={2} />
                      <MockSelect label="Position" />
                      <Callout n={3} />
                      <MockSelect label="Department" />
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Callout n={4} />
                      <MockField label="Email" />
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pt: 0.5 }}>
                      <Callout n={5} />
                      <MockBtn label="Save" primary />
                      <MockBtn label="Cancel" />
                    </Stack>
                  </Stack>
                </ScreenFrame>
                <Stack spacing={1}>
                  <StepItem n={1} text={<>Enter the full <strong>Name</strong> of the staff member (required).</>} />
                  <StepItem n={2} text={<>Select a <strong>Position</strong>: Partner, Associate, Senior FLIC, Junior FLIC, or Intern.</>} />
                  <StepItem n={3} text={<>Select a <strong>Department</strong>: US Law or HK Law.</>} />
                  <StepItem n={4} text={<>Enter the staff member&apos;s <strong>Email</strong> address.</>} />
                  <StepItem n={5} text={<>Click <strong>Save</strong> to create the record. The staff member is now available for project assignments.</>} />
                </Stack>
              </Stack>
            </GuideCard>

            {/* Guide 3: View Workload */}
            <GuideCard title="View Staff Workload & Assignments">
              <Stack spacing={2}>
                <ScreenFrame title="CM Staffing — Staff Detail">
                  <Stack spacing={1}>
                    {/* Header */}
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography variant="caption" fontWeight={700} fontSize="0.7rem">Jane Chen</Typography>
                      <Chip label="active" size="small" color="success" sx={{ height: 18, fontSize: '0.5rem' }} />
                      <Box sx={{ ml: 'auto' }}>
                        <MockBtn label="Edit" />
                      </Box>
                    </Stack>
                    {/* Info */}
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Callout n={1} />
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75, flex: 1 }}>
                        {[
                          { l: 'Position', v: 'Partner' },
                          { l: 'Dept', v: 'HK Law' },
                          { l: 'Email', v: 'jane@firm.com' },
                          { l: 'Active Projects', v: '5' },
                        ].map((item) => (
                          <Box key={item.l} sx={{ bgcolor: tokens.colors.slate[50], borderRadius: 1, p: 0.5, border: `1px solid ${tokens.colors.slate[200]}` }}>
                            <Typography variant="caption" fontSize="0.45rem" color="text.secondary">{item.l}</Typography>
                            <Typography variant="caption" fontSize="0.6rem" fontWeight={600} display="block">{item.v}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Stack>
                    {/* Timeline */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Callout n={2} />
                      <Box sx={{ flex: 1, bgcolor: tokens.colors.slate[50], borderRadius: 1, p: 1, border: `1px solid ${tokens.colors.slate[200]}` }}>
                        <Typography variant="caption" fontWeight={700} fontSize="0.55rem" sx={{ mb: 0.5, display: 'block' }}>
                          Project Load Timeline
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="flex-end" sx={{ height: 40 }}>
                          <Callout n={3} />
                          {[3, 4, 5, 5, 4, 5, 6, 5, 4, 4, 3, 3].map((h, i) => (
                            <Box key={i} sx={{ width: 8, height: h * 6, bgcolor: i === 6 ? tokens.colors.indigo[500] : tokens.colors.slate[300], borderRadius: 0.5 }} />
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                    {/* Assignments table hint */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Callout n={4} />
                      <Box sx={{ flex: 1, bgcolor: 'white', border: `1px solid ${tokens.colors.slate[200]}`, borderRadius: 1, px: 1.5, py: 0.5 }}>
                        <Typography variant="caption" fontWeight={700} fontSize="0.55rem">Project Assignments</Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 0.25 }}>
                          <Typography variant="caption" fontSize="0.5rem" color="primary.main" fontWeight={600}>Alpha Holdings IPO</Typography>
                          <Typography variant="caption" fontSize="0.5rem" color="text.secondary">Active</Typography>
                          <Typography variant="caption" fontSize="0.5rem" color="text.secondary">HK Law</Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Callout n={5} />
                            <Typography variant="caption" fontSize="0.5rem" color="success.main">Confirm</Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    </Stack>
                  </Stack>
                </ScreenFrame>
                <Stack spacing={1}>
                  <StepItem n={1} text={<>The <strong>info card</strong> shows Position, Department, Email, and the count of Active Projects at a glance.</>} />
                  <StepItem n={2} text={<>The <strong>Project Load Timeline</strong> bar chart shows how many projects this person is on per week — 6 weeks back and 6 weeks forward.</>} />
                  <StepItem n={3} text={<>Stat cards show <strong>Now</strong> (current week), <strong>Peak</strong> (highest in 13-week window), <strong>Avg Past</strong>, and <strong>Avg Forward</strong> counts.</>} />
                  <StepItem n={4} text={<>The <strong>Project Assignments</strong> table lists all assigned projects with status, category, jurisdiction, and assignment window.</>} />
                  <StepItem n={5} text={<>Click the <strong>green checkmark</strong> to confirm a project&apos;s details directly from this view — useful during weekly reviews.</>} />
                </Stack>
              </Stack>
            </GuideCard>
          </Stack>
        </Section>
      </Box>
      )}

      {/* ================ How To — Billing content ================ */}
      {activeSection === 'how-to-billing' && (
      <Box id={SECTION_IDS.howToBilling} sx={{ scrollMarginTop: SCROLL_OFFSET }}>
        <Section title={<SectionTitle icon={<AccountBalanceWalletOutlined sx={{ color: tokens.colors.indigo[500] }} />} label="How To — Billing" />}>
          <Stack spacing={3}>
            {/* Guide 1: Browse Billing */}
            <GuideCard title="Browse Billing Matters">
              <Stack spacing={2}>
                <ScreenFrame title="CM Staffing — Billing Matters">
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Callout n={1} />
                    <MockField label="Search by C/M number, project, or client..." />
                    <Callout n={2} />
                    <MockSelect label="B&C Attorney" />
                  </Stack>
                  <Box sx={{ bgcolor: 'white', border: `1px solid ${tokens.colors.slate[200]}`, borderRadius: 1, overflow: 'hidden' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 0.8fr 0.8fr 0.7fr 0.5fr', bgcolor: tokens.colors.slate[100], px: 1.5, py: 0.5, borderBottom: `1px solid ${tokens.colors.slate[200]}` }}>
                      {['C/M', 'Project', 'Attorney', 'Billed', 'Collected', 'UBT', 'Link'].map((h) => (
                        <Typography key={h} variant="caption" fontWeight={700} fontSize="0.5rem" color="text.secondary">
                          {h}
                        </Typography>
                      ))}
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 0.8fr 0.8fr 0.7fr 0.5fr', px: 1.5, py: 0.75, alignItems: 'center', borderBottom: `1px solid ${tokens.colors.slate[100]}` }}>
                      <Typography variant="caption" fontWeight={500} sx={{ color: tokens.colors.indigo[500], fontSize: '0.55rem' }}>
                        12345-00001
                      </Typography>
                      <Typography variant="caption" fontSize="0.55rem">Alpha Holdings</Typography>
                      <Typography variant="caption" fontSize="0.55rem">J. Smith</Typography>
                      <Stack direction="row" spacing={0.25} alignItems="center">
                        <Callout n={3} />
                        <Typography variant="caption" fontSize="0.5rem">$150K</Typography>
                      </Stack>
                      <Typography variant="caption" fontSize="0.5rem">$100K</Typography>
                      <Chip label="$50K" size="small" color="warning" sx={{ height: 16, fontSize: '0.45rem' }} />
                      <Stack direction="row" spacing={0.25} alignItems="center">
                        <Callout n={4} />
                        <Chip label="Linked" size="small" color="success" sx={{ height: 16, fontSize: '0.45rem' }} />
                      </Stack>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 0.8fr 0.8fr 0.7fr 0.5fr', px: 1.5, py: 0.75, alignItems: 'center' }}>
                      <Stack direction="row" spacing={0.25} alignItems="center">
                        <Callout n={5} />
                        <Typography variant="caption" fontWeight={500} sx={{ color: tokens.colors.indigo[500], fontSize: '0.55rem' }}>
                          12345-00002
                        </Typography>
                      </Stack>
                      <Typography variant="caption" fontSize="0.55rem">Beta Corp</Typography>
                      <Typography variant="caption" fontSize="0.55rem">A. Lee</Typography>
                      <Typography variant="caption" fontSize="0.5rem">$80K</Typography>
                      <Typography variant="caption" fontSize="0.5rem">$80K</Typography>
                      <Chip label="—" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.45rem' }} />
                      <Chip label="—" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.45rem' }} />
                    </Box>
                  </Box>
                </ScreenFrame>
                <Stack spacing={1}>
                  <StepItem n={1} text={<>Use the <strong>search bar</strong> to find billing matters by C/M number, project name, or client name.</>} />
                  <StepItem n={2} text={<>Use the <strong>B&C Attorney</strong> dropdown to filter by the responsible attorney.</>} />
                  <StepItem n={3} text={<>Review the financial columns: <strong>Billed</strong>, <strong>Collected</strong>, <strong>UBT</strong> (unbilled time), <strong>Credit</strong>, and <strong>Bonus</strong>.</>} />
                  <StepItem n={4} text={<>The <strong>Link</strong> column shows whether this billing matter is connected to a staffing project (&quot;Linked&quot; = connected).</>} />
                  <StepItem n={5} text={<>Click any <strong>row</strong> to open the billing detail page for that matter.</>} />
                </Stack>
              </Stack>
            </GuideCard>

            {/* Guide 2: Billing Detail */}
            <GuideCard title="Review Billing Detail & Engagements">
              <Stack spacing={2}>
                <ScreenFrame title="CM Staffing — Billing Detail">
                  <Stack spacing={1}>
                    {/* Header */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" fontWeight={700} fontSize="0.7rem">Alpha Holdings IPO</Typography>
                      <MockBtn label="Back to list" />
                    </Stack>
                    {/* C/M Summary card */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Callout n={1} />
                      <Box sx={{ flex: 1, bgcolor: tokens.colors.slate[50], borderRadius: 1, p: 1, border: `1px solid ${tokens.colors.slate[200]}` }}>
                        <Typography variant="caption" fontWeight={700} fontSize="0.55rem">C/M Summary — 12345-00001</Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 0.25 }}>
                          <Typography variant="caption" fontSize="0.5rem"><strong>Client:</strong> Alpha Corp</Typography>
                          <Typography variant="caption" fontSize="0.5rem"><strong>Attorney:</strong> J. Smith</Typography>
                          <Typography variant="caption" fontSize="0.5rem"><strong>Billed:</strong> $150K</Typography>
                        </Stack>
                      </Box>
                    </Stack>
                    {/* Staffing link */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Callout n={2} />
                      <Typography variant="caption" fontSize="0.55rem" color="text.secondary">Staffing Project:</Typography>
                      <Typography variant="caption" fontSize="0.55rem" fontWeight={600} sx={{ color: tokens.colors.indigo[500] }}>Alpha Holdings IPO</Typography>
                      <Chip label="Active" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.45rem' }} />
                    </Stack>
                    {/* Engagement cards */}
                    <Stack direction="row" spacing={0.5} alignItems="flex-start">
                      <Callout n={3} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" fontWeight={700} fontSize="0.6rem" sx={{ mb: 0.5, display: 'block' }}>
                          Engagements (2)
                        </Typography>
                        <Stack spacing={0.75}>
                          <Box sx={{ bgcolor: 'white', border: `1px solid ${tokens.colors.slate[200]}`, borderRadius: 1, p: 1 }}>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="caption" fontWeight={600} fontSize="0.55rem">Engagement #1 — IPO Advisory</Typography>
                              <Typography variant="caption" fontSize="0.5rem" color="text.secondary">▾ expand</Typography>
                            </Stack>
                            <Typography variant="caption" fontSize="0.5rem" color="text.secondary">
                              Signed: 2024-06-01 • LSD: 2025-06-01 • Milestones: 3
                            </Typography>
                          </Box>
                          <Box sx={{ bgcolor: 'white', border: `1px solid ${tokens.colors.slate[200]}`, borderRadius: 1, p: 1 }}>
                            <Typography variant="caption" fontWeight={600} fontSize="0.55rem">Engagement #2 — Follow-on</Typography>
                            <Typography variant="caption" fontSize="0.5rem" color="text.secondary">
                              Signed: 2025-01-15 • LSD: 2026-01-15 • Milestones: 2
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    </Stack>
                    {/* Add engagement */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Callout n={4} />
                      <MockBtn label="+ Add Engagement" />
                      <Typography variant="caption" fontSize="0.45rem" color="text.secondary">(Admin only)</Typography>
                    </Stack>
                    {/* Change log */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Callout n={5} />
                      <Box sx={{ flex: 1, bgcolor: tokens.colors.slate[50], borderRadius: 1, px: 1, py: 0.5, border: `1px solid ${tokens.colors.slate[200]}` }}>
                        <Typography variant="caption" fontWeight={700} fontSize="0.55rem">Change Log</Typography>
                        <Typography variant="caption" fontSize="0.5rem" color="text.secondary" display="block">
                          milestone_status: Pending → Complete • 2025-02-10 • john.doe
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </ScreenFrame>
                <Stack spacing={1}>
                  <StepItem n={1} text={<>The <strong>C/M Summary card</strong> at top shows the project name, client, attorney in charge, and aggregated financials. Admins can click Edit to update project-level billing info.</>} />
                  <StepItem n={2} text={<>If linked to a staffing project, click the <strong>Staffing Project link</strong> to jump to the staffing detail page.</>} />
                  <StepItem n={3} text={<>Each <strong>Engagement Card</strong> represents a separate scope of work. Click the card header to expand and view milestones, fees, signed date, and LSD.</>} />
                  <StepItem n={4} text={<>Admins can click <strong>+ Add Engagement</strong> to create a new engagement for additional scope under the same C/M number. Remember: new scope = new engagement, not a new project.</>} />
                  <StepItem n={5} text={<>The <strong>Change Log</strong> at the bottom shows all billing data changes with timestamps and who made them.</>} />
                </Stack>
              </Stack>
            </GuideCard>
          </Stack>
        </Section>
      </Box>
      )}
    </Page>
  );
}
