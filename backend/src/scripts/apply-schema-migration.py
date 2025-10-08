#!/usr/bin/env python3
"""
Apply billing schema migration
"""

import psycopg2
import os
import sys

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:qtSnaaSaelqHVydazTmViwejXbkkZxVY@crossover.proxy.rlwy.net:15782/railway')

# Get migration file from command line argument, or use default
if len(sys.argv) > 1:
    MIGRATION_FILE = sys.argv[1]
else:
    MIGRATION_FILE = '/home/timlihk/staffing-tracker/backend/prisma/migrations/20251007_fix_cm_engagement_structure/migration.sql'

def apply_migration():
    """Apply migration SQL file"""
    print("=" * 80)
    print("Applying Billing Schema Migration")
    print("=" * 80)

    # Read migration file
    with open(MIGRATION_FILE, 'r') as f:
        migration_sql = f.read()

    print(f"\nMigration file: {MIGRATION_FILE}")
    print(f"SQL length: {len(migration_sql)} characters\n")

    # Connect and execute
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    try:
        print("Executing migration...")
        cursor.execute(migration_sql)
        conn.commit()
        print("✅ Migration applied successfully!")

        # Verify the changes
        print("\n" + "=" * 80)
        print("Verification")
        print("=" * 80)

        # Check C/M columns
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'billing_project_cm_no'
            AND column_name IN ('open_date', 'closed_date', 'status')
            ORDER BY column_name
        """)

        print("\nC/M Number columns:")
        for row in cursor.fetchall():
            print(f"  - {row[0]}: {row[1]}")

        # Check engagement columns
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'billing_engagement'
            AND column_name IN ('name', 'start_date', 'end_date')
            ORDER BY column_name
        """)

        print("\nEngagement columns:")
        for row in cursor.fetchall():
            print(f"  - {row[0]}: {row[1]}")

        # Check removed columns
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'billing_engagement'
            AND column_name IN ('status', 'engagement_date', 'signed_date', 'expiry_date', 'closed_date')
        """)

        removed_cols = cursor.fetchall()
        if removed_cols:
            print("\n⚠️  Columns still present (should be removed):")
            for row in removed_cols:
                print(f"  - {row[0]}")
        else:
            print("\n✅ Old engagement columns removed successfully")

        # Check views
        cursor.execute("""
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
            AND table_name = 'billing_engagement_detail'
        """)

        print("\nViews:")
        for row in cursor.fetchall():
            print(f"  - {row[0]}")

        # Check C/M status constraint
        cursor.execute("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'billing_project_cm_no'
            AND constraint_type = 'CHECK'
            AND constraint_name LIKE '%status%'
        """)

        print("\nC/M status constraints:")
        for row in cursor.fetchall():
            print(f"  - {row[0]}")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error applying migration: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

    print("\n" + "=" * 80)

if __name__ == '__main__':
    apply_migration()
