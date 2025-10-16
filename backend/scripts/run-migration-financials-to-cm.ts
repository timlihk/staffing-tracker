import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('Reading migration SQL...');
    const sqlPath = path.join(__dirname, 'migrate-financials-to-cm-level.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Split by semicolons and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Extract comment for logging
      const lines = statement.split('\n');
      const comment = lines.find(l => l.trim().startsWith('--'));

      if (comment) {
        console.log(`\n[${i + 1}/${statements.length}] ${comment.replace('--', '').trim()}`);
      } else {
        console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
      }

      try {
        await prisma.$executeRawUnsafe(statement);
        console.log('✓ Success');
      } catch (error: any) {
        console.error(`✗ Error: ${error.message}`);
        if (error.message.includes('does not exist') || error.message.includes('already exists')) {
          console.log('  (Continuing...)');
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
