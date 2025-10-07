#!/usr/bin/env python3
"""
Import finance data (billed, collected, amount) from CSV file
"""

import csv
import psycopg2
import json
import os
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:qtSnaaSaelqHVydazTmViwejXbkkZxVY@crossover.proxy.rlwy.net:15782/railway')
CSV_FILE = '/home/timlihk/staffing-tracker/billing-matter/fee_milestones_with_finance.csv'

def connect_db():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(DATABASE_URL)

def parse_finance_events(finance_json_str):
    """
    Parse Finance_Events_JSON to extract billing and collection dates
    Returns: (billed_date, collected_date, total_amount)
    """
    if not finance_json_str or finance_json_str.strip() == '':
        return None, None, None

    try:
        events = json.loads(finance_json_str)

        # Find events with status "billed" and valid dates/amounts
        billed_dates = []
        collected_dates = []
        amounts = []

        for event in events:
            if event.get('status') == 'billed':
                dates = event.get('dates', [])
                amount = event.get('amount')

                # dates[0] is billed date, dates[1] is collected date
                if len(dates) >= 1 and dates[0]:
                    billed_dates.append(dates[0])
                if len(dates) >= 2 and dates[1]:
                    collected_dates.append(dates[1])

                # Track amounts that are valid numbers
                if amount and isinstance(amount, (int, float)) and amount > 100:
                    amounts.append(amount)

        # Use earliest billed date and latest collected date
        earliest_billed = min(billed_dates) if billed_dates else None
        latest_collected = max(collected_dates) if collected_dates else None
        total_amount = sum(amounts) if amounts else None

        return earliest_billed, latest_collected, total_amount

    except json.JSONDecodeError:
        return None, None, None

def import_finance_data():
    """Import finance data from CSV"""
    conn = connect_db()
    cursor = conn.cursor()

    print("=" * 80)
    print("Importing Finance Data from CSV")
    print("=" * 80)
    print(f"Source: {CSV_FILE}\n")

    # Read CSV file
    finance_data = []

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row_num, row in enumerate(reader, start=2):
            cm_no = (row.get('C/M No') or '').strip()
            ordinal = (row.get('Milestone_ordinal') or '').strip()
            amount_value = (row.get('Amount_value') or '').strip()
            amount_currency = (row.get('Amount_currency') or 'USD').strip()
            finance_json = row.get('Finance_Events_JSON', '')

            # Parse finance events
            billed_date, collected_date, parsed_amount = parse_finance_events(finance_json)

            # Use parsed amount if available and CSV amount is invalid
            try:
                amount = float(amount_value) if amount_value else None
            except ValueError:
                amount = None

            # Prefer parsed amount if CSV amount is missing or very small
            if parsed_amount and (not amount or amount < 100):
                amount = parsed_amount

            if cm_no and ordinal:
                # Add parentheses to ordinal if needed
                if not ordinal.startswith('('):
                    ordinal_formatted = f'({ordinal})'
                else:
                    ordinal_formatted = ordinal

                finance_data.append({
                    'row_num': row_num,
                    'cm_no': cm_no,
                    'ordinal': ordinal_formatted,
                    'amount_value': amount,
                    'amount_currency': amount_currency,
                    'billed_date': billed_date,
                    'collected_date': collected_date,
                })

    print(f"Found {len(finance_data)} milestone finance records in CSV\n")

    # Process each milestone
    total_updated = 0
    total_not_found = 0
    total_amount_updated = 0
    total_billed_updated = 0
    total_collected_updated = 0

    for item in finance_data:
        cm_no = item['cm_no']
        ordinal = item['ordinal']
        amount_value = item['amount_value']
        amount_currency = item['amount_currency']
        billed_date = item['billed_date']
        collected_date = item['collected_date']

        # Find milestone by C/M number and ordinal
        cursor.execute("""
            SELECT bm.milestone_id, bm.amount_value, bm.invoice_sent_date, bm.payment_received_date
            FROM billing_milestone bm
            JOIN billing_engagement be ON be.engagement_id = bm.engagement_id
            JOIN billing_project_cm_no pcm ON pcm.cm_id = be.cm_id
            WHERE pcm.cm_no = %s
            AND bm.ordinal = %s
            LIMIT 1
        """, (cm_no, ordinal))

        milestone = cursor.fetchone()

        if not milestone:
            total_not_found += 1
            continue

        milestone_id, current_amount, current_billed, current_collected = milestone

        # Prepare update fields
        updates = []
        params = []

        # Update amount if provided and different
        if amount_value and amount_value != current_amount:
            updates.append("amount_value = %s")
            params.append(amount_value)
            updates.append("amount_currency = %s")
            params.append(amount_currency)
            total_amount_updated += 1

        # Update billed date if provided
        if billed_date and not current_billed:
            updates.append("invoice_sent_date = %s")
            params.append(billed_date)
            total_billed_updated += 1

        # Update collected date if provided
        if collected_date and not current_collected:
            updates.append("payment_received_date = %s")
            params.append(collected_date)
            total_collected_updated += 1

        # Execute update if there are changes
        if updates:
            params.append(milestone_id)
            update_sql = f"""
                UPDATE billing_milestone
                SET {', '.join(updates)}
                WHERE milestone_id = %s
            """
            cursor.execute(update_sql, params)
            total_updated += 1

    # Commit changes
    conn.commit()
    cursor.close()
    conn.close()

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total finance records in CSV:  {len(finance_data)}")
    print(f"Milestones updated:            {total_updated}")
    print(f"  - Amount updated:            {total_amount_updated}")
    print(f"  - Billed date added:         {total_billed_updated}")
    print(f"  - Collected date added:      {total_collected_updated}")
    print(f"Milestones not found:          {total_not_found}")
    print("=" * 80)

    return total_updated

if __name__ == '__main__':
    import_finance_data()
    print("\n✅ Script completed successfully")
