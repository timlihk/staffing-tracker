/**
 * AI Validation Service
 *
 * Optional AI-powered validation for Excel sync parsing results.
 * Uses DeepSeek (or any OpenAI-compatible API) to flag potential issues.
 * Gracefully disabled when no API key is configured.
 */

import OpenAI from 'openai';
import config from '../config';
import { logger } from '../utils/logger';

export interface ValidationIssue {
  cmNo: string;
  engagementTitle: string;
  severity: 'warning' | 'error';
  issue: string;
  suggestion: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  validated: boolean; // false if AI was unavailable
}

interface EngagementForValidation {
  cmNo: string;
  engagementTitle: string;
  rawMilestoneText: string;
  parsedMilestones: Array<{
    ordinal: string;
    title: string;
    amountValue: number | null;
    isCompleted: boolean;
  }>;
  agreedFee: number | null;
  lsdDate: string | null;
}

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!config.ai.enabled || !config.ai.apiKey) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
    });
  }
  return client;
}

/**
 * Validate parsed Excel data using AI. Returns issues found.
 * If AI is not configured, returns { issues: [], validated: false }.
 */
export async function validateParsedData(
  engagements: EngagementForValidation[]
): Promise<ValidationResult> {
  const ai = getClient();
  if (!ai) {
    return { issues: [], validated: false };
  }

  // Filter to engagements worth validating:
  // 1. Has raw text but no milestones parsed
  // 2. Has milestones — validate ordinal continuity and amounts
  const toValidate = engagements.filter(
    (e) => e.rawMilestoneText.trim().length > 10
  );

  if (toValidate.length === 0) {
    return { issues: [], validated: true };
  }

  // Batch into groups of 20 to stay within token limits
  const BATCH_SIZE = 20;
  const allIssues: ValidationIssue[] = [];

  for (let i = 0; i < toValidate.length; i += BATCH_SIZE) {
    const batch = toValidate.slice(i, i + BATCH_SIZE);
    try {
      const batchIssues = await validateBatch(ai, batch);
      allIssues.push(...batchIssues);
    } catch (error) {
      logger.error('AI validation batch failed', {
        batchStart: i,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { issues: allIssues, validated: true };
}

const SYSTEM_PROMPT = `You are a billing data validation assistant for a Hong Kong law firm. You compare raw milestone text from finance Excel cells against regex-parsed results and flag ONLY genuine parsing failures.

## How the parser works

The parser extracts milestones from column I of an Excel spreadsheet. It looks for lines that start with ordinal labels:
- Parenthesized letters: (a), (b), (c), ...
- Parenthesized numbers: (1), (2), (3), ...
- Letter-dot: a., b., c., ...
- Number-dot: 1., 2., 3., ...
- Supplemental ordinals: (a-2), (b-2), (c-2), ...
- Roman numerals in parens: (i), (ii), (iii), ...

Each milestone line may have an amount at the end after a dash:
- "- 630,000" → USD 630,000
- "- US$450,000" → USD 450,000
- "- RMB 100,000" → CNY 100,000

Lines WITHOUT an ordinal label are NOT milestones — they are notes, headers, descriptions, or supplemental fee text. The parser intentionally skips them.

## What to flag (TRUE issues)

1. **MISSING MILESTONES**: A line in the raw text has a clear ordinal label like (a), (b), (1), (2), a., b. etc. but was NOT captured in the parsed milestones list.
2. **ORDINAL GAPS**: Parsed ordinals skip a value — e.g. (a) and (c) are parsed but (b) is missing. Only flag if the gap ordinal actually appears in the raw text.
3. **AMOUNT MISMATCHES**: A milestone's parsed amount is clearly different from what the raw text states. E.g., raw says "- 450,000" but parsed amount=630,000.
4. **UNPARSED AMOUNTS**: Raw text has a clear "- [number]" or "US$[number]" amount on a milestone line, but the parsed milestone has amount=null.

## What NOT to flag (false positives to avoid)

- **Lines without ordinals** — text like "additional IPO fee 900,000", "fixed fee 200,000", "Total: 1,350,000", "Retainer", "Agreed fee" etc. are NOT milestones. They have no ordinal label. Do not flag them as missing.
- **EL headers** — "Original EL:", "Supplemental EL:", "Updated EL:" etc. are section dividers, not milestones. Ignore them.
- **LSD dates** — "(LSD: 31 March 2025)" is metadata, not a milestone. Do not flag.
- **Chinese amounts in 万 format** — amounts like "25万美元" or "506.4万元人民币" are known to not be parseable by regex. Do NOT flag these as issues.
- **Percentage amounts** — "(20%)" style amounts may show as amount=null with a separate percent field. Do not flag.
- **Descriptions / notes after milestones** — extra text explaining a milestone is normal and not an issue.
- **Minor text truncation** — if the parsed title is a slightly shorter version of the raw text, that's fine.
- **Completion status** — do NOT flag completion/strikethrough issues. Strikethrough detection uses character-level font data from Excel rich text, which is not visible in the plain text shown here. You cannot determine completion from plain text alone.
- **"Form F-1"** or similar references containing dashes — these are document names, not amounts.

## Examples

### Example 1: NO issues (correct parse)
Raw text: "(a) 递交上市申请表后的5个工作日内 - 630,000\\n(b) 上市聆讯后的5个工作日内 - 450,000\\n(c) 上市项目完成5个工作日内 - 270,000"
Parsed: (a) amount=630000, (b) amount=450000, (c) amount=270000
→ All ordinals captured, all amounts match. Return NO issues.

### Example 2: NO issues (supplemental fee without ordinal)
Raw text: "Original EL: (a) Phase 1 - 200,000\\n(b) Phase 2 - 150,000\\nSupplemental EL: additional IPO fee 900,000"
Parsed: (a) amount=200000, (b) amount=150000
→ "additional IPO fee 900,000" has NO ordinal — it is correctly not parsed as a milestone. Return NO issues.

### Example 3: TRUE issue (missing milestone)
Raw text: "(a) Filing - 100,000\\n(b) Hearing - 200,000\\n(c) Completion - 300,000"
Parsed: (a) amount=100000, (c) amount=300000
→ (b) appears in raw text but is missing from parsed results. Flag as ERROR: "Missing milestone (b)".

### Example 4: TRUE issue (amount mismatch)
Raw text: "(a) Phase 1 - 500,000\\n(b) Phase 2 - 300,000"
Parsed: (a) amount=500000, (b) amount=200000
→ (b) raw says 300,000 but parsed as 200,000. Flag as ERROR: "Amount mismatch for (b): raw=300,000, parsed=200,000".

## Response format

Return a JSON object. Be conservative — only flag clear, unambiguous issues. When in doubt, do NOT flag.

{
  "issues": [
    {
      "index": 0,
      "severity": "warning" or "error",
      "issue": "Brief description",
      "suggestion": "What to check or fix"
    }
  ]
}

If no issues found, return: {"issues": []}`;

async function validateBatch(
  ai: OpenAI,
  batch: EngagementForValidation[]
): Promise<ValidationIssue[]> {
  const engagementDescriptions = batch.map((e, idx) => {
    const msLines = e.parsedMilestones.length > 0
      ? e.parsedMilestones.map(
          (m) => `  ${m.ordinal} "${m.title}" amount=${m.amountValue ?? 'null'} completed=${m.isCompleted}`
        ).join('\n')
      : '  (no milestones parsed)';

    return `[${idx}] C/M: ${e.cmNo} | Engagement: ${e.engagementTitle}
Agreed Fee: ${e.agreedFee ?? 'null'} | LSD: ${e.lsdDate ?? 'none'}
Raw text:
"""
${e.rawMilestoneText.slice(0, 1500)}
"""
Parsed milestones:
${msLines}`;
  }).join('\n\n---\n\n');

  const response = await ai.chat.completions.create({
    model: config.ai.model || 'deepseek-chat',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: engagementDescriptions,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as {
      issues: Array<{
        index: number;
        severity: 'warning' | 'error';
        issue: string;
        suggestion: string;
      }>;
    };

    return (parsed.issues || []).map((issue) => {
      const eng = batch[issue.index];
      return {
        cmNo: eng?.cmNo ?? 'unknown',
        engagementTitle: eng?.engagementTitle ?? 'unknown',
        severity: issue.severity === 'error' ? 'error' : 'warning',
        issue: issue.issue,
        suggestion: issue.suggestion,
      };
    });
  } catch {
    logger.error('Failed to parse AI validation response', { content: content.slice(0, 200) });
    return [];
  }
}
