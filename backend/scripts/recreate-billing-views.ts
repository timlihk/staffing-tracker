import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function recreateViews() {
  try {
    console.log('Recreating billing views...\n');

    // Step 1: Drop existing views
    console.log('Step 1: Dropping existing views...');
    await prisma.$executeRaw`DROP VIEW IF EXISTS billing_bc_attorney_dashboard CASCADE`;
    await prisma.$executeRaw`DROP VIEW IF EXISTS billing_engagement_financial_summary CASCADE`;
    console.log('✓ Views dropped\n');

    // Step 2: Create financial summary view (C/M level)
    console.log('Step 2: Creating billing_engagement_financial_summary view...');
    await prisma.$executeRaw`
      CREATE OR REPLACE VIEW billing_engagement_financial_summary AS
      SELECT
          cm.cm_id,
          cm.project_id,
          cm.billing_to_date_usd AS billing_usd,
          cm.collected_to_date_usd AS collection_usd,
          cm.billing_credit_usd,
          cm.ubt_usd,
          cm.billing_to_date_cny AS billing_cny,
          cm.collected_to_date_cny AS collection_cny,
          cm.billing_credit_cny,
          cm.ubt_cny,
          COALESCE(ms.agreed_fee_usd, 0)::numeric AS agreed_fee_usd,
          COALESCE(ms.agreed_fee_cny, 0)::numeric AS agreed_fee_cny,
          cm.financials_updated_at AS financials_last_updated_at,
          cm.financials_updated_by AS financials_last_updated_by
      FROM billing_project_cm_no cm
      LEFT JOIN (
          SELECT
              e.cm_id,
              SUM(CASE WHEN m.amount_currency = 'USD' THEN m.amount_value ELSE 0 END) AS agreed_fee_usd,
              SUM(CASE WHEN m.amount_currency = 'CNY' THEN m.amount_value ELSE 0 END) AS agreed_fee_cny
          FROM billing_engagement e
          LEFT JOIN billing_fee_arrangement fa ON fa.engagement_id = e.engagement_id
          LEFT JOIN billing_milestone m ON m.fee_id = fa.fee_id
          GROUP BY e.cm_id
      ) ms ON ms.cm_id = cm.cm_id
    `;
    console.log('✓ billing_engagement_financial_summary created\n');

    // Step 3: Create dashboard view
    console.log('Step 3: Creating billing_bc_attorney_dashboard view...');
    await prisma.$executeRaw`
      CREATE OR REPLACE VIEW billing_bc_attorney_dashboard AS
      SELECT
          bp.project_id,
          bp.project_name,
          bp.client_name,
          bp.attorney_in_charge,
          (
              SELECT string_agg(DISTINCT s2.name, ' & ' ORDER BY s2.name)
              FROM billing_project_bc_attorneys bpba
              JOIN staff s2 ON s2.id = bpba.staff_id
              WHERE bpba.billing_project_id = bp.project_id
          ) AS bc_attorney_name,
          (
              SELECT string_agg(DISTINCT s2.id::text, ', ' ORDER BY s2.id::text)
              FROM billing_project_bc_attorneys bpba
              JOIN staff s2 ON s2.id = bpba.staff_id
              WHERE bpba.billing_project_id = bp.project_id
          ) AS bc_attorney_staff_id,
          (
              SELECT s2.position
              FROM billing_project_bc_attorneys bpba
              JOIN staff s2 ON s2.id = bpba.staff_id
              WHERE bpba.billing_project_id = bp.project_id
              ORDER BY bpba.created_at ASC
              LIMIT 1
          ) AS bc_attorney_position,
          (
              SELECT s2.status
              FROM billing_project_bc_attorneys bpba
              JOIN staff s2 ON s2.id = bpba.staff_id
              WHERE bpba.billing_project_id = bp.project_id
              ORDER BY bpba.created_at ASC
              LIMIT 1
          ) AS bc_attorney_status,
          NULL::boolean AS is_auto_mapped,
          NULL::numeric(3,2) AS match_confidence,
          string_agg(DISTINCT pcm.cm_no, ', ' ORDER BY pcm.cm_no) AS cm_numbers,
          MAX(pcm.status) AS cm_status,
          MIN(pcm.open_date) AS cm_open_date,
          MAX(pcm.closed_date) AS cm_closed_date,
          (
              SELECT fa.raw_text
              FROM billing_fee_arrangement fa
              JOIN billing_engagement e1 ON fa.engagement_id = e1.engagement_id
              JOIN billing_project_cm_no pcm2 ON pcm2.cm_id = e1.cm_id
              WHERE pcm2.project_id = bp.project_id
              LIMIT 1
          ) AS fee_arrangement_text,
          (
              SELECT fa.lsd_date
              FROM billing_fee_arrangement fa
              JOIN billing_engagement e1 ON fa.engagement_id = e1.engagement_id
              JOIN billing_project_cm_no pcm2 ON pcm2.cm_id = e1.cm_id
              WHERE pcm2.project_id = bp.project_id
              LIMIT 1
          ) AS lsd_date,
          MAX(COALESCE(efs.agreed_fee_usd, 0)) AS agreed_fee_usd,
          MAX(COALESCE(efs.billing_usd, 0)) AS billing_usd,
          MAX(COALESCE(efs.collection_usd, 0)) AS collection_usd,
          MAX(COALESCE(efs.billing_credit_usd, 0)) AS billing_credit_usd,
          MAX(COALESCE(efs.ubt_usd, 0)) AS ubt_usd,
          MAX(COALESCE(efs.agreed_fee_cny, 0)) AS agreed_fee_cny,
          MAX(COALESCE(efs.billing_cny, 0)) AS billing_cny,
          MAX(COALESCE(efs.collection_cny, 0)) AS collection_cny,
          MAX(COALESCE(efs.billing_credit_cny, 0)) AS billing_credit_cny,
          MAX(COALESCE(efs.ubt_cny, 0)) AS ubt_cny,
          COUNT(DISTINCT m.milestone_id) AS total_milestones,
          COUNT(DISTINCT m.milestone_id) FILTER (WHERE m.completed) AS completed_milestones,
          bspl.staffing_project_id,
          sp.name AS staffing_project_name,
          sp.status AS staffing_project_status,
          bspl.linked_at,
          MAX(efs.financials_last_updated_at) AS financials_last_updated_at,
          u.username AS financials_last_updated_by_username,
          0 AS bonus_usd
      FROM billing_project bp
      LEFT JOIN billing_project_cm_no pcm ON pcm.project_id = bp.project_id
      LEFT JOIN billing_engagement e ON e.cm_id = pcm.cm_id
      LEFT JOIN billing_fee_arrangement fa ON fa.engagement_id = e.engagement_id
      LEFT JOIN billing_milestone m ON m.engagement_id = e.engagement_id
      LEFT JOIN billing_engagement_financial_summary efs ON efs.cm_id = pcm.cm_id
      LEFT JOIN billing_staffing_project_link bspl ON bspl.billing_project_id = bp.project_id
      LEFT JOIN projects sp ON sp.id = bspl.staffing_project_id
      LEFT JOIN users u ON u.id = (
          SELECT efs2.financials_last_updated_by
          FROM billing_engagement_financial_summary efs2
          WHERE efs2.cm_id = pcm.cm_id
          LIMIT 1
      )
      GROUP BY
          bp.project_id,
          bp.project_name,
          bp.client_name,
          bp.attorney_in_charge,
          bspl.staffing_project_id,
          sp.name,
          sp.status,
          bspl.linked_at,
          u.username
    `;
    console.log('✓ billing_bc_attorney_dashboard created\n');

    console.log('✅ All views recreated successfully!');

  } catch (error: any) {
    console.error('❌ Failed to recreate views:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

recreateViews();
