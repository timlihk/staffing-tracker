import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

const BEST_PRACTICE_GUIDE = {
  version: '2026-02-23',
  firstPrinciple:
    'One real-world unit of work should map to one clean record structure in the app.',
  roles: [
    {
      key: 'deal_team',
      title: 'Deal Team Members',
      responsibilities: [
        'Create project records.',
        'Maintain project status for staffing visibility.',
        'Maintain lifecycle stage for billing milestone tracking.',
        'Create a new engagement (not a new project) for new scope under the same C/M number.',
        'Maintain engagement-level milestone reference language from engagement letters.',
      ],
    },
    {
      key: 'finance_team',
      title: 'Finance Team',
      responsibilities: [
        'Co-confirm billing details with Deal Team.',
        'Validate engagement-level signed date and Long Stop Date (LSD).',
        'Review milestone structure and dates for billing accuracy.',
        'Ensure milestones are not mixed across engagement cards.',
      ],
    },
    {
      key: 'managers',
      title: 'Managers',
      responsibilities: [
        'Review role accountability and data quality.',
        'Escalate missing critical dates (signed date and LSD).',
        'Enforce timely status and lifecycle updates.',
      ],
    },
  ],
  project: {
    statuses: [
      {
        value: 'Active',
        purpose: 'Project is actively progressing and should be included in staffing planning.',
      },
      {
        value: 'Slow-down',
        purpose: 'Project is progressing slowly; staffing inputs should be adjusted.',
      },
      {
        value: 'Suspended',
        aliases: ['Paused'],
        purpose: 'Project is paused/held and should not be treated as active execution.',
      },
      {
        value: 'Terminated',
        purpose: 'Project has ended without normal completion.',
      },
      {
        value: 'Closed',
        purpose: 'Project has completed and is closed out.',
      },
    ],
    lifecycleStages: [
      {
        appValue: 'signed',
        displayName: 'Signed',
        businessLabel: 'New engagement',
        purpose: 'Marks engagement start and billing milestone tracking kickoff.',
      },
      {
        appValue: 'kickoff',
        displayName: 'Kickoff',
        purpose: 'Confirms execution has started.',
      },
      {
        appValue: 'confidential_filed',
        displayName: 'Confidential Filed',
        purpose: 'Captures confidential filing milestone.',
      },
      {
        appValue: 'a1_filed',
        displayName: 'A1 Filed',
        purpose: 'Captures A1 submission milestone.',
      },
      {
        appValue: 'hearing_passed',
        displayName: 'Hearing Passed',
        purpose: 'Captures hearing approval milestone.',
      },
      {
        appValue: 'listed',
        displayName: 'Listed',
        purpose: 'Captures listing completion milestone.',
      },
      {
        appValue: 'renewal_cycle',
        displayName: 'Renewal Cycle',
        purpose: 'Captures renewal-cycle milestones for post-listing work.',
      },
    ],
  },
  billing: {
    rules: [
      'Under one C/M number, if new scope starts, create a new engagement instead of a new project.',
      'In billing detail, use engagement-level milestone reference text from the engagement letter.',
      'Add and edit milestones within the correct engagement card only.',
      'Do not mix milestones from two different engagements in one engagement card.',
    ],
    criticalFields: [
      {
        field: 'signed_date',
        label: 'Signed Date',
        reason: 'Required baseline date for milestone tracking.',
      },
      {
        field: 'lsd_date',
        label: 'Long Stop Date (LSD)',
        reason: 'Required anchor date for billing milestone governance.',
      },
    ],
  },
} as const;

/**
 * Get best-practice guide content for role-based data entry and editing.
 */
export const getBestPracticeGuide = (req: AuthRequest, res: Response) => {
  res.json(BEST_PRACTICE_GUIDE);
};

