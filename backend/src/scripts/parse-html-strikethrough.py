#!/usr/bin/env python3
"""
Parse HTML file to detect strikethrough formatting in Fee Arrangement column
and mark corresponding milestones as completed in the database.
"""

from bs4 import BeautifulSoup
import psycopg2
from datetime import datetime
import os
import re

# Database connection
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:qtSnaaSaelqHVydazTmViwejXbkkZxVY@crossover.proxy.rlwy.net:15782/railway')

# HTML file path
HTML_FILE = '/home/timlihk/staffing-tracker/billing-matter/test.htm'

def connect_db():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(DATABASE_URL)

def extract_milestone_identifier(text):
    """
    Extract milestone identifier from text (e.g., '(a)', '(b)', '(c)')
    """
    match = re.search(r'\(([a-z])\)', text, re.IGNORECASE)
    return match.group(1).lower() if match else None

def parse_html_for_strikethroughs():
    """
    Parse HTML file to find strikethrough text in table cells
    Returns dict mapping project_name -> list of strikethrough milestone identifiers
    """
    print(f"Loading HTML file: {HTML_FILE}", flush=True)

    with open(HTML_FILE, 'r', encoding='windows-1252') as f:
        html_content = f.read()

    print("Parsing HTML...", flush=True)
    soup = BeautifulSoup(html_content, 'lxml')

    # Find all tables
    tables = soup.find_all('table')
    print(f"Found {len(tables)} tables", flush=True)

    # Use the first/only table
    if not tables:
        print("ERROR: No tables found in HTML", flush=True)
        return {}

    main_table = tables[0]
    print(f"Using first table for processing", flush=True)

    # Find all rows
    rows = main_table.find_all('tr')
    print(f"Found {len(rows)} rows in table", flush=True)

    # Based on the actual HTML structure (row 3 is header):
    # Column 0: blank
    # Column 1: No.
    # Column 2: Project Name
    # Column 3: Client Name
    # Column 4: C/M No
    # Column 5: Attorney in Charge
    # Column 6: SCA
    # Column 7: Fees (US$)
    # Column 8: Fee arrangement (where strikethrough is)
    # Column 9: Billing (US$)
    # etc.

    HEADER_ROW = 3
    PROJECT_NAME_COL = 2  # Index 2 for project name
    CM_NO_COL = 4  # Index 4 for C/M No
    FEE_ARRANGEMENT_COL = 8  # Index 8 for fee arrangement

    print(f"\nAssuming column indices:", flush=True)
    print(f"  Project Name: column {PROJECT_NAME_COL}", flush=True)
    print(f"  C/M No: column {CM_NO_COL}", flush=True)
    print(f"  Fee Arrangement: column {FEE_ARRANGEMENT_COL}", flush=True)

    # Parse all data rows (skip header rows 0-3)
    completed_milestones = {}

    for row_idx in range(HEADER_ROW + 1, len(rows)):
        row = rows[row_idx]
        cells = row.find_all(['td', 'th'])

        if len(cells) <= FEE_ARRANGEMENT_COL:
            continue

        # Get project name (column 1)
        project_name = cells[PROJECT_NAME_COL].get_text(strip=True)

        if not project_name or len(project_name) < 2:
            continue

        # Get CM number (column 3)
        cm_no = cells[CM_NO_COL].get_text(strip=True) if CM_NO_COL < len(cells) else None

        # Get fee arrangement cell (column 7)
        fee_cell = cells[FEE_ARRANGEMENT_COL]

        # Find all <s> tags (strikethrough) in fee cell
        strikethrough_elements = fee_cell.find_all(['s', 'strike'])

        # Also check for spans with text-decoration:line-through
        for span in fee_cell.find_all('span', style=True):
            if 'text-decoration:line-through' in span.get('style', ''):
                strikethrough_elements.append(span)

        if strikethrough_elements:
            print(f"\n=== Row {row_idx}: {project_name} (C/M: {cm_no}) ===", flush=True)
            print(f"Found {len(strikethrough_elements)} strikethrough elements", flush=True)

            milestone_ids = set()
            for elem in strikethrough_elements:
                text = elem.get_text(strip=True)
                if text:
                    # Extract milestone identifier
                    milestone_id = extract_milestone_identifier(text)
                    if milestone_id:
                        milestone_ids.add(milestone_id)

            if milestone_ids:
                print(f"  Completed milestones: {sorted(milestone_ids)}", flush=True)
                completed_milestones[project_name] = {
                    'milestones': list(milestone_ids),
                    'cm_no': cm_no
                }

    return completed_milestones

def update_database(completed_milestones):
    """
    Update database to mark milestones as completed
    """
    if not completed_milestones:
        print("\nNo completed milestones found with strikethrough formatting", flush=True)
        return

    conn = connect_db()
    cursor = conn.cursor()

    completion_date = datetime.now()
    completion_source = 'html_strikethrough'

    print(f"\n=== Updating Database ===", flush=True)
    print(f"Found {len(completed_milestones)} projects with completed milestones", flush=True)

    total_updated = 0

    for project_name, data in completed_milestones.items():
        milestone_ids = data['milestones']
        cm_no = data['cm_no']

        print(f"\nProject: {project_name}", flush=True)
        print(f"  C/M No: {cm_no}", flush=True)
        print(f"  Completed milestones: {milestone_ids}", flush=True)

        # Find project in database
        cursor.execute("""
            SELECT bp.project_id, bp.project_name
            FROM billing_project bp
            WHERE bp.project_name = %s
            LIMIT 1
        """, (project_name,))

        project = cursor.fetchone()

        if not project:
            print(f"  ⚠️  Project not found in database", flush=True)
            continue

        project_id = project[0]

        # Update each milestone
        for milestone_ordinal in milestone_ids:
            # milestone_ordinal is just 'a', 'b', 'c' - need to match against ordinal column which is '(a)', '(b)', etc.
            ordinal_value = f'({milestone_ordinal})'

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
            """, (completion_date, completion_source, project_id, ordinal_value))

            updated_count = cursor.rowcount

            if updated_count > 0:
                print(f"  ✅ Marked milestone {ordinal_value} as completed", flush=True)
                total_updated += updated_count
            else:
                print(f"  ⚠️  Milestone {ordinal_value} not found or already completed", flush=True)

    conn.commit()
    cursor.close()
    conn.close()

    print(f"\n=== Summary ===", flush=True)
    print(f"Total milestones marked as completed: {total_updated}", flush=True)

def main():
    """Main function"""
    print("=" * 60, flush=True)
    print("Parsing HTML for Strikethrough Milestones", flush=True)
    print("=" * 60, flush=True)

    # Parse HTML file
    completed_milestones = parse_html_for_strikethroughs()

    # Update database
    update_database(completed_milestones)

    print("\n✅ Script completed successfully", flush=True)

if __name__ == '__main__':
    main()
