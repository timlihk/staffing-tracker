/**
 * Fuzzy matching utilities for project name comparison
 * Helps identify potential matches between billing and staffing projects
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits required to change one string into the other
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Normalize project name for comparison
 * - Converts to lowercase
 * - Removes common suffixes (Co., Ltd., Inc., etc.)
 * - Removes special characters and extra spaces
 * - Removes common words that don't add meaning
 */
export function normalizeProjectName(name: string): string {
  let normalized = name.toLowerCase();

  // Remove common company suffixes
  const suffixes = [
    'co\\.?,? ltd\\.?',
    'company',
    'corporation',
    'corp\\.?',
    'inc\\.?',
    'incorporated',
    'limited',
    'ltd\\.?',
    'llc',
    'l\\.l\\.c\\.?',
    'plc',
  ];
  const suffixPattern = new RegExp(`\\b(${suffixes.join('|')})\\b`, 'gi');
  normalized = normalized.replace(suffixPattern, '');

  // Remove common project prefixes/indicators
  normalized = normalized.replace(/\b(project|matter|engagement)\s+/gi, '');

  // Remove special characters but keep spaces and hyphens
  normalized = normalized.replace(/[^a-z0-9\s-]/g, '');

  // Replace multiple spaces/hyphens with single space
  normalized = normalized.replace(/[\s-]+/g, ' ');

  // Trim
  normalized = normalized.trim();

  return normalized;
}

/**
 * Calculate similarity score between two project names (0 to 1)
 * Higher score means more similar
 */
export function calculateSimilarity(name1: string, name2: string): number {
  const normalized1 = normalizeProjectName(name1);
  const normalized2 = normalizeProjectName(name2);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Empty strings
  if (normalized1.length === 0 || normalized2.length === 0) {
    return 0.0;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLen = Math.max(normalized1.length, normalized2.length);

  // Convert distance to similarity (0 to 1)
  const similarity = 1 - distance / maxLen;

  // Bonus for substring matches
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return Math.min(1.0, similarity + 0.1);
  }

  // Bonus for word overlap
  const words1 = new Set(normalized1.split(' '));
  const words2 = new Set(normalized2.split(' '));
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size > 0) {
    const wordOverlap = intersection.size / union.size;
    return Math.max(similarity, wordOverlap * 0.8);
  }

  return similarity;
}

/**
 * Find best matches for a project name from a list of candidates
 * Returns matches with similarity >= threshold, sorted by score
 */
export interface ProjectMatch {
  id: number | bigint;
  name: string;
  score: number;
  normalizedName: string;
}

export function findBestMatches(
  targetName: string,
  candidates: Array<{ id: number | bigint; name: string }>,
  threshold: number = 0.7,
  maxResults: number = 5
): ProjectMatch[] {
  const matches: ProjectMatch[] = [];

  for (const candidate of candidates) {
    const score = calculateSimilarity(targetName, candidate.name);
    if (score >= threshold) {
      matches.push({
        id: candidate.id,
        name: candidate.name,
        score,
        normalizedName: normalizeProjectName(candidate.name),
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, maxResults);
}
