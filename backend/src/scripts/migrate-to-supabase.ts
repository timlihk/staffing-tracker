import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

const SUPABASE_URL = 'postgresql://postgres:pbotB5y6gLHRBKyW@db.pxnpgposeattzlpnokqn.supabase.co:5432/postgres';

async function migrateToSupabase() {
  console.log('🚀 Starting Supabase Migration\n');

  try {
    // Step 1: Test connection
    console.log('1️⃣ Testing Supabase connection...');
    const testCmd = `DATABASE_URL="${SUPABASE_URL}" npx prisma db execute --stdin <<< "SELECT 1;"`;
    try {
      await execAsync(testCmd);
      console.log('✅ Connection successful!\n');
    } catch (error) {
      console.log('⚠️  Direct test failed, continuing with migration...\n');
    }

    // Step 2: Run Prisma migrations
    console.log('2️⃣ Creating database schema with Prisma...');
    const migrateCmd = `DATABASE_URL="${SUPABASE_URL}" npx prisma migrate deploy`;
    const { stdout: migrateOut } = await execAsync(migrateCmd);
    console.log(migrateOut);
    console.log('✅ Schema created!\n');

    // Step 3: Show SQL file path
    const backupFiles = fs.readdirSync('/home/timlihk/staffing-tracker/backups')
      .filter(f => f.startsWith('migration-to-supabase'))
      .sort()
      .reverse();

    const sqlFile = `/home/timlihk/staffing-tracker/backups/${backupFiles[0]}`;

    console.log('3️⃣ Data import ready!');
    console.log(`\n📝 SQL file location: ${sqlFile}\n`);
    console.log('⚠️  PostgreSQL client (psql) is not installed in this environment.');
    console.log('\nPlease choose one of these options to import data:\n');
    console.log('OPTION A - Supabase SQL Editor (Easiest):');
    console.log('  1. Go to: https://supabase.com/dashboard/project/pxnpgposeattzlpnokqn/sql/new');
    console.log('  2. Copy the contents of the SQL file');
    console.log('  3. Paste and run in the SQL Editor\n');
    console.log('OPTION B - Install psql and run:');
    console.log('  sudo apt-get install -y postgresql-client');
    console.log(`  psql "${SUPABASE_URL}" < ${sqlFile}\n`);
    console.log('OPTION C - I can create a Node.js import script (slower but works)');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

migrateToSupabase();
