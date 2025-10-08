#!/usr/bin/env python3
"""
Compare HTML parsing results with CSV reference data
"""

import csv
import psycopg2
import os
from collections import defaultdict

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:qtSnaaSaelqHVydazTmViwejXbkkZxVY@crossover.proxy.rlwy.net:15782/railway')
CSV_FILE = '/home/timlihk/staffing-tracker/billing-matter/fee_milestones_from_html.csv'

def parse_csv():
    """Parse CSV file to get completed milestones"""
    completed_from_csv = defaultdict(set)

    print("Parsing CSV file...")
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            achieved = row.get('Achieved_by_strike', '') or ''
            achieved = achieved.strip()

            if achieved == 'True':
                project_name = (row.get('Project Name') or '').strip()
                cm_no = (row.get('C/M No') or '').strip()
                milestone_ordinal = (row.get('Milestone_ordinal') or '').strip()

                # Create key for grouping
                key = f"{project_name}|{cm_no}" if project_name or cm_no else None

                if key and milestone_ordinal:
                    completed_from_csv[key].add(milestone_ordinal.lower())

    return completed_from_csv

def get_db_completed():
    """Get completed milestones from database"""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            bp.project_name,
            pcm.cm_no,
            bm.ordinal,
            bm.completion_source
        FROM billing_milestone bm
        JOIN billing_fee_arrangement bfa ON bfa.fee_id = bm.fee_id
        JOIN billing_engagement be ON be.engagement_id = bfa.engagement_id
        JOIN billing_project bp ON bp.project_id = be.project_id
        LEFT JOIN billing_project_cm_no pcm ON pcm.project_id = bp.project_id AND pcm.is_primary = TRUE
        WHERE bm.completed = TRUE
        ORDER BY bp.project_name, bm.ordinal
    """)

    completed_from_db = defaultdict(set)

    for row in cursor.fetchall():
        project_name, cm_no, ordinal, source = row
        project_name = project_name.strip() if project_name else ""
        cm_no = cm_no.strip() if cm_no else ""

        # Remove parentheses from ordinal (a) -> a
        if ordinal:
            ordinal_clean = ordinal.strip('()').lower()
        else:
            ordinal_clean = ""

        key = f"{project_name}|{cm_no}"
        if ordinal_clean:
            completed_from_db[key].add(ordinal_clean)

    cursor.close()
    conn.close()

    return completed_from_db

def compare_results():
    """Compare CSV and DB results"""
    csv_completed = parse_csv()
    db_completed = get_db_completed()

    print(f"\n{'='*80}")
    print(f"COMPARISON RESULTS")
    print(f"{'='*80}\n")

    print(f"CSV Reference Data:")
    print(f"  Total projects with completed milestones: {len(csv_completed)}")
    total_csv_milestones = sum(len(milestones) for milestones in csv_completed.values())
    print(f"  Total completed milestones: {total_csv_milestones}\n")

    print(f"Database (HTML Parsing):")
    print(f"  Total projects with completed milestones: {len(db_completed)}")
    total_db_milestones = sum(len(milestones) for milestones in db_completed.values())
    print(f"  Total completed milestones: {total_db_milestones}\n")

    # Find missing from DB
    print(f"{'='*80}")
    print(f"MISSING FROM DATABASE (Should be marked as completed but aren't):")
    print(f"{'='*80}\n")

    missing_count = 0
    for key, csv_milestones in sorted(csv_completed.items()):
        db_milestones = db_completed.get(key, set())
        missing = csv_milestones - db_milestones

        if missing:
            project_name, cm_no = key.split('|')
            print(f"Project: {project_name or '(no name)'}")
            print(f"  C/M No: {cm_no or '(no CM)'}")
            print(f"  Missing milestones: {sorted(missing)}")
            print(f"  CSV has: {sorted(csv_milestones)}")
            print(f"  DB has: {sorted(db_milestones)}")
            print()
            missing_count += len(missing)

    print(f"Total missing milestones: {missing_count}\n")

    # Find extras in DB
    print(f"{'='*80}")
    print(f"EXTRA IN DATABASE (Marked completed but not in CSV):")
    print(f"{'='*80}\n")

    extra_count = 0
    for key, db_milestones in sorted(db_completed.items()):
        csv_milestones = csv_completed.get(key, set())
        extras = db_milestones - csv_milestones

        if extras:
            project_name, cm_no = key.split('|')
            print(f"Project: {project_name or '(no name)'}")
            print(f"  C/M No: {cm_no or '(no CM)'}")
            print(f"  Extra milestones: {sorted(extras)}")
            print(f"  DB has: {sorted(db_milestones)}")
            print(f"  CSV has: {sorted(csv_milestones)}")
            print()
            extra_count += len(extras)

    print(f"Total extra milestones: {extra_count}\n")

    # Find perfect matches
    perfect_matches = 0
    for key in csv_completed.keys():
        if key in db_completed and csv_completed[key] == db_completed[key]:
            perfect_matches += 1

    print(f"{'='*80}")
    print(f"SUMMARY:")
    print(f"{'='*80}")
    print(f"Perfect matches: {perfect_matches} projects")
    print(f"Missing from DB: {missing_count} milestones")
    print(f"Extra in DB: {extra_count} milestones")
    print(f"Accuracy: {total_db_milestones - extra_count + missing_count}/{total_csv_milestones} = {((total_db_milestones - extra_count) / total_csv_milestones * 100):.1f}%")

if __name__ == '__main__':
    compare_results()
