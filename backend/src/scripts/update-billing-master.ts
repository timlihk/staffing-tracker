/**
 * Master Billing Update Script
 * 
 * Orchestrates all billing updates from the Excel file:
 * 1. Parse source data from Excel into normalized tables
 * 2. Update financials (billing, collection, UBT)
 * 3. Parse fee arrangements and create milestones
 * 4. Auto-map B&C attorneys
 * 
 * Usage:
 *   npm run billing:update-all
 * 
 * Or step by step:
 *   npm run billing:parse-source      # Parse Excel to source_transactions_raw
 *   npm run billing:parse-projects    # Parse source to projects/engagements
 *   npm run billing:update-financials # Update billing/collection/UBT
 *   npm run billing:parse-fees        # Parse fee arrangements
 *   npm run billing:parse-completion  # Mark completed milestones
 *   npm run billing:map-attorneys     # Map attorneys to staff
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Configuration
const EXCEL_FILE = process.env.EXCEL_FILE || 
  '/Users/timli/Library/CloudStorage/OneDrive-Personal/Coding/staffing-tracker/Billing/HKCM Project List (2026.02.12).xlsx';

const SCRIPTS_DIR = __dirname;

interface Step {
  name: string;
  description: string;
  command?: string;
  fn?: () => Promise<void>;
  optional?: boolean;
}

const steps: Step[] = [
  {
    name: 'validate',
    description: 'Validate Excel file and environment',
    fn: validateEnvironment
  },
  {
    name: 'update-financials',
    description: 'Update financial data (billing, collection, UBT)',
    command: `python3 "${path.join(SCRIPTS_DIR, 'update-billing-from-excel.py')}"`,
  },
  {
    name: 'parse-fees',
    description: 'Parse fee arrangements and create milestones',
    command: `npx ts-node "${path.join(SCRIPTS_DIR, 'parse-fee-arrangements.ts')}"`,
    optional: true
  },
  {
    name: 'parse-completion',
    description: 'Detect completed milestones from strikethrough',
    command: `npx ts-node "${path.join(SCRIPTS_DIR, 'parse-fee-with-strikethrough.ts')}"`,
    optional: true
  },
  {
    name: 'map-attorneys',
    description: 'Auto-map B&C attorneys to staff',
    command: `npx ts-node "${path.join(SCRIPTS_DIR, 'auto-map-bc-attorneys.ts')}"`,
    optional: true
  }
];

async function validateEnvironment() {
  console.log('🔍 Validating environment...\n');
  
  // Check Excel file exists
  if (!fs.existsSync(EXCEL_FILE)) {
    throw new Error(`Excel file not found: ${EXCEL_FILE}\nSet EXCEL_FILE environment variable to the correct path.`);
  }
  console.log(`✅ Excel file found: ${EXCEL_FILE}`);
  
  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection OK');
  } catch (error) {
    throw new Error(`Database connection failed: ${error}`);
  }
  
  // Check Python is available
  try {
    execSync('python3 --version', { stdio: 'pipe' });
    console.log('✅ Python 3 available');
  } catch {
    throw new Error('Python 3 is required but not found');
  }
  
  // Check required Python packages
  try {
    execSync('python3 -c "import openpyxl, psycopg2"', { stdio: 'pipe' });
    console.log('✅ Required Python packages available (openpyxl, psycopg2)');
  } catch {
    console.warn('⚠️  Python packages may be missing. Run: pip install openpyxl psycopg2-binary');
  }
  
  console.log('\n✅ Environment validation passed\n');
}

function runCommand(command: string, stepName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Running: ${stepName}`);
  console.log(`${'='.repeat(80)}\n`);
  
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        EXCEL_FILE
      }
    });
    return true;
  } catch (error) {
    console.error(`\n❌ Step "${stepName}" failed`);
    return false;
  }
}

async function runInteractive() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                   BILLING DATABASE UPDATE MASTER SCRIPT                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

Excel File: ${EXCEL_FILE}

This script will update the billing database with data from the Excel file.
Steps:
`);

  steps.forEach((step, i) => {
    const optional = step.optional ? ' (optional)' : '';
    console.log(`  ${i + 1}. ${step.description}${optional}`);
  });

  console.log('\n' + '='.repeat(80) + '\n');

  // Validate first
  await validateEnvironment();

  let currentStep = 1;
  
  for (const step of steps) {
    if (step.name === 'validate') continue; // Already done
    
    if (step.fn) {
      // Run TypeScript function
      try {
        await step.fn();
        console.log(`\n✅ ${step.name} completed\n`);
      } catch (error) {
        console.error(`\n❌ ${step.name} failed:`, error);
        if (!step.optional) {
          process.exit(1);
        }
      }
    } else if (step.command) {
      // Run shell command
      const success = runCommand(step.command, step.description);
      if (!success && !step.optional) {
        console.error('\n❌ Critical step failed. Aborting.');
        process.exit(1);
      }
    }
    
    currentStep++;
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All billing updates completed successfully!');
  console.log('='.repeat(80) + '\n');
}

async function runAll() {
  console.log('🚀 Running all billing updates in sequence...\n');
  
  await validateEnvironment();
  
  for (const step of steps) {
    if (step.name === 'validate') continue;
    
    console.log(`\n📌 Step: ${step.description}`);
    
    if (step.fn) {
      try {
        await step.fn();
      } catch (error) {
        console.error(`❌ Failed:`, error);
        if (!step.optional) process.exit(1);
      }
    } else if (step.command) {
      const success = runCommand(step.command, step.description);
      if (!success && !step.optional) {
        process.exit(1);
      }
    }
  }
  
  console.log('\n✅ All updates completed!');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Billing Update Master Script

Usage:
  npm run billing:update-all              Run all updates
  npm run billing:update-all -- --dry-run Validate only, don't update
  ts-node src/scripts/update-billing-master.ts [options]

Options:
  --help, -h      Show this help
  --dry-run       Validate environment only
  --step=N        Start from specific step (1-${steps.length})

Environment Variables:
  EXCEL_FILE      Path to HKCM Project List Excel file
  DATABASE_URL    PostgreSQL connection string

Examples:
  export EXCEL_FILE="/path/to/file.xlsx"
  npm run billing:update-all
`);
    process.exit(0);
  }
  
  if (args.includes('--dry-run')) {
    await validateEnvironment();
    console.log('\n✅ Dry run completed - environment is ready');
    process.exit(0);
  }
  
  try {
    await runAll();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
