#!/usr/bin/env python3
"""
Fix all milestone issues:
1. Fix years as amounts (2021, 2022, etc.)
2. Extract amounts from descriptions with numbers
3. Fix all NULL amounts where possible
"""

import os
import re
import psycopg2

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:qtSnaaSaelqHVydazTmViwejXbkkZxVY@crossover.proxy.rlwy.net:15782/railway",
)


def extract_amount_from_description(description):
    """Extract amount from milestone description"""
    if not description:
        return None
    
    # Clean text
    text = description.replace(',', '').replace('，', '')
    
    # Pattern 1: Look for amount after dash/hyphen: - 100,000
    match = re.search(r'[-–—]\s*([\d]{4,}(?:\.\d{2})?)', text)
    if match:
        amount = float(match.group(1))
        # Validate: not a year
        if 1000 <= amount <= 10000000 and not (2020 <= amount <= 2030):
            return amount
    
    # Pattern 2: Look for amount before currency indicators
    match = re.search(r'([\d]{4,}(?:\.\d{2})?)\s*(?:USD|美元|美金|CNY|RMB|人民币)', text)
    if match:
        amount = float(match.group(1))
        if 1000 <= amount <= 10000000 and not (2020 <= amount <= 2030):
            return amount
    
    # Pattern 3: Look for large numbers (5+ digits)
    matches = re.findall(r'\b([\d]{5,})\b', text)
    for m in matches:
        amount = float(m)
        if 1000 <= amount <= 10000000 and not (2020 <= amount <= 2030):
            return amount
    
    return None


def main():
    print("="*80)
    print("🔧 FIXING ALL MILESTONE ISSUES")
    print("="*80)
    
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()
    
    stats = {
        'years_fixed': 0,
        'null_fixed': 0,
        'null_total': 0,
        'checked': 0
    }
    
    # Fix 1: Years as amounts
    print("\n1. Fixing milestones with years as amounts...")
    cur.execute("""
        SELECT milestone_id, ordinal, description, amount_value
        FROM billing_milestone
        WHERE amount_value IN (2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030)
    """)
    
    years_rows = cur.fetchall()
    print(f"   Found {len(years_rows)} milestones with years as amounts")
    
    for row in years_rows:
        milestone_id, ordinal, description, wrong_amount = row
        
        # Extract correct amount from description
        correct_amount = extract_amount_from_description(description)
        
        if correct_amount:
            cur.execute("""
                UPDATE billing_milestone 
                SET amount_value = %s, updated_at = NOW()
                WHERE milestone_id = %s
            """, (correct_amount, milestone_id))
            stats['years_fixed'] += 1
            if stats['years_fixed'] <= 3:
                print(f"   Fixed: {ordinal} {wrong_amount:.0f} -> {correct_amount:,.0f}")
    
    conn.commit()
    print(f"   Fixed {stats['years_fixed']} milestones")
    
    # Fix 2: NULL amounts
    print("\n2. Fixing milestones with NULL amounts...")
    cur.execute("""
        SELECT milestone_id, ordinal, description, amount_value
        FROM billing_milestone
        WHERE amount_value IS NULL
        AND description IS NOT NULL
        AND description != ''
    """)
    
    null_rows = cur.fetchall()
    stats['null_total'] = len(null_rows)
    print(f"   Found {stats['null_total']} milestones with NULL amounts")
    
    batch_count = 0
    for row in null_rows:
        milestone_id, ordinal, description, current_amount = row
        stats['checked'] += 1
        
        # Try to extract amount
        amount = extract_amount_from_description(description)
        
        if amount:
            cur.execute("""
                UPDATE billing_milestone 
                SET amount_value = %s, updated_at = NOW()
                WHERE milestone_id = %s
            """, (amount, milestone_id))
            stats['null_fixed'] += 1
            batch_count += 1
            
            if stats['null_fixed'] <= 3:
                print(f"   Fixed: {ordinal} NULL -> {amount:,.0f}")
        
        # Commit every 50
        if batch_count >= 50:
            conn.commit()
            batch_count = 0
            if stats['checked'] % 100 == 0:
                print(f"   Progress: {stats['checked']}/{stats['null_total']} checked, {stats['null_fixed']} fixed")
    
    conn.commit()
    print(f"   Fixed {stats['null_fixed']} milestones with NULL amounts")
    
    # Summary
    print("\n" + "="*80)
    print("✅ FIX COMPLETE!")
    print("="*80)
    print(f"   Years fixed: {stats['years_fixed']}")
    print(f"   NULL amounts fixed: {stats['null_fixed']}")
    print(f"   Total checked: {stats['checked']}")
    
    # Final count
    cur.execute("SELECT COUNT(*) FROM billing_milestone WHERE amount_value IS NULL")
    remaining_null = cur.fetchone()[0]
    print(f"   Remaining NULL amounts: {remaining_null}")
    
    cur.execute("""
        SELECT COUNT(*) FROM billing_milestone 
        WHERE amount_value IN (2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030)
    """)
    remaining_years = cur.fetchone()[0]
    print(f"   Remaining years as amounts: {remaining_years}")
    
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
