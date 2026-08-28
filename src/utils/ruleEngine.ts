/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Rule } from '../types';

// Standard English stop words
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have',
  'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt',
  'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such',
  'than', 'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres',
  'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent',
  'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom',
  'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve',
  'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Clean, lowercase, and tokenize query text
 */
export function preprocessText(text: string): string[] {
  if (!text) return [];
  
  // 1. Convert to lowercase
  let cleanText = text.toLowerCase();
  
  // 2. Remove punctuation (replace with space to keep words separate)
  cleanText = cleanText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ');
  
  // 3. Tokenize by splitting on whitespaces
  const tokens = cleanText.split(/\s+/).filter(token => token.length > 0);
  
  // 4. Remove stop words
  return tokens.filter(token => !STOP_WORDS.has(token));
}

/**
 * Normalizes lists of keywords/synonyms into clean arrays
 */
export function parseCommaSeparatedList(listString: string): string[] {
  if (!listString) return [];
  return listString
    .toLowerCase()
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

export interface MatchResult {
  rule: Rule;
  score: number;
  isConfident: boolean;
}

/**
 * Keyword-based matching engine
 */
export function findBestMatchingRule(query: string, rules: Rule[]): MatchResult | null {
  const activeRules = rules.filter(r => r.status === 'Active');
  if (activeRules.length === 0) return null;

  const normalizedQuery = normalizeText(query);
  const queryTokens = preprocessText(query);

  if (!normalizedQuery || (queryTokens.length === 0 && normalizedQuery.length === 0)) return null;
  if (isTicketTrackingQuery(normalizedQuery) || isPortalNavigationQuery(normalizedQuery)) return null;

  const results: MatchResult[] = [];

  for (const rule of activeRules) {
    if (!rule.question) continue;

    const cleanQuestion = normalizeText(rule.question);
    const keywords = parseCommaSeparatedList(rule.keywords || '');
    const synonyms = parseCommaSeparatedList(rule.synonyms || '');
    const relatedQuestions = parseRelatedQuestions(rule.relatedQuestions);
    const departmentTag = normalizeText(rule.relatedDepartment || '');

    const searchTokens = [cleanQuestion, ...keywords, ...synonyms, ...relatedQuestions, departmentTag]
      .filter(Boolean)
      .map(normalizeText)
      .join(' ');

    const coveredTokenCount = queryTokens.filter((token) =>
      searchTokens.split(/\s+/).some(candidate => candidate === token || (candidate.length >= 4 && (candidate.startsWith(token) || token.startsWith(candidate))))
    ).length;
    const hasCompleteIntentCoverage = queryTokens.length === 0 || coveredTokenCount === queryTokens.length;
    if (!hasCompleteIntentCoverage) continue;

    let score = 0;

    if (normalizedQuery === cleanQuestion) {
      score += 180;
    }
    if (keywords.some((kw) => normalizeText(kw) === normalizedQuery)) {
      score += 150;
    }
    if (synonyms.some((syn) => normalizeText(syn) === normalizedQuery)) {
      score += 140;
    }
    if (relatedQuestions.some((rq) => normalizeText(rq) === normalizedQuery)) {
      score += 130;
    }

    if (cleanQuestion.includes(normalizedQuery) || normalizedQuery.includes(cleanQuestion)) {
      score += 90;
    }
    if (keywords.some((kw) => kw && normalizedQuery.includes(normalizeText(kw)))) {
      score += 60;
    }
    if (synonyms.some((syn) => syn && normalizedQuery.includes(normalizeText(syn)))) {
      score += 50;
    }
    if (relatedQuestions.some((rq) => {
      const normalizedRQ = normalizeText(rq);
      return normalizedRQ && (normalizedQuery.includes(normalizedRQ) || normalizedRQ.includes(normalizedQuery));
    })) {
      score += 55;
    }
    if (departmentTag && normalizedQuery.includes(departmentTag)) {
      score += 30;
    }

    for (const token of queryTokens) {
      if (cleanQuestion.split(/\s+/).includes(token)) {
        score += 4;
      } else if (cleanQuestion.includes(token)) {
        score += 1.5;
      }

      if (keywords.some(kw => normalizeText(kw) === token)) {
        score += 6;
      } else if (keywords.some(kw => normalizeText(kw).includes(token) || token.includes(normalizeText(kw)))) {
        score += 2;
      }

      if (synonyms.some(syn => normalizeText(syn) === token)) {
        score += 5;
      } else if (synonyms.some(syn => normalizeText(syn).includes(token) || token.includes(normalizeText(syn)))) {
        score += 1.5;
      }

      if (relatedQuestions.some(rq => normalizeText(rq).includes(token))) {
        score += 2;
      }
    }

    if (queryTokens.length > 1 && cleanQuestion.includes(normalizedQuery)) {
      score += 15;
    }

    if (score < 75) continue;
    if (queryTokens.length >= 2 && score < queryTokens.length * 10) continue;

    if (rule.priority !== undefined && rule.priority !== null) {
      score += Math.max(0, 10 - rule.priority);
    }

    results.push({ rule, score, isConfident: false });
  }

  if (results.length === 0) return null;

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((a.rule.priority ?? 100) !== (b.rule.priority ?? 100)) return (a.rule.priority ?? 100) - (b.rule.priority ?? 100);
    return a.rule.question.length - b.rule.question.length;
  });

  const bestMatch = results[0];
  // Consider a match confident if score is above 100 (good match threshold)
  const isConfident = bestMatch.score >= 100;
  
  return { ...bestMatch, isConfident };
}

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"'?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRelatedQuestions(relatedQuestions: string[] | string | undefined): string[] {
  if (!relatedQuestions) return [];
  if (Array.isArray(relatedQuestions)) return relatedQuestions.map((item) => String(item || '').trim()).filter(Boolean);
  const raw = String(relatedQuestions).trim();
  if (!raw) return [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      // fall through
    }
  }
  return raw.split(/[\n,]/).map((item) => String(item || '').trim()).filter(Boolean);
}

function isTicketTrackingQuery(query: string): boolean {
  return /\b(tkt-|t-|necn-|ticket status|track my ticket|track ticket|ticket progress|ticket id|support ticket)\b/i.test(query);
}

function isPortalNavigationQuery(query: string): boolean {
  return /\b(attendance|student status|marks|hall ticket|student portal|attendance tracker|academic status|grades)\b/i.test(query);
}
