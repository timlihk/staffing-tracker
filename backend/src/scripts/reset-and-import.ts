import prisma from '../utils/prisma';
import { execSync } from 'child_process';
import path from 'path';

async function resetDatabase() {
  console.log('🗑️  Resetting database...');

  try {
    // Delete all data in order (respecting foreign key constraints)
    await prisma.projectChangeHistory.deleteMany({});
    console.log('  ✓ Deleted project change history');

    await prisma.staffChangeHistory.deleteMany({});
    console.log('  ✓ Deleted staff change history');

    await prisma.projectAssignment.deleteMany({});
    console.log('  ✓ Deleted project assignments');

    await prisma.activityLog.deleteMany({});
    console.log('  ✓ Deleted activity logs');

    await prisma.project.deleteMany({});
    console.log('  ✓ Deleted projects');

    await prisma.staff.deleteMany({});
    console.log('  ✓ Deleted staff');

    await prisma.user.deleteMany({});
    console.log('  ✓ Deleted users');

    console.log('✅ Database reset complete!\n');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  }
}

async function runImport() {
  console.log('📊 Starting Excel import...\n');

  const excelPath = path.join(__dirname, '../../../CM Asia_Staffing List - 2025.09.09_2.xlsx');

  try {
    execSync(`npx ts-node ${path.join(__dirname, 'migrate-excel.ts')}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        EXCEL_FILE: excelPath
      }
    });
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await resetDatabase();
    await runImport();
    console.log('\n✅ Reset and import completed successfully!');
  } catch (error) {
    console.error('\n❌ Process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
