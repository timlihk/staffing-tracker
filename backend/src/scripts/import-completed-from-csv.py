#!/usr/bin/env python3
"""
Import completed milestone data from CSV file using C/M numbers as identifiers
"""

import csv
import psycopg2
from datetime import datetime
import os

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:qtSnaaSaelqHVydazTmViwejXbkkZxVY@crossover.proxy.rlwy.net:15782/railway')
CSV_FILE = '/home/timlihk/staffing-tracker/billing-matter/fee_milestones_from_html.csv'

def connect_db():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(DATABASE_URL)

def import_from_csv():
    """Import completed milestones from CSV"""
    conn = connect_db()
    cursor = conn.cursor()

    completion_date = datetime.now()
    completion_source = 'csv_import'

    print("=" * 80)
    print("Importing Completed Milestones from CSV")
    print("=" * 80)
    print(f"Source: {CSV_FILE}\n")

    # Read CSV file
    completed_milestones = []

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row_num, row in enumerate(reader, start=2):  # Start at 2 to account for header
            achieved = (row.get('Achieved_by_strike') or '').strip()

            if achieved == 'True':
                cm_no = (row.get('C/M No') or '').strip()
                milestone_ordinal = (row.get('Milestone_ordinal') or '').strip()

                if cm_no and milestone_ordinal:
                    completed_milestones.append({
                        'row_num': row_num,
                        'cm_no': cm_no,
                        'ordinal': milestone_ordinal,
                        'project_name': (row.get('Project Name') or '').strip(),
                    })

    print(f"Found {len(completed_milestones)} completed milestones in CSV\n")

    # Process each milestone
    total_updated = 0
    total_not_found = 0
    total_already_completed = 0

    for item in completed_milestones:
        cm_no = item['cm_no']
        ordinal_raw = item['ordinal']
        row_num = item['row_num']
        project_name = item['project_name']

        # Convert ordinal to match database format (add parentheses if not present)
        if ordinal_raw and not ordinal_raw.startswith('('):
            ordinal = f'({ordinal_raw})'
        else:
            ordinal = ordinal_raw

        # Find project by C/M number
        cursor.execute("""
            SELECT bp.project_id, bp.project_name
            FROM billing_project bp
            JOIN billing_project_cm_no pcm ON pcm.project_id = bp.project_id
            WHERE pcm.cm_no = %s
            LIMIT 1
        """, (cm_no,))

        project = cursor.fetchone()

        if not project:
            print(f"Row {row_num}: ⚠️  Project not found for C/M No: {cm_no} ({project_name})")
            total_not_found += 1
            continue

        project_id, db_project_name = project

        # Update milestone
        cursor.execute("""
            UPDATE billing_milestone
            SET
                completed = TRUE,
                completion_date = %s,
                completion_source = %s
            WHERE fee_id IN (
                SELECT bfa.fee_id
                FROM billing_fee_arrangement bfa
                JOIN billing_engagement be ON be.engagement_id = bfa.engagement_id
                WHERE be.project_id = %s
            )
            AND ordinal = %s
            AND completed = FALSE
        """, (completion_date, completion_source, project_id, ordinal))

        updated_count = cursor.rowcount

        if updated_count > 0:
            total_updated += updated_count
        else:
            # Check if already completed
            cursor.execute("""
                SELECT COUNT(*)
                FROM billing_milestone
                WHERE fee_id IN (
                    SELECT bfa.fee_id
                    FROM billing_fee_arrangement bfa
                    JOIN billing_engagement be ON be.engagement_id = bfa.engagement_id
                    WHERE be.project_id = %s
                )
                AND ordinal = %s
                AND completed = TRUE
            """, (project_id, ordinal))

            already_completed = cursor.fetchone()[0]

            if already_completed > 0:
                total_already_completed += 1
            else:
                print(f"Row {row_num}: ⚠️  Milestone {ordinal} not found for {db_project_name} (C/M: {cm_no})")
                total_not_found += 1

    # Commit changes
    conn.commit()
    cursor.close()
    conn.close()

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total milestones in CSV:       {len(completed_milestones)}")
    print(f"Successfully marked completed: {total_updated}")
    print(f"Already completed:             {total_already_completed}")
    print(f"Not found:                     {total_not_found}")
    print("=" * 80)

    return total_updated

if __name__ == '__main__':
    import_from_csv()
    print("\n✅ Script completed successfully")
