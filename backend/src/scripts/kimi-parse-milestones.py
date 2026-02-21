#!/usr/bin/env python3
"""
Kimi-Powered Milestone Parser

This script uses Kimi (Kimi Code CLI) to intelligently parse milestone text
from Excel cells instead of using OpenAI API.

Since Kimi is the AI assistant you're talking to right now, you can either:
1. Run this script and it will use rule-based parsing with Kimi-style logic
2. Feed specific problematic cells to Kimi directly for analysis

Usage:
    # Run with rule-based Kimi logic
    python3 kimi-parse-milestones.py
    
    # Or ask Kimi directly to parse a specific cell:
    "Kimi, parse this milestone text: (a) description - $100,000 (strikethrough)"
"""

import os
import sys
import re
import json
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Set, Any
from dataclasses import dataclass, field
from datetime import datetime

import openpyxl

# XML namespaces for Excel
NS = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

DEFAULT_EXCEL_FILE = "/Users/timli/Library/CloudStorage/OneDrive-Personal/Coding/staffing-tracker/Billing/HKCM Project List (2026.02.12).xlsx"


@dataclass
class Milestone:
    """Represents a parsed milestone"""
    ordinal: str                    # "(a)", "(b)", "(1)", etc.
    description: str                # Description text
    amount: Optional[float] = None  # Payment amount
    currency: str = "USD"           # USD, CNY, HKD, etc.
    percent: Optional[float] = None # Percentage if specified
    is_conditional: bool = False    # True if amount depends on condition
    completed: bool = False         # From strikethrough
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'ordinal': self.ordinal,
            'description': self.description,
            'amount': self.amount,
            'currency': self.currency,
            'percent': self.percent,
            'is_conditional': self.is_conditional,
            'completed': self.completed
        }


class KimiMilestoneParser:
    """
    Kimi-style intelligent milestone parser.
    
    Uses reasoning patterns that Kimi would use:
    1. Pattern recognition for ordinals
    2. Context-aware amount extraction
    3. Understanding of Chinese legal fee terminology
    4. Smart strikethrough detection
    """
    
    # Currency detection patterns
    CURRENCY_PATTERNS = [
        (r'US\$|\$|USD|美元|美金', 'USD'),
        (r'RMB|CNY|￥|人民币|元', 'CNY'),
        (r'HK\$|HKD|港元|港币', 'HKD'),
    ]
    
    # Ordinal patterns (order matters - more specific first)
    ORDINAL_PATTERNS = [
        # Letter ordinals: (a), (b), (c)
        (r'\(([a-z])\)', 'letter'),
        # Number ordinals: (1), (2), (2a)
        (r'\((\d{1,2}[a-z]?)\)', 'number'),
        # Chinese ordinals: 1., 2., 2.1
        (r'^(\d+)\.', 'number_cn'),
    ]
    
    # Conditional keywords (milestones without fixed amounts)
    CONDITIONAL_KEYWORDS = [
        '减去', '扣除', '减去本所', '按', '根据', '实际产生',
        '若', '如果', '假如', '未能', '成功',
        'minus', 'deduct', 'based on', 'actual', 'if', 'condition'
    ]
    
    def __init__(self):
        self.debug_mode = False
    
    def detect_currency(self, text: str) -> str:
        """Detect currency from text context"""
        text_upper = text.upper()
        for pattern, currency in self.CURRENCY_PATTERNS:
            if re.search(pattern, text_upper):
                return currency
        return "USD"  # Default
    
    def is_conditional_milestone(self, text: str) -> bool:
        """Check if milestone amount is conditional"""
        text_lower = text.lower()
        for keyword in self.CONDITIONAL_KEYWORDS:
            if keyword in text_lower:
                return True
        return False
    
    def extract_amount(self, text: str) -> tuple[Optional[float], bool]:
        """
        Extract amount from milestone text.
        Returns: (amount, is_conditional)
        """
        # Check for conditional first
        is_conditional = self.is_conditional_milestone(text)
        
        # Amount patterns (ordered by specificity)
        amount_patterns = [
            # $100,000 or US$100,000
            r'[US\$\$]\s*([\d,]+(?:\.\d+)?)',
            # 100,000 USD or 100,000美元
            r'([\d,]+(?:\.\d+)?)\s*(?:USD|美元|美金)',
            # CNY 100,000 or RMB 100,000 or 100,000元
            r'(?:CNY|RMB|￥)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:元|人民币)',
            # Just number after dash: - 100,000
            r'[-–—]\s*([\d,]+(?:\.\d+)?)\s*$',
            # Standalone number with commas
            r'\b([\d,]{4,}(?:\.\d+)?)\b',
        ]
        
        for pattern in amount_patterns:
            match = re.search(pattern, text.replace(',', ''))
            if match:
                # Get first non-None group
                amount_str = next((g for g in match.groups() if g is not None), None)
                if amount_str:
                    try:
                        amount = float(amount_str.replace(',', ''))
                        if amount > 1000:  # Reasonable threshold
                            return amount, is_conditional
                    except ValueError:
                        continue
        
        return None, is_conditional
    
    def extract_percentage(self, text: str) -> Optional[float]:
        """Extract percentage from milestone text"""
        patterns = [
            r'\((\d+(?:\.\d+)?)%\)',
            r'(\d+(?:\.\d+)?)%',
            r'（(\d+(?:\.\d+)?)%）',
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    continue
        return None
    
    def find_ordinals(self, text: str) -> List[tuple[str, int, int, str]]:
        """
        Find all ordinals in text with their positions.
        Returns: list of (ordinal, start, end, type)
        """
        ordinals = []
        seen = set()
        
        for pattern, otype in self.ORDINAL_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                ordinal = f"({match.group(1).lower()})"
                if ordinal not in seen:
                    seen.add(ordinal)
                    ordinals.append((ordinal, match.start(), match.end(), otype))
        
        # Sort by position
        ordinals.sort(key=lambda x: x[1])
        return ordinals
    
    def parse_milestone(self, ordinal: str, text: str, struck_ordinals: Set[str]) -> Milestone:
        """Parse a single milestone from text"""
        
        # Extract components
        amount, is_conditional = self.extract_amount(text)
        currency = self.detect_currency(text)
        percent = self.extract_percentage(text)
        completed = ordinal in struck_ordinals
        
        # Clean description
        description = text.strip()
        
        return Milestone(
            ordinal=ordinal,
            description=description,
            amount=amount,
            currency=currency,
            percent=percent,
            is_conditional=is_conditional,
            completed=completed
        )
    
    def parse_text(self, text: str, struck_ordinals: Set[str] = None) -> List[Milestone]:
        """
        Main parsing method - Kimi-style intelligent parsing.
        
        Strategy:
        1. Find all ordinal markers (a), (b), (1), (2)
        2. Split text into milestone segments
        3. Extract amount, currency, percentage from each segment
        4. Mark completed based on strikethrough
        """
        if not text or not text.strip():
            return []
        
        if struck_ordinals is None:
            struck_ordinals = set()
        
        # Find all ordinals with positions
        ordinals = self.find_ordinals(text)
        
        if not ordinals:
            # No ordinals found - treat entire text as single milestone
            # Try to extract amount anyway
            amount, is_conditional = self.extract_amount(text)
            if amount:
                return [Milestone(
                    ordinal="(1)",
                    description=text.strip(),
                    amount=amount,
                    currency=self.detect_currency(text),
                    is_conditional=is_conditional,
                    completed="*" in struck_ordinals  # All completed marker
                )]
            return []
        
        # Split text into milestone segments
        milestones = []
        for i, (ordinal, start, end, otype) in enumerate(ordinals):
            # Determine segment boundaries
            if i + 1 < len(ordinals):
                segment_end = ordinals[i + 1][1]
            else:
                segment_end = len(text)
            
            # Extract segment text
            segment = text[end:segment_end].strip()
            
            # Clean up - remove trailing newlines and other ordinals
            segment = re.sub(r'\n\s*\([a-z0-9]\).*$', '', segment, flags=re.DOTALL)
            
            milestone = self.parse_milestone(ordinal, segment, struck_ordinals)
            milestones.append(milestone)
        
        return milestones
    
    def print_analysis(self, text: str, milestones: List[Milestone]):
        """Print Kimi-style analysis of parsed milestones"""
        print("\n" + "="*80)
        print("KIMI MILESTONE PARSER ANALYSIS")
        print("="*80)
        print(f"\n📄 Original Text:\n{text[:200]}...")
        print(f"\n📊 Parsed {len(milestones)} milestone(s):\n")
        
        for i, m in enumerate(milestones, 1):
            status = "✅ Completed" if m.completed else "⏳ Pending"
            amount_str = f"{m.currency} {m.amount:,.2f}" if m.amount else "TBD/Conditional"
            
            print(f"  {i}. {m.ordinal} {status}")
            print(f"     Description: {m.description[:60]}...")
            print(f"     Amount: {amount_str}")
            if m.percent:
                print(f"     Percent: {m.percent}%")
            if m.is_conditional:
                print(f"     ⚠️  Conditional amount")
            print()


def extract_strikethrough_from_excel(file_path: str, sheet_name: str = "Transactions") -> Dict[int, Set[str]]:
    """Extract strikethrough information from Excel XML"""
    struck_data = {}
    
    with zipfile.ZipFile(file_path, 'r') as zf:
        # Parse shared strings
        if 'xl/sharedStrings.xml' not in zf.namelist():
            return struck_data
        
        ss_xml = zf.read('xl/sharedStrings.xml')
        root = ET.fromstring(ss_xml)
        
        ss_list = []
        for idx, si in enumerate(root.findall('.//main:si', NS)):
            parts = []
            has_strike = False
            for r in si.findall('.//main:r', NS):
                t = r.find('.//main:t', NS)
                text = t.text if t is not None else ""
                rpr = r.find('.//main:rPr', NS)
                struck = False
                if rpr is not None:
                    strike = rpr.find('.//main:strike', NS)
                    if strike is not None:
                        val = strike.get('val', 'true')
                        if val in ('true', '1', 'single'):
                            struck = True
                            has_strike = True
                parts.append({'text': text, 'struck': struck})
            ss_list.append({
                'index': idx,
                'parts': parts,
                'has_strike': has_strike,
                'full_text': ''.join(p['text'] for p in parts)
            })
        
        # Map to worksheet
        ws_xml = zf.read(f'xl/worksheets/sheet1.xml')
        root = ET.fromstring(ws_xml)
        
        for row in root.findall('.//main:row', NS):
            row_num = int(row.get('r', 0))
            for cell in row.findall('.//main:c', NS):
                cell_ref = cell.get('r', '')
                if cell_ref.startswith('I'):  # Fee Arrangement column
                    v = cell.find('.//main:v', NS)
                    if v is not None:
                        try:
                            ss_idx = int(v.text)
                            if ss_idx < len(ss_list):
                                ss = ss_list[ss_idx]
                                
                                # Check cell-level strikethrough
                                cell_style = cell.get('s')
                                
                                if ss['has_strike']:
                                    struck_ordinals = set()
                                    for part in ss['parts']:
                                        if part['struck']:
                                            # Extract ordinals from struck text
                                            for match in re.finditer(r'\(([a-z])\)', part['text'], re.I):
                                                struck_ordinals.add(f"({match[1].lower()})")
                                    if struck_ordinals:
                                        struck_data[row_num] = struck_ordinals
                                
                                # Also check if entire cell has strikethrough
                                # This would require styles.xml parsing
                                # For now, we use the XML-level detection
                                
                        except (ValueError, IndexError):
                            continue
    
    return struck_data


def main():
    """Main entry point"""
    print("🤖 Kimi Milestone Parser")
    print("="*80)
    
    parser = KimiMilestoneParser()
    
    # Test with some real examples
    test_cases = [
        {
            "name": "Row 196 (9606) - Partial strikethrough",
            "text": """(a) 2021年3月31 - 支付195,000 
(b) 2021年7月31 - 支付(a)按上市项目实际产生及按小时计算的费用减去本所实际产生195,000 或 260,000""",
            "struck": {"(a)"}
        },
        {
            "name": "Row 5 (Salus) - All completed",
            "text": """Original EL: (a) 递交上市申请表后的5个工作日内 - 630,000
(b) 上市聆讯后的5个工作日内 - 630,000
(c) 上市项目完成的5个工作日内 - 630,000
Supplemental EL: additional IPO fee 900,000""",
            "struck": {"*"}  # All completed marker
        },
        {
            "name": "Chinese milestone with percentage",
            "text": """(a) 上市项目启动后的10日内(20%) - 330,000
(b) 提交上市A1申请表格后10个工作日内(30%) - 495,000""",
            "struck": set()
        },
        {
            "name": "Complex conditional",
            "text": """(c) 2021年7月31 - 支付(a)按上市项目工作截止于2021年6月30日本所实际产生及按小时计算的费用减去本所实际产生的费用与(a)的差额或260,000""",
            "struck": set()
        }
    ]
    
    print("\n📚 Running test cases...\n")
    
    for test in test_cases:
        print(f"\n{'='*80}")
        print(f"Test: {test['name']}")
        print(f"{'='*80}")
        
        milestones = parser.parse_text(test['text'], test['struck'])
        parser.print_analysis(test['text'], milestones)
    
    # Now process actual Excel file
    print("\n" + "="*80)
    print("PROCESSING ACTUAL EXCEL FILE")
    print("="*80)
    
    excel_file = os.environ.get("EXCEL_FILE", DEFAULT_EXCEL_FILE)
    
    if not os.path.exists(excel_file):
        print(f"❌ Excel file not found: {excel_file}")
        return
    
    print(f"\n📂 Loading: {excel_file}")
    
    # Extract strikethrough data
    print("\n🔍 Extracting strikethrough formatting from Excel XML...")
    struck_data = extract_strikethrough_from_excel(excel_file)
    print(f"   Found {len(struck_data)} rows with strikethrough")
    
    # Load workbook
    wb = openpyxl.load_workbook(excel_file, data_only=True, read_only=True)
    sheet = wb['Transactions']
    
    # Process first 10 rows with fee arrangements
    print("\n📊 Parsing milestones from first 10 data rows...\n")
    
    rows_parsed = 0
    for row_idx, row in enumerate(sheet.iter_rows(min_row=5, max_row=20, values_only=True), start=5):
        if len(row) < 9:
            continue
        
        cm_no = row[3] if row[3] else ""
        fee_text = row[8] if row[8] else ""
        
        if not fee_text or not str(fee_text).strip():
            continue
        
        fee_str = str(fee_text).strip()
        if len(fee_str) < 10:  # Skip very short entries
            continue
        
        # Get strikethrough for this row
        struck_ordinals = struck_data.get(row_idx, set())
        
        # Parse milestones
        milestones = parser.parse_text(fee_str, struck_ordinals)
        
        if milestones:
            print(f"\nRow {row_idx} (CM: {cm_no}):")
            for m in milestones:
                status = "✅" if m.completed else "⏳"
                amount = f"{m.currency} {m.amount:,.0f}" if m.amount else "TBD"
                print(f"   {status} {m.ordinal}: {amount} - {m.description[:50]}...")
            rows_parsed += 1
    
    wb.close()
    
    print(f"\n{'='*80}")
    print(f"✅ Parsed {rows_parsed} rows with milestones")
    print("="*80)
    
    print("\n💡 Tip: To use Kimi (me) directly for parsing:")
    print("   Just paste the milestone text and ask me to parse it!")
    print("   Example: 'Kimi, parse: (a) description - $100,000'")


if __name__ == "__main__":
    main()
