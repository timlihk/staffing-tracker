#!/usr/bin/env python3
"""
Kimi Direct Parser - Interactive Mode

This script extracts cell content from Excel and formats it for Kimi to parse.
Since you are already talking to Kimi (me!), you can paste the output and I'll parse it.

Usage:
    # Extract specific rows for Kimi to analyze
    python3 kimi-direct-parse.py --row 196
    python3 kimi-direct-parse.py --row 5 --row 196 --row 333
    
    # Then paste the output to Kimi and ask: "Kimi, parse these milestones"
"""

import os
import sys
import argparse
import openpyxl

DEFAULT_EXCEL_FILE = "/Users/timli/Library/CloudStorage/OneDrive-Personal/Coding/staffing-tracker/Billing/HKCM Project List (2026.02.12).xlsx"


def extract_cell_for_kimi(excel_file: str, row_num: int) -> dict:
    """Extract a row's data in a format easy for Kimi to parse"""
    
    wb = openpyxl.load_workbook(excel_file, data_only=True, read_only=True)
    sheet = wb['Transactions']
    
    # Get header row
    headers = []
    for cell in sheet[4]:  # Row 4 is header
        headers.append(cell.value)
    
    # Get data row
    row_data = {}
    for idx, row in enumerate(sheet.iter_rows(min_row=row_num, max_row=row_num, values_only=True), start=row_num):
        for col_idx, value in enumerate(row):
            if col_idx < len(headers) and headers[col_idx]:
                row_data[headers[col_idx]] = value
    
    wb.close()
    return row_data


def format_for_kimi(row_data: dict, row_num: int) -> str:
    """Format row data for Kimi parsing"""
    
    cm_no = row_data.get('C/M No#', 'N/A')
    project = row_data.get('Project Name', 'N/A')
    fee_text = row_data.get('Fee Arrangement', '')
    
    output = f"""
{'='*80}
ROW {row_num} - For Kimi to Parse
{'='*80}

Project: {project}
CM Number: {cm_no}

--- FEE ARRANGEMENT TEXT ---
{fee_text if fee_text else '[Empty]'}
--- END ---

Instructions for Kimi:
1. Identify all milestones (look for (a), (b), (c) or (1), (2), (3))
2. Extract the payment amount for each milestone
3. Note if any text has strikethrough (indicates completed)
4. Return structured data like:
   - (a): $X - Description - [Completed/Pending]
   - (b): $Y - Description - [Completed/Pending]

{'='*80}
"""
    return output


def main():
    parser = argparse.ArgumentParser(description='Extract Excel cells for Kimi to parse')
    parser.add_argument('--row', type=int, action='append', help='Row number to extract (can use multiple times)')
    parser.add_argument('--start-row', type=int, default=5, help='Start row for range')
    parser.add_argument('--end-row', type=int, help='End row for range')
    parser.add_argument('--excel', default=DEFAULT_EXCEL_FILE, help='Path to Excel file')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.excel):
        print(f"❌ Excel file not found: {args.excel}")
        return
    
    # Determine which rows to extract
    rows_to_extract = []
    
    if args.row:
        rows_to_extract = args.row
    elif args.end_row:
        rows_to_extract = list(range(args.start_row, args.end_row + 1))
    else:
        # Default: show some interesting rows
        rows_to_extract = [5, 196, 333]
    
    print("""
🤖 KIMI DIRECT PARSER - EXTRACTOR
================================================================================

This script extracts Excel cell content for Kimi (me!) to parse.

Since you're already talking to Kimi, you can:
1. Run this script to extract cells
2. Copy the output
3. Paste it back to Kimi and say: "Kimi, parse these milestones"

Or simply tell Kimi: "Parse row 196 from the Excel file" and I'll do it!
""")
    
    for row_num in rows_to_extract:
        try:
            row_data = extract_cell_for_kimi(args.excel, row_num)
            formatted = format_for_kimi(row_data, row_num)
            print(formatted)
        except Exception as e:
            print(f"❌ Error extracting row {row_num}: {e}")


if __name__ == "__main__":
    main()
