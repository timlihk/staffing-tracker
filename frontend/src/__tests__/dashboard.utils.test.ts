import { describe, it, expect } from 'vitest';

// Team member categorization function (extracted from Dashboard.tsx)
const categorizeTeamMembers = (members: Array<{ id: number; name: string; position: string }>) => {
  const partners: typeof members = [];
  const associates: typeof members = [];
  const flics: typeof members = [];
  const interns: typeof members = [];

  members.forEach((member) => {
    const positionLower = member.position.toLowerCase();
    if (positionLower.includes('partner')) {
      partners.push(member);
    } else if (positionLower.includes('associate')) {
      associates.push(member);
    } else if (positionLower.includes('flic')) {
      flics.push(member);
    } else if (positionLower.includes('intern')) {
      interns.push(member);
    }
  });

  const sortByName = (a: typeof members[0], b: typeof members[0]) => a.name.localeCompare(b.name);

  return {
    partners: partners.sort(sortByName),
    associates: associates.sort(sortByName),
    flics: flics.sort(sortByName),
    interns: interns.sort(sortByName),
  };
};

describe('Dashboard Utils', () => {
  describe('categorizeTeamMembers', () => {
    it('should categorize team members by position', () => {
      const teamMembers = [
        { id: 1, name: 'John Partner', position: 'Partner' },
        { id: 2, name: 'Jane Associate', position: 'Associate' },
        { id: 3, name: 'Bob FLIC', position: 'Senior FLIC' },
        { id: 4, name: 'Alice Intern', position: 'Intern' },
      ];

      const result = categorizeTeamMembers(teamMembers);

      expect(result.partners).toHaveLength(1);
      expect(result.associates).toHaveLength(1);
      expect(result.flics).toHaveLength(1);
      expect(result.interns).toHaveLength(1);

      expect(result.partners[0].name).toBe('John Partner');
      expect(result.associates[0].name).toBe('Jane Associate');
      expect(result.flics[0].name).toBe('Bob FLIC');
      expect(result.interns[0].name).toBe('Alice Intern');
    });

    it('should sort team members alphabetically within each category', () => {
      const teamMembers = [
        { id: 1, name: 'Zack Partner', position: 'Partner' },
        { id: 2, name: 'Amy Partner', position: 'Partner' },
        { id: 3, name: 'Mike Partner', position: 'Partner' },
      ];

      const result = categorizeTeamMembers(teamMembers);

      expect(result.partners).toHaveLength(3);
      expect(result.partners[0].name).toBe('Amy Partner');
      expect(result.partners[1].name).toBe('Mike Partner');
      expect(result.partners[2].name).toBe('Zack Partner');
    });

    it('should handle both Senior FLIC and Junior FLIC in same category', () => {
      const teamMembers = [
        { id: 1, name: 'Senior FLIC Person', position: 'Senior FLIC' },
        { id: 2, name: 'Junior FLIC Person', position: 'Junior FLIC' },
      ];

      const result = categorizeTeamMembers(teamMembers);

      expect(result.flics).toHaveLength(2);
      expect(result.flics[0].name).toBe('Junior FLIC Person');
      expect(result.flics[1].name).toBe('Senior FLIC Person');
    });

    it('should handle empty array', () => {
      const teamMembers: Array<{ id: number; name: string; position: string }> = [];

      const result = categorizeTeamMembers(teamMembers);

      expect(result.partners).toHaveLength(0);
      expect(result.associates).toHaveLength(0);
      expect(result.flics).toHaveLength(0);
      expect(result.interns).toHaveLength(0);
    });

    it('should handle mixed case position names', () => {
      const teamMembers = [
        { id: 1, name: 'Person 1', position: 'PARTNER' },
        { id: 2, name: 'Person 2', position: 'partner' },
        { id: 3, name: 'Person 3', position: 'Partner' },
      ];

      const result = categorizeTeamMembers(teamMembers);

      expect(result.partners).toHaveLength(3);
    });

    it('should handle positions with additional text', () => {
      const teamMembers = [
        { id: 1, name: 'Person 1', position: 'Senior Partner' },
        { id: 2, name: 'Person 2', position: 'Associate Partner' }, // Should go to partners
        { id: 3, name: 'Person 3', position: 'Lead Associate' },
      ];

      const result = categorizeTeamMembers(teamMembers);

      expect(result.partners).toHaveLength(2); // Both "Partner" positions
      expect(result.associates).toHaveLength(1);
    });

    it('should not include members with unknown positions in any category', () => {
      const teamMembers = [
        { id: 1, name: 'John Partner', position: 'Partner' },
        { id: 2, name: 'Unknown Role', position: 'Admin' },
        { id: 3, name: 'Jane Associate', position: 'Associate' },
      ];

      const result = categorizeTeamMembers(teamMembers);

      expect(result.partners).toHaveLength(1);
      expect(result.associates).toHaveLength(1);
      expect(result.flics).toHaveLength(0);
      expect(result.interns).toHaveLength(0);

      // Total should be less than input
      const total =
        result.partners.length +
        result.associates.length +
        result.flics.length +
        result.interns.length;
      expect(total).toBe(2); // Only Partner and Associate
    });

    it('should handle duplicate names but different IDs', () => {
      const teamMembers = [
        { id: 1, name: 'George Zheng', position: 'Partner' },
        { id: 2, name: 'George Zheng', position: 'B&C Working Attorney' },
      ];

      const result = categorizeTeamMembers(teamMembers);

      // Partner position will be categorized as partner
      expect(result.partners).toHaveLength(1); // Only Partner position matches
      // B&C Working Attorney doesn't match any category (no "partner", "associate", "flic", or "intern" keywords)
      // This is expected behavior - only specific positions are categorized
    });

    it('should maintain stability of sorted order', () => {
      const teamMembers = [
        { id: 1, name: 'Alice', position: 'Partner' },
        { id: 2, name: 'Bob', position: 'Partner' },
        { id: 3, name: 'Charlie', position: 'Partner' },
      ];

      const result1 = categorizeTeamMembers(teamMembers);
      const result2 = categorizeTeamMembers(teamMembers);

      expect(result1.partners).toEqual(result2.partners);
    });

    it('should handle special characters in names', () => {
      const teamMembers = [
        { id: 1, name: "O'Brien", position: 'Partner' },
        { id: 2, name: 'José García', position: 'Associate' },
        { id: 3, name: 'Wang-Li', position: 'Senior FLIC' },
      ];

      const result = categorizeTeamMembers(teamMembers);

      expect(result.partners[0].name).toBe("O'Brien");
      expect(result.associates[0].name).toBe('José García');
      expect(result.flics[0].name).toBe('Wang-Li');
    });

    it('should handle very long team lists efficiently', () => {
      const teamMembers = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Person ${i}`,
        position: ['Partner', 'Associate', 'Senior FLIC', 'Junior FLIC', 'Intern'][
          i % 5
        ],
      }));

      const result = categorizeTeamMembers(teamMembers);

      const total =
        result.partners.length +
        result.associates.length +
        result.flics.length +
        result.interns.length;

      expect(total).toBe(100);
      expect(result.partners).toHaveLength(20);
      expect(result.associates).toHaveLength(20);
      expect(result.flics).toHaveLength(40); // Both Senior and Junior FLIC
      expect(result.interns).toHaveLength(20);
    });
  });
});
