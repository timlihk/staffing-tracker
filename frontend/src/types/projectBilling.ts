/**
 * Shared types for project billing milestones.
 * Used by ProjectDetail page and ProjectMilestonesSection component.
 */

export interface ProjectBillingMilestoneRow {
  billingProjectId: number;
  billingProjectName: string | null;
  cmNumber: string | null;
  engagementId: number;
  engagementTitle: string | null;
  milestoneId: number;
  ordinal: string | null;
  title: string | null;
  triggerText: string | null;
  dueDate: string | null;
  amountValue: number | null;
  amountCurrency: string | null;
  completed: boolean;
  completionDate: string | null;
  invoiceSentDate: string | null;
  paymentReceivedDate: string | null;
  notes: string | null;
  feeArrangementText: string | null;
  milestoneStatus: 'pending' | 'overdue' | 'completed' | 'invoiced' | 'collected';
  triggerStats: {
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
  };
  triggerRule: {
    id: number;
    triggerMode: string;
    anchorEventType: string | null;
    autoConfirm: boolean;
    manualConfirmRequired: boolean;
    dueInBusinessDays: number | null;
    recurrence: string | null;
    confidence: number | null;
    updatedAt: string;
  } | null;
  latestTrigger: {
    id: number;
    status: 'pending' | 'confirmed' | 'rejected';
    oldStatus: string;
    newStatus: string;
    matchConfidence: number;
    matchMethod: string | null;
    triggerReason: string | null;
    createdAt: string;
    confirmedAt: string | null;
    actionTaken: string | null;
    actionItem: {
      id: number;
      actionType: string;
      description: string;
      dueDate: string | null;
      status: 'pending' | 'completed' | 'cancelled';
      completedAt: string | null;
      assignedTo: {
        id: number;
        name: string;
        position: string | null;
      } | null;
    } | null;
  } | null;
}

export interface ProjectBillingMilestoneResponse {
  projectId: number;
  linked: boolean;
  cmNumbers: string[];
  milestones: ProjectBillingMilestoneRow[];
}

export interface MilestoneCreateFormState {
  engagementId: string;
  title: string;
  triggerText: string;
  dueDate: string;
  amountValue: string;
  amountCurrency: string;
  notes: string;
}

export const createMilestoneFormState = (
  overrides?: Partial<MilestoneCreateFormState>
): MilestoneCreateFormState => ({
  engagementId: '',
  title: '',
  triggerText: '',
  dueDate: '',
  amountValue: '',
  amountCurrency: 'USD',
  notes: '',
  ...overrides,
});

export type LifecycleStep = 'completed' | 'invoiceSentDate' | 'paymentReceivedDate';
