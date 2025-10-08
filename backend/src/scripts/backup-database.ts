import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = '/home/timlihk/staffing-tracker/backups';
  const filename = `railway-backup-${timestamp}.sql`;
  const filepath = `${backupDir}/${filename}`;

  try {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('Starting database backup...');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not found in environment');
    }

    // Use pg_dump via Docker
    const command = `docker run --rm postgres:16 pg_dump "${databaseUrl}" > "${filepath}"`;

    console.log('Running pg_dump...');
    await execAsync(command);

    const stats = fs.statSync(filepath);
    console.log(`✅ Backup completed successfully!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
