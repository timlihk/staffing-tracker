#!/usr/bin/env python3
"""
Import financial data from JSON (Billing, Collection, UBT, Billing Credit)
"""

import json
import psycopg2
import os
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:qtSnaaSaelqHVydazTmViwejXbkkZxVY@crossover.proxy.rlwy.net:15782/railway')
JSON_FILE = '/home/timlihk/staffing-tracker/billing-matter/parsed_html/merged_full_plus_milestones.json'

def connect_db():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(DATABASE_URL)

def parse_money(value):
    """Parse money string to float"""
    if not value or value == '-':
        return 0.0
    try:
        return float(str(value).replace(',', ''))
    except:
        return 0.0

def import_financial_data():
    """Import financial data from JSON"""
    print("=" * 80)
    print("Importing Financial Data from JSON")
    print("=" * 80)

    # Read JSON
    with open(JSON_FILE, 'r') as f:
        json_data = json.load(f)

    conn = connect_db()
    cursor = conn.cursor()

    # Skip header rows (first 4 records)
    records = [r for r in json_data[4:] if r.get('2') and r.get('4')]

    print(f"\nTotal records to process: {len(records)}\n")

    updated_count = 0
    skipped_count = 0

    for record in records:
        project_name = record.get('2', '').strip()
        cm_no = record.get('4', '').strip()

        # Parse financial values from JSON
        json_billing = parse_money(record.get('9'))
        json_collection = parse_money(record.get('10'))
        json_billing_credit = parse_money(record.get('11'))
        json_ubt = parse_money(record.get('12'))

        if json_billing == 0 and json_collection == 0 and json_billing_credit == 0 and json_ubt == 0:
            skipped_count += 1
            continue

        # Find engagement by C/M number
        cursor.execute("""
            SELECT e.engagement_id, e.ubt_usd, e.billing_credit_usd
            FROM billing_engagement e
            JOIN billing_project_cm_no pcm ON pcm.cm_id = e.cm_id
            WHERE pcm.cm_no = %s
            LIMIT 1
        """, (cm_no,))

        eng = cursor.fetchone()

        if not eng:
            print(f"⚠️  Engagement not found for C/M: {cm_no} ({project_name})")
            skipped_count += 1
            continue

        engagement_id, current_ubt, current_credit = eng

        # Update financial data
        cursor.execute("""
            UPDATE billing_engagement
            SET
                ubt_usd = %s,
                ubt_cny = 0,
                billing_credit_usd = %s,
                billing_credit_cny = 0,
                financials_last_updated_at = NOW(),
                financials_last_updated_by = NULL
            WHERE engagement_id = %s
        """, (json_ubt, json_billing_credit, engagement_id))

        # Note: billing_usd and collection_usd are calculated from invoices/payments
        # They are in the billing_engagement_financial_summary view, not stored directly
        # For now, we just update UBT and Billing Credit which ARE stored in engagement table

        updated_count += 1

        if updated_count % 20 == 0:
            print(f"  Updated {updated_count} engagements...")

    conn.commit()
    cursor.close()
    conn.close()

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total records processed:  {len(records)}")
    print(f"Engagements updated:      {updated_count}")
    print(f"Skipped (no data):        {skipped_count}")
    print("=" * 80)
    print("\n✅ Financial data import completed")
    print("\nNote: Billing and Collection values are calculated from")
    print("invoices/payments, not directly stored. To import those, you")
    print("would need to create invoice and payment records.")

if __name__ == '__main__':
    import_financial_data()
