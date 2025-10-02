import * as XLSX from 'xlsx';
import prisma from '../utils/prisma';
import bcrypt from 'bcryptjs';
import path from 'path';
import { Timetable } from '@prisma/client';

interface ExcelProject {
  name: string;
  status: string;
  category: string;
  timetable?: Timetable | null;
  elStatus?: string;
  notes?: string;
  usLawIp?: string;
  usAssociate?: string;
  usSeniorFlic?: string;
  usJuniorFlic?: string;
  usIntern?: string;
  hkLawIp?: string;
  hkAssociate?: string;
  hkSeniorFlic?: string;
  hkJuniorFlic?: string;
  hkIntern?: string;
  bcWorkingAttorney?: string;
}

const cleanName = (name: string | undefined | null): string | undefined => {
  if (!name || typeof name !== 'string') return undefined;
  return name.trim().replace(/\s+/g, ' ');
};

const splitNames = (nameString: string | undefined | null): string[] => {
  if (!nameString) return [];
  return nameString
    .split('/')
    .map((n) => cleanName(n))
    .filter((n) => n !== undefined && n !== '' && n.toLowerCase() !== 'nan') as string[];
};

const normalizeTimetable = (timetable: string | undefined): Timetable | null => {
  if (!timetable || typeof timetable !== 'string') return null;
  const cleaned = timetable.trim();
  if (cleaned.toLowerCase() === 'pre-a1') return Timetable.PRE_A1;
  if (cleaned.toLowerCase() === 'a1') return Timetable.A1;
  if (cleaned.toLowerCase() === 'hearing') return Timetable.HEARING;
  if (cleaned.toLowerCase() === 'listing') return Timetable.LISTING;
  return null;
};

const normalizeCategory = (projectType: string | undefined): string => {
  if (!projectType || typeof projectType !== 'string') return 'Others';
  const cleaned = projectType.trim();
  if (cleaned === 'HK Trx') return 'HK Transaction Projects';
  if (cleaned === 'US Trx') return 'US Transaction Projects';
  if (cleaned === 'HK Compliance') return 'HK Compliance Projects';
  if (cleaned === 'US Compliance') return 'US Compliance Projects';
  return 'Others';
};

const normalizeStatus = (status: string | undefined): string => {
  if (!status) return 'Active';
  const cleaned = status.trim();
  if (cleaned === 'Active ' || cleaned === 'Active') return 'Active';
  if (cleaned === 'Slow-down') return 'Slow-down';
  if (cleaned === 'Suspended') return 'Suspended';
  return 'Active';
};

async function syncFromExcel(excelFilePath: string) {
  console.log('📊 Starting Excel sync...');
  console.log('📁 Excel file:', excelFilePath);

  // Read Excel file
  const workbook = XLSX.readFile(excelFilePath);
  const projectSheet = workbook.Sheets['2. Staffing List by Project'];

  if (!projectSheet) {
    throw new Error('Sheet "2. Staffing List by Project" not found');
  }

  // Convert to JSON
  const data: any[] = XLSX.utils.sheet_to_json(projectSheet, { header: 1 });
  console.log(`📄 Found ${data.length} rows in Excel\n`);

  // Track unique staff members
  const staffMap = new Map<string, { name: string; role: string; department: string }>();

  // Process rows starting from row 2 (skip headers)
  const excelProjects: ExcelProject[] = [];

  for (let i = 2; i < data.length; i++) {
    const row = data[i];

    // Skip empty rows or section headers
    if (!row[0] || typeof row[0] !== 'string' && typeof row[0] !== 'number') {
      continue;
    }

    const project: ExcelProject = {
      name: String(row[0]).trim(),
      category: normalizeCategory(row[1]),
      status: normalizeStatus(row[2]),
      timetable: normalizeTimetable(row[14]),
      elStatus: cleanName(row[15]) || undefined,
      notes: cleanName(row[16]) || undefined,
      usLawIp: cleanName(row[3]),
      usAssociate: cleanName(row[4]),
      usSeniorFlic: cleanName(row[5]),
      usJuniorFlic: cleanName(row[6]),
      usIntern: cleanName(row[7]),
      hkLawIp: cleanName(row[8]),
      hkAssociate: cleanName(row[9]),
      hkSeniorFlic: cleanName(row[10]),
      hkJuniorFlic: cleanName(row[11]),
      hkIntern: cleanName(row[12]),
      bcWorkingAttorney: cleanName(row[13]),
    };

    if (project.name) {
      excelProjects.push(project);

      // Collect staff members
      const staffRoles = [
        { names: splitNames(project.usLawIp), role: 'Partner', dept: 'US Law' },
        { names: splitNames(project.usAssociate), role: 'Associate', dept: 'US Law' },
        { names: splitNames(project.usSeniorFlic), role: 'Senior FLIC', dept: 'US Law' },
        { names: splitNames(project.usJuniorFlic), role: 'Junior FLIC', dept: 'US Law' },
        { names: splitNames(project.usIntern), role: 'Intern', dept: 'US Law' },
        { names: splitNames(project.hkLawIp), role: 'Partner', dept: 'HK Law' },
        { names: splitNames(project.hkAssociate), role: 'Associate', dept: 'HK Law' },
        { names: splitNames(project.hkSeniorFlic), role: 'Senior FLIC', dept: 'HK Law' },
        { names: splitNames(project.hkJuniorFlic), role: 'Junior FLIC', dept: 'HK Law' },
        { names: splitNames(project.hkIntern), role: 'Intern', dept: 'HK Law' },
        { names: splitNames(project.bcWorkingAttorney), role: 'B&C Working Attorney', dept: 'B&C' },
      ];

      staffRoles.forEach(({ names, role, dept }) => {
        names.forEach((name) => {
          if (!staffMap.has(name)) {
            staffMap.set(name, { name, role, department: dept });
          }
        });
      });
    }
  }

  console.log(`✅ Parsed ${excelProjects.length} projects from Excel`);
  console.log(`✅ Found ${staffMap.size} unique staff members\n`);

  // Sync Staff
  console.log('👥 Syncing staff members...');
  const staffDbMap = new Map<string, number>();
  const dbStaff = await prisma.staff.findMany();
  const dbStaffByName = new Map(dbStaff.map(s => [s.name, s]));

  let staffCreated = 0;
  let staffUpdated = 0;
  let staffUnchanged = 0;

  for (const [name, staffData] of staffMap.entries()) {
    const existing = dbStaffByName.get(staffData.name);

    if (!existing) {
      // Create new staff
      const staff = await prisma.staff.create({
        data: {
          name: staffData.name,
          role: staffData.role,
          department: staffData.department,
          status: 'active',
        },
      });
      staffDbMap.set(name, staff.id);
      console.log(`  ✓ Created: ${name} (${staffData.role})`);
      staffCreated++;
    } else {
      staffDbMap.set(name, existing.id);

      // Update if role or department changed
      if (existing.role !== staffData.role || existing.department !== staffData.department) {
        await prisma.staff.update({
          where: { id: existing.id },
          data: {
            role: staffData.role,
            department: staffData.department,
          },
        });
        console.log(`  ↻ Updated: ${name} (${existing.role} → ${staffData.role})`);
        staffUpdated++;
      } else {
        staffUnchanged++;
      }
    }
  }

  console.log(`\n📊 Staff sync complete: ${staffCreated} created, ${staffUpdated} updated, ${staffUnchanged} unchanged\n`);

  // Sync Projects
  console.log('📋 Syncing projects...');
  const dbProjects = await prisma.project.findMany();
  const dbProjectsByCode = new Map(dbProjects.map(p => [p.name, p]));

  let projectsCreated = 0;
  let projectsUpdated = 0;
  let projectsUnchanged = 0;

  for (const project of excelProjects) {
    const existing = dbProjectsByCode.get(project.name);

    const projectData = {
      name: project.name,
      category: project.category,
      status: project.status,
      priority: project.status === 'Active' ? 'High' : 'Medium',
      timetable: project.timetable || null,
      elStatus: project.elStatus || null,
      bcAttorney: project.bcWorkingAttorney || null,
      notes: project.notes || null,
    };

    if (!existing) {
      // Create new project
      const dbProject = await prisma.project.create({
        data: projectData,
      });
      console.log(`  ✓ Created: ${project.name}`);
      projectsCreated++;

      // Create assignments
      await createAssignments(dbProject.id, project, staffDbMap);
    } else {
      // Update existing project
      const needsUpdate =
        existing.status !== projectData.status ||
        existing.category !== projectData.category ||
        existing.priority !== projectData.priority ||
        existing.timetable !== projectData.timetable ||
        existing.elStatus !== projectData.elStatus ||
        existing.bcAttorney !== projectData.bcAttorney ||
        existing.notes !== projectData.notes;

      if (needsUpdate) {
        await prisma.project.update({
          where: { id: existing.id },
          data: projectData,
        });
        console.log(`  ↻ Updated: ${project.name}`);
        projectsUpdated++;
      } else {
        projectsUnchanged++;
      }

      // Sync assignments for this project
      await syncAssignments(existing.id, project, staffDbMap);
    }
  }

  console.log(`\n📊 Project sync complete: ${projectsCreated} created, ${projectsUpdated} updated, ${projectsUnchanged} unchanged\n`);

  // Delete projects not in Excel
  const excelProjectCodes = new Set(excelProjects.map(p => p.name));
  const projectsToDelete = dbProjects.filter(p => !excelProjectCodes.has(p.name));

  if (projectsToDelete.length > 0) {
    console.log(`🗑️  Deleting ${projectsToDelete.length} projects not in Excel...`);
    for (const project of projectsToDelete) {
      await prisma.project.delete({ where: { id: project.id } });
      console.log(`  ✗ Deleted: ${project.name}`);
    }
  }

  // Ensure admin user exists
  console.log('\n👤 Checking admin user...');
  const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@ke.com',
        passwordHash,
        role: 'admin',
      },
    });
    console.log('  ✓ Created admin user (username: admin, password: admin123)');
  } else {
    console.log('  ✓ Admin user already exists');
  }

  console.log('\n✅ Excel sync completed successfully!');
  console.log('\n📊 Final Summary:');
  console.log(`  - Staff: ${staffCreated} created, ${staffUpdated} updated`);
  console.log(`  - Projects: ${projectsCreated} created, ${projectsUpdated} updated, ${projectsToDelete.length} deleted`);
}

async function createAssignments(
  projectId: number,
  project: ExcelProject,
  staffDbMap: Map<string, number>
) {
  const assignments = [
    { names: splitNames(project.usLawIp), role: 'IP', jurisdiction: 'US Law' },
    { names: splitNames(project.usAssociate), role: 'Associate', jurisdiction: 'US Law' },
    { names: splitNames(project.usSeniorFlic), role: 'Senior FLIC', jurisdiction: 'US Law' },
    { names: splitNames(project.usJuniorFlic), role: 'Junior FLIC', jurisdiction: 'US Law' },
    { names: splitNames(project.usIntern), role: 'Intern', jurisdiction: 'US Law' },
    { names: splitNames(project.hkLawIp), role: 'IP', jurisdiction: 'HK Law' },
    { names: splitNames(project.hkAssociate), role: 'Associate', jurisdiction: 'HK Law' },
    { names: splitNames(project.hkSeniorFlic), role: 'Senior FLIC', jurisdiction: 'HK Law' },
    { names: splitNames(project.hkJuniorFlic), role: 'Junior FLIC', jurisdiction: 'HK Law' },
    { names: splitNames(project.hkIntern), role: 'Intern', jurisdiction: 'HK Law' },
    { names: splitNames(project.bcWorkingAttorney), role: 'B&C Working Attorney', jurisdiction: 'B&C' },
  ];

  for (const { names, role, jurisdiction } of assignments) {
    for (const name of names) {
      const staffId = staffDbMap.get(name);
      if (staffId) {
        try {
          await prisma.projectAssignment.create({
            data: {
              projectId,
              staffId,
              roleInProject: role,
              jurisdiction,
              isLead: role === 'IP' || role === 'B&C Working Attorney',
            },
          });
        } catch (error: any) {
          if (error.code !== 'P2002') {
            console.error(`    ✗ Error assigning ${name}:`, error.message);
          }
        }
      }
    }
  }
}

async function syncAssignments(
  projectId: number,
  project: ExcelProject,
  staffDbMap: Map<string, number>
) {
  // Get current assignments
  const currentAssignments = await prisma.projectAssignment.findMany({
    where: { projectId },
    include: { staff: true },
  });

  // Build expected assignments from Excel
  const expectedAssignments = new Map<string, { staffId: number; role: string; jurisdiction: string }>();

  const assignments = [
    { names: splitNames(project.usLawIp), role: 'IP', jurisdiction: 'US Law' },
    { names: splitNames(project.usAssociate), role: 'Associate', jurisdiction: 'US Law' },
    { names: splitNames(project.usSeniorFlic), role: 'Senior FLIC', jurisdiction: 'US Law' },
    { names: splitNames(project.usJuniorFlic), role: 'Junior FLIC', jurisdiction: 'US Law' },
    { names: splitNames(project.usIntern), role: 'Intern', jurisdiction: 'US Law' },
    { names: splitNames(project.hkLawIp), role: 'IP', jurisdiction: 'HK Law' },
    { names: splitNames(project.hkAssociate), role: 'Associate', jurisdiction: 'HK Law' },
    { names: splitNames(project.hkSeniorFlic), role: 'Senior FLIC', jurisdiction: 'HK Law' },
    { names: splitNames(project.hkJuniorFlic), role: 'Junior FLIC', jurisdiction: 'HK Law' },
    { names: splitNames(project.hkIntern), role: 'Intern', jurisdiction: 'HK Law' },
    { names: splitNames(project.bcWorkingAttorney), role: 'B&C Working Attorney', jurisdiction: 'B&C' },
  ];

  for (const { names, role, jurisdiction } of assignments) {
    for (const name of names) {
      const staffId = staffDbMap.get(name);
      if (staffId) {
        const key = `${staffId}-${role}-${jurisdiction}`;
        expectedAssignments.set(key, { staffId, role, jurisdiction });
      }
    }
  }

  // Delete assignments not in Excel
  for (const current of currentAssignments) {
    const key = `${current.staffId}-${current.roleInProject}-${current.jurisdiction}`;
    if (!expectedAssignments.has(key)) {
      await prisma.projectAssignment.delete({ where: { id: current.id } });
      console.log(`    ✗ Removed assignment: ${current.staff.name} from ${project.name}`);
    }
  }

  // Add new assignments from Excel
  const currentKeys = new Set(
    currentAssignments.map(a => `${a.staffId}-${a.roleInProject}-${a.jurisdiction}`)
  );

  for (const [key, assignment] of expectedAssignments) {
    if (!currentKeys.has(key)) {
      try {
        await prisma.projectAssignment.create({
          data: {
            projectId,
            staffId: assignment.staffId,
            roleInProject: assignment.role,
            jurisdiction: assignment.jurisdiction,
            isLead: assignment.role === 'IP' || assignment.role === 'B&C Working Attorney',
          },
        });
        const staffName = [...staffDbMap.entries()].find(([_, id]) => id === assignment.staffId)?.[0];
        console.log(`    ✓ Added assignment: ${staffName} to ${project.name}`);
      } catch (error: any) {
        if (error.code !== 'P2002') {
          console.error(`    ✗ Error creating assignment:`, error.message);
        }
      }
    }
  }
}

// Run sync
const excelPath = path.join(__dirname, '../../../CM Asia_Staffing List - 2025.09.09_2.xlsx');

syncFromExcel(excelPath)
  .catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
