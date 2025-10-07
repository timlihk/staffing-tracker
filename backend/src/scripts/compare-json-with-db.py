#!/usr/bin/env python3
"""
Compare JSON data with database and identify inconsistencies
"""

import json
import psycopg2
import os
from decimal import Decimal

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
        # Remove commas and convert
        return float(str(value).replace(',', ''))
    except:
        return 0.0

def compare_data():
    """Compare JSON with database"""
    print("=" * 80)
    print("Comparing JSON Data with Database")
    print("=" * 80)

    # Read JSON
    with open(JSON_FILE, 'r') as f:
        json_data = json.load(f)

    # Connect to database
    conn = connect_db()
    cursor = conn.cursor()

    # Skip header rows (first 4 records)
    records = [r for r in json_data[4:] if r.get('2')]  # Has project name

    print(f"\nTotal records in JSON: {len(records)}")

    inconsistencies = []
    missing_in_db = []
    can_import = []

    for record in records:
        project_name = record.get('2', '').strip()
        cm_no = record.get('4', '').strip()

        if not project_name or not cm_no:
            continue

        # Get data from JSON
        json_client = record.get('3', '').strip()
        json_attorney = record.get('5', '').strip()
        json_sca = record.get('6', '').strip()
        json_fees = parse_money(record.get('7'))
        json_billing = parse_money(record.get('9'))
        json_collection = parse_money(record.get('10'))
        json_billing_credit = parse_money(record.get('11'))
        json_ubt = parse_money(record.get('12'))

        # Check if project exists in database
        cursor.execute("""
            SELECT
                bp.project_id,
                bp.project_name,
                bp.client_name,
                bp.attorney_in_charge,
                bp.sca,
                pcm.cm_no,
                pcm.status,
                e.engagement_id,
                efs.agreed_fee_usd,
                efs.billing_usd,
                efs.collection_usd,
                e.billing_credit_usd,
                e.ubt_usd
            FROM billing_project bp
            LEFT JOIN billing_project_cm_no pcm ON pcm.project_id = bp.project_id
            LEFT JOIN billing_engagement e ON e.cm_id = pcm.cm_id
            LEFT JOIN billing_engagement_financial_summary efs ON efs.engagement_id = e.engagement_id
            WHERE pcm.cm_no = %s
            LIMIT 1
        """, (cm_no,))

        db_row = cursor.fetchone()

        if not db_row:
            missing_in_db.append({
                'project_name': project_name,
                'cm_no': cm_no,
                'client': json_client,
                'attorney': json_attorney,
            })
            continue

        # Unpack database values
        (db_project_id, db_project_name, db_client, db_attorney, db_sca,
         db_cm_no, db_status, db_engagement_id,
         db_agreed_fee, db_billing, db_collection, db_billing_credit, db_ubt) = db_row

        # Compare and find inconsistencies
        issues = []
        importable = {}

        # Client name
        if json_client and not db_client:
            importable['client_name'] = json_client
        elif json_client and db_client and json_client != db_client:
            issues.append(f"Client: JSON='{json_client}' vs DB='{db_client}'")

        # Attorney
        if json_attorney and not db_attorney:
            importable['attorney'] = json_attorney
        elif json_attorney and db_attorney and json_attorney != db_attorney:
            issues.append(f"Attorney: JSON='{json_attorney}' vs DB='{db_attorney}'")

        # SCA
        if json_sca and not db_sca:
            importable['sca'] = json_sca

        # Financial comparisons (allow 1% tolerance)
        def is_different(json_val, db_val):
            if json_val == 0 and db_val is None:
                return False
            if db_val is None:
                db_val = 0
            if json_val == 0 and db_val == 0:
                return False
            diff = abs(float(json_val) - float(db_val))
            avg = (float(json_val) + float(db_val)) / 2
            if avg == 0:
                return diff > 0.01
            return (diff / avg) > 0.01  # More than 1% difference

        # Agreed fees
        if json_fees > 0 and is_different(json_fees, db_agreed_fee):
            issues.append(f"Agreed Fee: JSON=${json_fees:,.2f} vs DB=${float(db_agreed_fee or 0):,.2f}")

        # Billing
        if json_billing > 0 and is_different(json_billing, db_billing):
            issues.append(f"Billing: JSON=${json_billing:,.2f} vs DB=${float(db_billing or 0):,.2f}")

        # Collection
        if json_collection > 0 and is_different(json_collection, db_collection):
            issues.append(f"Collection: JSON=${json_collection:,.2f} vs DB=${float(db_collection or 0):,.2f}")

        # Billing Credit
        if json_billing_credit > 0 and is_different(json_billing_credit, db_billing_credit):
            issues.append(f"Billing Credit: JSON=${json_billing_credit:,.2f} vs DB=${float(db_billing_credit or 0):,.2f}")

        # UBT
        if json_ubt > 0 and is_different(json_ubt, db_ubt):
            issues.append(f"UBT: JSON=${json_ubt:,.2f} vs DB=${float(db_ubt or 0):,.2f}")

        if issues:
            inconsistencies.append({
                'project_name': project_name,
                'cm_no': cm_no,
                'project_id': db_project_id,
                'issues': issues
            })

        if importable:
            can_import.append({
                'project_name': project_name,
                'cm_no': cm_no,
                'project_id': db_project_id,
                'data': importable
            })

    cursor.close()
    conn.close()

    # Print results
    print("\n" + "=" * 80)
    print(f"MISSING IN DATABASE ({len(missing_in_db)} projects)")
    print("=" * 80)
    for item in missing_in_db[:10]:  # Show first 10
        print(f"  {item['cm_no']}: {item['project_name']}")
        if item['client']:
            print(f"    Client: {item['client'][:60]}")
    if len(missing_in_db) > 10:
        print(f"  ... and {len(missing_in_db) - 10} more")

    print("\n" + "=" * 80)
    print(f"INCONSISTENCIES FOUND ({len(inconsistencies)} projects)")
    print("=" * 80)
    for item in inconsistencies[:20]:  # Show first 20
        print(f"\n{item['cm_no']}: {item['project_name']} (ID: {item['project_id']})")
        for issue in item['issues']:
            print(f"  ⚠️  {issue}")
    if len(inconsistencies) > 20:
        print(f"\n... and {len(inconsistencies) - 20} more inconsistencies")

    print("\n" + "=" * 80)
    print(f"CAN IMPORT ({len(can_import)} projects)")
    print("=" * 80)
    for item in can_import[:15]:  # Show first 15
        print(f"\n{item['cm_no']}: {item['project_name']}")
        for key, value in item['data'].items():
            print(f"  + {key}: {value[:60] if isinstance(value, str) else value}")
    if len(can_import) > 15:
        print(f"\n... and {len(can_import) - 15} more")

    # Save to file for frontend highlighting
    output = {
        'missing_in_db': missing_in_db,
        'inconsistencies': inconsistencies,
        'can_import': can_import
    }

    output_file = '/home/timlihk/staffing-tracker/backend/data-comparison-results.json'
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

    print("\n" + "=" * 80)
    print(f"Results saved to: {output_file}")
    print("=" * 80)

    return output

if __name__ == '__main__':
    compare_data()
