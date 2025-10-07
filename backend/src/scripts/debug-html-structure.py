#!/usr/bin/env python3
"""
Debug HTML structure
"""

from bs4 import BeautifulSoup

HTML_FILE = '/home/timlihk/staffing-tracker/billing-matter/test.htm'

print(f"Loading HTML file: {HTML_FILE}")

with open(HTML_FILE, 'r', encoding='windows-1252') as f:
    html_content = f.read()

print("Parsing HTML...")
soup = BeautifulSoup(html_content, 'lxml')

# Find all tables
tables = soup.find_all('table')
print(f"Found {len(tables)} tables\n")

if tables:
    table = tables[0]
    rows = table.find_all('tr')
    print(f"Found {len(rows)} rows\n")

    # Show structure of first 10 rows
    for row_idx in range(min(10, len(rows))):
        row = rows[row_idx]
        cells = row.find_all(['td', 'th'])

        print(f"Row {row_idx}: {len(cells)} cells")

        for col_idx, cell in enumerate(cells[:10]):  # Show first 10 cells
            text = cell.get_text(strip=True)[:30]  # First 30 chars
            has_strikethrough = len(cell.find_all(['s', 'strike'])) > 0
            strike_marker = " [HAS STRIKETHROUGH]" if has_strikethrough else ""
            print(f"  Col {col_idx}: {text}{strike_marker}")

        print()
