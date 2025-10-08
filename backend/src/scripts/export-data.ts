import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function exportData() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = '/home/timlihk/staffing-tracker/backups';
  const filename = `railway-data-${timestamp}.json`;
  const filepath = `${backupDir}/${filename}`;

  try {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('Exporting database data...');

    // Export all data
    const data = {
      users: await prisma.user.findMany(),
      staff: await prisma.staff.findMany(),
      projects: await prisma.project.findMany(),
      projectAssignments: await prisma.projectAssignment.findMany(),
      projectChangeHistory: await prisma.projectChangeHistory.findMany(),
      staffChangeHistory: await prisma.staffChangeHistory.findMany(),
      activityLog: await prisma.activityLog.findMany(),
      metadata: {
        exportedAt: new Date().toISOString(),
        databaseUrl: process.env.DATABASE_URL?.split('@')[1], // Hide password
      }
    };

    // Write to file
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    const stats = fs.statSync(filepath);
    console.log(`✅ Export completed successfully!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`\n📋 Record counts:`);
    console.log(`   Users: ${data.users.length}`);
    console.log(`   Staff: ${data.staff.length}`);
    console.log(`   Projects: ${data.projects.length}`);
    console.log(`   Assignments: ${data.projectAssignments.length}`);
    console.log(`   Activity Logs: ${data.activityLog.length}`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
