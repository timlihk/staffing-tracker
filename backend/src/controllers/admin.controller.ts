/**
 * Admin Controller
 * Handles administrative operations like database migrations
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * POST /api/admin/recreate-billing-views
 * Recreates billing dashboard views with latest schema
 * Requires admin role
 */
export async function recreateBillingViews(req: AuthRequest, res: Response) {
  try {
    const authUser = req.user;

    if (authUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    logger.info('Starting billing views recreation');

    // Step 1: Drop existing views
    logger.info('Dropping existing views');
    await prisma.$executeRaw`DROP VIEW IF EXISTS billing_bc_attorney_dashboard CASCADE`;
    await prisma.$executeRaw`DROP VIEW IF EXISTS billing_engagement_financial_summary CASCADE`;

    // Step 2: Create billing_engagement_financial_summary view
    logger.info('Creating billing_engagement_financial_summary view');
    await prisma.$executeRaw`
      CREATE VIEW billing_engagement_financial_summary AS
      SELECT
        e.cm_id,
        SUM(e.agreed_fee_usd) AS agreed_fee_usd,
        SUM(e.agreed_fee_cny) AS agreed_fee_cny,
        SUM(e.billing_usd) AS billing_usd,
        SUM(e.billing_cny) AS billing_cny,
        SUM(e.collection_usd) AS collection_usd,
        SUM(e.collection_cny) AS collection_cny,
        SUM(e.billing_credit_usd) AS billing_credit_usd,
        SUM(e.billing_credit_cny) AS billing_credit_cny,
        SUM(e.ubt_usd) AS ubt_usd,
        SUM(e.ubt_cny) AS ubt_cny,
        MAX(e.financials_last_updated_at) AS financials_last_updated_at,
        MAX(e.financials_last_updated_by) AS financials_last_updated_by
      FROM billing_engagement e
      GROUP BY e.cm_id
    `;

    // Step 3: Create billing_bc_attorney_dashboard view
    logger.info('Creating billing_bc_attorney_dashboard view');
    await prisma.$executeRaw`
      CREATE VIEW billing_bc_attorney_dashboard AS
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
      ORDER BY bp.project_name
    `;

    logger.info('All views recreated successfully');

    res.json({
      success: true,
      message: 'Billing views recreated successfully',
      views: [
        'billing_engagement_financial_summary',
        'billing_bc_attorney_dashboard'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error recreating billing views', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to recreate billing views',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/admin/update-billing-financials
 * Updates billing financials from Excel file
 * Requires admin role
 */
export async function updateBillingFinancials(req: AuthRequest, res: Response) {
  try {
    const authUser = req.user;

    if (authUser?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    logger.info('Starting billing financials update from Excel');

    // Dynamic import for xlsx (ESM module)
    const XLSX = await import('xlsx');
    
    const filePath = './HKCM Project List (2026.02.12).xlsx';
    
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['Transactions'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    // Find column indices
    const headers = data[3];
    const colIndex: Record<string, number> = {};
    headers.forEach((header: any, idx: number) => {
      if (header) {
        const headerStr = String(header).trim();
        if (headerStr.includes('C/M No')) colIndex['cmNo'] = idx;
        else if (headerStr.includes('Fees (US$)')) colIndex['feesUsd'] = idx;
        else if (headerStr.includes('Billing \r\n(US$)') || headerStr.includes('Billing (US$)')) colIndex['billingUsd'] = idx;
        else if (headerStr.includes('Collection \r\n(US$)') || headerStr.includes('Collection (US$)')) colIndex['collectionUsd'] = idx;
        else if (headerStr.includes('Billing Credit \r\n(US$)') || headerStr.includes('Billing Credit (US$)')) colIndex['billingCreditUsd'] = idx;
        else if (headerStr.includes('UBT') && headerStr.includes('US$')) colIndex['ubtUsd'] = idx;
      }
    });

    // Parse rows
    const excelMap = new Map<string, any>();
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      const maybeNo = row[1];
      if (typeof maybeNo !== 'number') continue;
      
      const cmNo = colIndex['cmNo'] !== undefined ? row[colIndex['cmNo']] : null;
      if (!cmNo || String(cmNo).trim() === '') continue;
      
      const parseAmount = (val: any): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const cleaned = val.replace(/[,$?\s]/g, '');
          return isNaN(parseFloat(cleaned)) ? 0 : parseFloat(cleaned);
        }
        return 0;
      };

      excelMap.set(String(cmNo).trim(), {
        billingUsd: colIndex['billingUsd'] !== undefined ? parseAmount(row[colIndex['billingUsd']]) : 0,
        feesUsd: colIndex['feesUsd'] !== undefined ? parseAmount(row[colIndex['feesUsd']]) : 0,
        collectionUsd: colIndex['collectionUsd'] !== undefined ? parseAmount(row[colIndex['collectionUsd']]) : 0,
        billingCreditUsd: colIndex['billingCreditUsd'] !== undefined ? parseAmount(row[colIndex['billingCreditUsd']]) : 0,
        ubtUsd: colIndex['ubtUsd'] !== undefined ? parseAmount(row[colIndex['ubtUsd']]) : 0,
      });
    }

    logger.info(`Parsed ${excelMap.size} rows from Excel`);

    // Get all CM numbers from database
    const allCmNos = await prisma.billing_project_cm_no.findMany({
      select: { cm_id: true, cm_no: true }
    });

    let matchedCount = 0;
    let updatedCount = 0;

    for (const cmRecord of allCmNos) {
      const cmNo = cmRecord.cm_no.trim();
      const excelData = excelMap.get(cmNo);

      if (excelData) {
        matchedCount++;
        const updateData: any = { financials_updated_at: new Date() };
        
        const billingValue = excelData.billingUsd || excelData.feesUsd;
        if (billingValue > 0) updateData.billing_to_date_usd = billingValue;
        if (excelData.collectionUsd > 0) updateData.collected_to_date_usd = excelData.collectionUsd;
        if (excelData.billingCreditUsd > 0) updateData.billing_credit_usd = excelData.billingCreditUsd;
        if (excelData.ubtUsd > 0) updateData.ubt_usd = excelData.ubtUsd;

        if (Object.keys(updateData).length > 1) {
          await prisma.billing_project_cm_no.update({
            where: { cm_id: cmRecord.cm_id },
            data: updateData
          });
          updatedCount++;
        }
      }
    }

    logger.info(`Billing financials update complete: ${matchedCount} matched, ${updatedCount} updated`);

    res.json({
      success: true,
      matched: matchedCount,
      updated: updatedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating billing financials:', error);
    res.status(500).json({ error: 'Failed to update billing financials' });
  }
}
