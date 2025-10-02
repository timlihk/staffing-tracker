import * as XLSX from 'xlsx';
import prisma from '../utils/prisma';
import bcrypt from 'bcryptjs';
import path from 'path';

interface ExcelProject {
  name: string;
  status: string;
  category: string;
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

const determineCategory = (rowIndex: number, projectName: string | undefined | null): string => {
  const lowerName = (projectName && typeof projectName === 'string') ? projectName.toLowerCase() : '';

  // Check row-based sections
  if (rowIndex <= 35) return 'HK Transaction Projects';
  if (rowIndex <= 60) return 'US Transaction Projects';
  if (rowIndex <= 85) return 'HK Compliance Projects';
  if (rowIndex <= 95) return 'US Compliance Projects';
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

async function migrateFromExcel(excelFilePath: string) {
  console.log('📊 Starting Excel migration...');

  // Read Excel file
  const workbook = XLSX.readFile(excelFilePath);
  const projectSheet = workbook.Sheets['2. Staffing List by Project'];

  if (!projectSheet) {
    throw new Error('Sheet "2. Staffing List by Project" not found');
  }

  // Convert to JSON
  const data: any[] = XLSX.utils.sheet_to_json(projectSheet, { header: 1 });

  console.log(`📄 Found ${data.length} rows in Excel`);

  // Track unique staff members
  const staffMap = new Map<string, { name: string; role: string; department: string }>();

  // Process rows starting from row 2 (skip headers)
  const projects: ExcelProject[] = [];

  for (let i = 2; i < data.length; i++) {
    const row = data[i];

    if (!row[0] || row[0] === 'HK Transaction Projects' || row[0] === 'US Transaction Projects' ||
        row[0] === 'HK Compliance Projects' || row[0] === 'US Compliance Projects' || row[0] === 'Others') {
      continue; // Skip section headers
    }

    const project: ExcelProject = {
      name: cleanName(row[0]) || '',
      status: normalizeStatus(row[1]),
      category: determineCategory(i, row[0]),
      notes: cleanName(row[15]) || '',
      usLawIp: cleanName(row[2]),
      usAssociate: cleanName(row[3]),
      usSeniorFlic: cleanName(row[4]),
      usJuniorFlic: cleanName(row[5]),
      usIntern: cleanName(row[6]),
      hkLawIp: cleanName(row[7]),
      hkAssociate: cleanName(row[8]),
      hkSeniorFlic: cleanName(row[9]),
      hkJuniorFlic: cleanName(row[10]),
      hkIntern: cleanName(row[11]),
      bcWorkingAttorney: cleanName(row[12]),
    };

    if (project.name) {
      projects.push(project);

      // Collect staff members
      const staffRoles = [
        { names: splitNames(project.usLawIp), role: 'Income Partner', dept: 'US Law' },
        { names: splitNames(project.usAssociate), role: 'Associate', dept: 'US Law' },
        { names: splitNames(project.usSeniorFlic), role: 'Senior FLIC', dept: 'US Law' },
        { names: splitNames(project.usJuniorFlic), role: 'Junior FLIC', dept: 'US Law' },
        { names: splitNames(project.usIntern), role: 'Intern', dept: 'US Law' },
        { names: splitNames(project.hkLawIp), role: 'Income Partner', dept: 'HK Law' },
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

  console.log(`✅ Parsed ${projects.length} projects`);
  console.log(`✅ Found ${staffMap.size} unique staff members`);

  // Create staff members in database
  console.log('\n👥 Creating staff members...');
  const staffDbMap = new Map<string, number>();

  for (const [name, staffData] of staffMap.entries()) {
    try {
      const staff = await prisma.staff.create({
        data: {
          name: staffData.name,
          role: staffData.role,
          department: staffData.department,
          status: 'active',
        },
      });
      staffDbMap.set(name, staff.id);
      console.log(`  ✓ Created staff: ${name} (${staffData.role})`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Staff already exists, fetch it
        const existing = await prisma.staff.findFirst({ where: { name: staffData.name } });
        if (existing) {
          staffDbMap.set(name, existing.id);
        }
      } else {
        console.error(`  ✗ Error creating staff ${name}:`, error.message);
      }
    }
  }

  // Create projects and assignments
  console.log('\n📋 Creating projects and assignments...');

  for (const project of projects) {
    try {
      // Create project
      const dbProject = await prisma.project.create({
        data: {
          name: project.name,
          category: project.category,
          status: project.status,
          priority: project.status === 'Active' ? 'High' : 'Medium',
          bcAttorney: project.bcWorkingAttorney,
          notes: project.notes,
        },
      });

      console.log(`  ✓ Created project: ${project.name}`);

      // Create assignments
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
                  projectId: dbProject.id,
                  staffId,
                  roleInProject: role,
                  jurisdiction,
                  isLead: role === 'IP' || role === 'B&C Working Attorney',
                },
              });
              console.log(`    ✓ Assigned ${name} to ${project.name} as ${role} (${jurisdiction})`);
            } catch (error: any) {
              if (error.code !== 'P2002') {
                console.error(`    ✗ Error assigning ${name}:`, error.message);
              }
            }
          }
        }
      }

      // Create initial change history entry for status
      await prisma.projectChangeHistory.create({
        data: {
          projectId: dbProject.id,
          fieldName: 'status',
          oldValue: null,
          newValue: project.status,
          changeType: 'create',
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`  ⚠ Project ${project.name} already exists, skipping...`);
      } else {
        console.error(`  ✗ Error creating project ${project.name}:`, error.message);
      }
    }
  }

  // Create a default admin user
  console.log('\n👤 Creating default admin user...');
  try {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@ke.com',
        passwordHash,
        role: 'admin',
      },
    });
    console.log('  ✓ Created admin user (username: admin, password: admin123)');
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('  ⚠ Admin user already exists');
    } else {
      console.error('  ✗ Error creating admin user:', error.message);
    }
  }

  console.log('\n✅ Migration completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`  - Staff members: ${staffMap.size}`);
  console.log(`  - Projects: ${projects.length}`);
  console.log('\n🔐 Default credentials:');
  console.log('  Username: admin');
  console.log('  Password: admin123');
  console.log('\n⚠️  Please change the default password after first login!');
}

// Run migration
const excelPath = process.env.EXCEL_FILE || path.join(__dirname, '../../../CM Asia_Staffing List - 2025.09.09_2.xlsx');

migrateFromExcel(excelPath)
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
