import { z } from 'zod';

export const ReportQuerySchema = z.object({
  categories: z.string().optional(),    // comma-separated: "HK Trx,US Trx"
  staffRoles: z.string().optional(),    // comma-separated: "Associate,Partner"
  priorities: z.string().optional(),    // comma-separated: "High,Medium,Low"
  statuses: z.string().optional(),      // comma-separated: "Active,Slow-down,Suspended,Closed,Terminated"
  jurisdictions: z.string().optional(), // comma-separated: "US Law,HK Law,B&C"
  dateFrom: z.string().optional(),      // ISO date string
  dateTo: z.string().optional(),        // ISO date string
});

export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export type ReportRow = {
  projectId: number;
  name: string;
  projectName: string;
  category: string;
  priority: string | null;
  status: string;
  elStatus: string | null;
  timetable: string | null;
  filingDate: string | null;
  listingDate: string | null;
  staffName: string;
  staffRole: string;
  staffDepartment: string | null;
  jurisdiction: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type ReportResponse = {
  data: ReportRow[];
  meta: {
    filters: Record<string, unknown>;
    totals: {
      rows: number;
      projects: number;
      staff: number;
    };
  };
};
