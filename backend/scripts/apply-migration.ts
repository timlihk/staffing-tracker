import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Applying migration to add financial columns to billing_project_cm_no...\n');

    // Step 1: Add columns
    console.log('Step 1: Adding financial columns to billing_project_cm_no table...');
    await prisma.$executeRaw`
      ALTER TABLE billing_project_cm_no
        ADD COLUMN IF NOT EXISTS billing_to_date_usd DECIMAL(18, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS billing_to_date_cny DECIMAL(18, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS collected_to_date_usd DECIMAL(18, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS collected_to_date_cny DECIMAL(18, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ubt_usd DECIMAL(18, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ubt_cny DECIMAL(18, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS billing_credit_usd DECIMAL(18, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS billing_credit_cny DECIMAL(18, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS financials_updated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS financials_updated_by INTEGER
    `;
    console.log('✓ Columns added successfully\n');

    // Step 2: Migrate existing data from engagements to C/M numbers
    console.log('Step 2: Migrating existing financial data from engagements...');
    await prisma.$executeRaw`
      UPDATE billing_project_cm_no cm
      SET
        ubt_usd = COALESCE((
          SELECT SUM(e.ubt_usd)
          FROM billing_engagement e
          WHERE e.cm_id = cm.cm_id
        ), 0),
        ubt_cny = COALESCE((
          SELECT SUM(e.ubt_cny)
          FROM billing_engagement e
          WHERE e.cm_id = cm.cm_id
        ), 0),
        billing_credit_usd = COALESCE((
          SELECT SUM(e.billing_credit_usd)
          FROM billing_engagement e
          WHERE e.cm_id = cm.cm_id
        ), 0),
        billing_credit_cny = COALESCE((
          SELECT SUM(e.billing_credit_cny)
          FROM billing_engagement e
          WHERE e.cm_id = cm.cm_id
        ), 0),
        financials_updated_at = (
          SELECT MAX(e.financials_last_updated_at)
          FROM billing_engagement e
          WHERE e.cm_id = cm.cm_id
        ),
        financials_updated_by = (
          SELECT e.financials_last_updated_by
          FROM billing_engagement e
          WHERE e.cm_id = cm.cm_id
          AND e.financials_last_updated_at = (
            SELECT MAX(e2.financials_last_updated_at)
            FROM billing_engagement e2
            WHERE e2.cm_id = cm.cm_id
          )
          LIMIT 1
        )
    `;
    console.log('✓ Data migrated successfully\n');

    // Step 3: Remove financial columns from billing_engagement
    console.log('Step 3: Removing financial columns from billing_engagement table...');
    await prisma.$executeRaw`
      ALTER TABLE billing_engagement
        DROP COLUMN IF EXISTS ubt_usd,
        DROP COLUMN IF EXISTS ubt_cny,
        DROP COLUMN IF EXISTS billing_credit_usd,
        DROP COLUMN IF EXISTS billing_credit_cny,
        DROP COLUMN IF EXISTS financials_last_updated_at,
        DROP COLUMN IF EXISTS financials_last_updated_by,
        DROP COLUMN IF EXISTS bonus_usd,
        DROP COLUMN IF EXISTS bonus_cny,
        DROP COLUMN IF EXISTS total_agreed_fee_value,
        DROP COLUMN IF EXISTS total_agreed_fee_currency
    `;
    console.log('✓ Columns removed successfully\n');

    console.log('✅ Migration completed successfully!');
    console.log('\nYou can now run: npx ts-node scripts/update-billing-financials.ts');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
