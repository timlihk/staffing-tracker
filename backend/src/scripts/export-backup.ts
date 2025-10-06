import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportData() {
  try {
    console.log('Fetching data from database...');

    const [
      users,
      staff,
      projects,
      projectAssignments,
      activityLog,
      emailSettings,
      projectChangeHistory,
      staffChangeHistory
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.staff.findMany(),
      prisma.project.findMany(),
      prisma.projectAssignment.findMany(),
      prisma.activityLog.findMany(),
      prisma.emailSettings.findMany(),
      prisma.projectChangeHistory.findMany(),
      prisma.staffChangeHistory.findMany()
    ]);

    const backup = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {
        users,
        staff,
        projects,
        projectAssignments,
        activityLog,
        emailSettings,
        projectChangeHistory,
        staffChangeHistory
      },
      counts: {
        users: users.length,
        staff: staff.length,
        projects: projects.length,
        projectAssignments: projectAssignments.length,
        activityLog: activityLog.length,
        emailSettings: emailSettings.length,
        projectChangeHistory: projectChangeHistory.length,
        staffChangeHistory: staffChangeHistory.length
      }
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = path.join(process.cwd(), '..', `database-backup-${timestamp}.json`);

    fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

    console.log(`\n✅ Backup created successfully: ${filename}`);
    console.log('\nBackup summary:');
    console.log(`- Users: ${backup.counts.users}`);
    console.log(`- Staff: ${backup.counts.staff}`);
    console.log(`- Projects: ${backup.counts.projects}`);
    console.log(`- Project Assignments: ${backup.counts.projectAssignments}`);
    console.log(`- Activity Log: ${backup.counts.activityLog}`);
    console.log(`- Email Settings: ${backup.counts.emailSettings}`);
    console.log(`- Project Change History: ${backup.counts.projectChangeHistory}`);
    console.log(`- Staff Change History: ${backup.counts.staffChangeHistory}`);

  } catch (error) {
    console.error('Error exporting data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
