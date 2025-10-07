#!/usr/bin/env python3
"""
Import Billing, Collection, and Finance Comment data from JSON
"""
import json
import psycopg2
import os
from datetime import datetime
import hashlib
import re

def parse_money(value):
    """Parse money string to float"""
    if not value or value == '-' or value == '':
        return 0.0
    # Remove commas and convert to float
    try:
        return float(str(value).replace(',', ''))
    except (ValueError, AttributeError):
        return 0.0

def create_fingerprint(text):
    """Create fingerprint hash for comment"""
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def main():
    # Database connection
    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Load JSON data
    json_path = '/home/timlihk/staffing-tracker/billing-matter/parsed_html/merged_full_plus_milestones.json'
    with open(json_path, 'r') as f:
        data = json.load(f)

    print("=" * 80)
    print("Importing Billing, Collection, and Finance Comment Data")
    print("=" * 80)

    # Skip first 3 rows (header rows)
    imported_billing = 0
    imported_collection = 0
    imported_comments = 0
    skipped = 0

    for i, record in enumerate(data[3:], start=3):
        project_name = record.get('2', '').strip()
        if not project_name:
            continue

        # Get financial values
        billing_usd_str = record.get('9', '')
        collection_usd_str = record.get('10', '')
        finance_comment = record.get('16', '').strip()
        remarks = record.get('13', '').strip()
        cm_no = record.get('4', '').strip()

        billing_usd = parse_money(billing_usd_str)
        collection_usd = parse_money(collection_usd_str)

        # Normalize project name (remove extra spaces)
        normalized_name = ' '.join(project_name.split())

        # Try exact match first
        cur.execute("""
            SELECT e.engagement_id, e.project_id, p.project_name
            FROM billing_engagement e
            JOIN billing_project p ON e.project_id = p.project_id
            WHERE LOWER(REGEXP_REPLACE(p.project_name, '\\s+', ' ', 'g')) = LOWER(%s)
            LIMIT 1
        """, (normalized_name,))

        result = cur.fetchone()

        # If not found, try fuzzy match (remove suffixes like "- supplemental", "- RMB", etc.)
        if not result:
            base_name = normalized_name.split(' - ')[0].strip()
            cur.execute("""
                SELECT e.engagement_id, e.project_id, p.project_name
                FROM billing_engagement e
                JOIN billing_project p ON e.project_id = p.project_id
                WHERE LOWER(REGEXP_REPLACE(p.project_name, '\\s+', ' ', 'g')) LIKE LOWER(%s)
                ORDER BY LENGTH(p.project_name) ASC
                LIMIT 1
            """, (base_name + '%',))
            result = cur.fetchone()

        if not result:
            print(f"⚠️  Project not found: {project_name}")
            skipped += 1
            continue

        engagement_id, project_id, db_project_name = result

        # Import invoice (billing) if amount > 0
        if billing_usd > 0:
            try:
                cur.execute("""
                    INSERT INTO billing_invoice
                    (engagement_id, invoice_no, amount_value, amount_currency, status, notes)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (engagement_id, invoice_no) DO UPDATE
                    SET amount_value = EXCLUDED.amount_value,
                        updated_at = NOW()
                    RETURNING invoice_id
                """, (
                    engagement_id,
                    f'TOTAL-{engagement_id}',
                    billing_usd,
                    'USD',
                    'issued',
                    f'Total billing from source data. {remarks}' if remarks else 'Total billing from source data'
                ))
                invoice_id = cur.fetchone()[0]

                # If collection > 0, create payment (check for duplicates first)
                if collection_usd > 0:
                    # Check if payment already exists for this invoice
                    cur.execute("""
                        SELECT payment_id FROM billing_payment
                        WHERE invoice_id = %s AND paid_amount_value = %s AND paid_amount_currency = %s
                    """, (invoice_id, collection_usd, 'USD'))

                    if not cur.fetchone():
                        cur.execute("""
                            INSERT INTO billing_payment
                            (invoice_id, paid_amount_value, paid_amount_currency, paid_date)
                            VALUES (%s, %s, %s, %s)
                        """, (
                            invoice_id,
                            collection_usd,
                            'USD',
                            None  # No specific date from source
                        ))
                        if cur.rowcount > 0:
                            imported_collection += 1

                imported_billing += 1

            except Exception as e:
                print(f"⚠️  Error importing billing for {project_name}: {e}")
                conn.rollback()
                continue

        # Import finance comment if exists
        if finance_comment:
            try:
                fingerprint = create_fingerprint(finance_comment)
                cur.execute("""
                    INSERT INTO billing_finance_comment
                    (engagement_id, comment_raw, fingerprint_hash)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (engagement_id, fingerprint_hash) DO NOTHING
                """, (engagement_id, finance_comment, fingerprint))

                if cur.rowcount > 0:
                    imported_comments += 1

            except Exception as e:
                print(f"⚠️  Error importing comment for {project_name}: {e}")
                conn.rollback()
                continue

        conn.commit()

    print(f"\n✓ Imported {imported_billing} billing records (invoices)")
    print(f"✓ Imported {imported_collection} collection records (payments)")
    print(f"✓ Imported {imported_comments} finance comments")
    print(f"⚠️  Skipped {skipped} records (project not found in DB)")
    print("=" * 80)

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
