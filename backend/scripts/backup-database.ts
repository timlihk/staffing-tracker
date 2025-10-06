import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    console.log('Starting database backup...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../../backups');

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Fetch all data from all tables
    const backup = {
      timestamp: new Date().toISOString(),
      users: await prisma.user.findMany(),
      staff: await prisma.staff.findMany(),
      projects: await prisma.project.findMany(),
      projectAssignments: await prisma.projectAssignment.findMany(),
      activityLogs: await prisma.activityLog.findMany(),
      emailSettings: await prisma.emailSettings.findMany(),
    };

    const filename = `staffing_tracker_backup_${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log(`✅ Backup completed successfully!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Records backed up:`);
    console.log(`   - Users: ${backup.users.length}`);
    console.log(`   - Staff: ${backup.staff.length}`);
    console.log(`   - Projects: ${backup.projects.length}`);
    console.log(`   - Project Assignments: ${backup.projectAssignments.length}`);
    console.log(`   - Activity Logs: ${backup.activityLogs.length}`);
    console.log(`   - Email Settings: ${backup.emailSettings.length}`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
