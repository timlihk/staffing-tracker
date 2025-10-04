import {
  identifyMissingFields,
  formatFieldName,
  deduplicateProjectsByPartner,
  type ProjectData,
  type AssignmentData,
  type MissingField,
} from '../../services/project-reminder.service';

describe('identifyMissingFields', () => {
  it('should identify all 4 missing fields when project is completely empty', () => {
    const project: ProjectData = {
      id: 1,
      name: 'Test Project',
      category: 'HK Trx',
      filingDate: null,
      listingDate: null,
      elStatus: null,
      bcAttorney: null,
    };

    const result = identifyMissingFields(project);

    expect(result).toEqual(['filingDate', 'listingDate', 'elStatus', 'bcAttorney']);
    expect(result.length).toBe(4);
  });

  it('should identify partial missing fields', () => {
    const project: ProjectData = {
      id: 1,
      name: 'Test Project',
      category: 'HK Trx',
      filingDate: new Date('2025-01-01'),
      listingDate: null,
      elStatus: 'Pending',
      bcAttorney: null,
    };

    const result = identifyMissingFields(project);

    expect(result).toEqual(['listingDate', 'bcAttorney']);
    expect(result.length).toBe(2);
  });

  it('should return empty array when all fields are complete', () => {
    const project: ProjectData = {
      id: 1,
      name: 'Test Project',
      category: 'HK Trx',
      filingDate: new Date('2025-01-01'),
      listingDate: new Date('2025-06-01'),
      elStatus: 'Filed',
      bcAttorney: 'John Doe',
    };

    const result = identifyMissingFields(project);

    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });

  it('should identify only one missing field', () => {
    const project: ProjectData = {
      id: 1,
      name: 'Test Project',
      category: 'HK Trx',
      filingDate: null,
      listingDate: new Date('2025-06-01'),
      elStatus: 'Filed',
      bcAttorney: 'Jane Smith',
    };

    const result = identifyMissingFields(project);

    expect(result).toEqual(['filingDate']);
    expect(result.length).toBe(1);
  });
});

describe('formatFieldName', () => {
  it('should format filingDate correctly', () => {
    expect(formatFieldName('filingDate')).toBe('Filing Date');
  });

  it('should format listingDate correctly', () => {
    expect(formatFieldName('listingDate')).toBe('Listing Date');
  });

  it('should format elStatus correctly', () => {
    expect(formatFieldName('elStatus')).toBe('EL Status');
  });

  it('should format bcAttorney correctly', () => {
    expect(formatFieldName('bcAttorney')).toBe('B&C Attorney');
  });
});

describe('deduplicateProjectsByPartner', () => {
  it('should remove duplicate partner-project pairs', () => {
    const assignments: AssignmentData[] = [
      {
        staff: { id: 1, name: 'John Smith', email: 'john@example.com' },
        project: {
          id: 10,
          name: 'Project A',
          category: 'HK Trx',
          filingDate: null,
          listingDate: null,
          elStatus: null,
          bcAttorney: null,
        },
      },
      {
        staff: { id: 1, name: 'John Smith', email: 'john@example.com' },
        project: {
          id: 10,
          name: 'Project A',
          category: 'HK Trx',
          filingDate: null,
          listingDate: null,
          elStatus: null,
          bcAttorney: null,
        },
      },
    ];

    const result = deduplicateProjectsByPartner(assignments);

    expect(result.size).toBe(1);
    expect(result.get(1)?.projects.length).toBe(1);
  });

  it('should group multiple projects by partner correctly', () => {
    const assignments: AssignmentData[] = [
      {
        staff: { id: 1, name: 'John Smith', email: 'john@example.com' },
        project: {
          id: 10,
          name: 'Project A',
          category: 'HK Trx',
          filingDate: null,
          listingDate: null,
          elStatus: null,
          bcAttorney: null,
        },
      },
      {
        staff: { id: 1, name: 'John Smith', email: 'john@example.com' },
        project: {
          id: 20,
          name: 'Project B',
          category: 'US Comp',
          filingDate: null,
          listingDate: null,
          elStatus: null,
          bcAttorney: null,
        },
      },
      {
        staff: { id: 2, name: 'Jane Doe', email: 'jane@example.com' },
        project: {
          id: 30,
          name: 'Project C',
          category: 'HK Comp',
          filingDate: null,
          listingDate: null,
          elStatus: null,
          bcAttorney: null,
        },
      },
    ];

    const result = deduplicateProjectsByPartner(assignments);

    expect(result.size).toBe(2); // 2 unique partners
    expect(result.get(1)?.projects.length).toBe(2); // Partner 1 has 2 projects
    expect(result.get(2)?.projects.length).toBe(1); // Partner 2 has 1 project
    expect(result.get(1)?.name).toBe('John Smith');
    expect(result.get(2)?.name).toBe('Jane Doe');
  });

  it('should preserve partner email and name', () => {
    const assignments: AssignmentData[] = [
      {
        staff: { id: 1, name: 'John Smith', email: 'john@example.com' },
        project: {
          id: 10,
          name: 'Project A',
          category: 'HK Trx',
          filingDate: null,
          listingDate: null,
          elStatus: null,
          bcAttorney: null,
        },
      },
    ];

    const result = deduplicateProjectsByPartner(assignments);

    expect(result.get(1)?.email).toBe('john@example.com');
    expect(result.get(1)?.name).toBe('John Smith');
  });

  it('should handle empty assignments array', () => {
    const assignments: AssignmentData[] = [];
    const result = deduplicateProjectsByPartner(assignments);

    expect(result.size).toBe(0);
  });

  it('should handle multiple partners on same project', () => {
    const assignments: AssignmentData[] = [
      {
        staff: { id: 1, name: 'John Smith', email: 'john@example.com' },
        project: {
          id: 10,
          name: 'Project A',
          category: 'HK Trx',
          filingDate: null,
          listingDate: null,
          elStatus: null,
          bcAttorney: null,
        },
      },
      {
        staff: { id: 2, name: 'Jane Doe', email: 'jane@example.com' },
        project: {
          id: 10,
          name: 'Project A',
          category: 'HK Trx',
          filingDate: null,
          listingDate: null,
          elStatus: null,
          bcAttorney: null,
        },
      },
    ];

    const result = deduplicateProjectsByPartner(assignments);

    expect(result.size).toBe(2); // 2 partners
    expect(result.get(1)?.projects.length).toBe(1); // Each partner sees the project once
    expect(result.get(2)?.projects.length).toBe(1);
    expect(result.get(1)?.projects[0].id).toBe(10);
    expect(result.get(2)?.projects[0].id).toBe(10);
  });
});
