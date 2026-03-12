import crypto from 'crypto';

/**
 * Detect experience level from job title and description text.
 */
export function detectExperienceLevel(
  title: string,
  description: string
): 'intern' | 'junior' | 'mid' | 'senior' | 'lead' {
  const text = `${title} ${description}`.toLowerCase();

  // Order matters: check most specific first
  if (
    /\b(intern|internship|stagiar|practica|student)\b/.test(text)
  ) {
    return 'intern';
  }

  if (
    /\b(lead|principal|staff|architect|head of|team lead|tech lead|engineering manager)\b/.test(text)
  ) {
    return 'lead';
  }

  if (
    /\b(senior|sr\.?|experienced|iii|level 3|5\+\s*years?|6\+\s*years?|7\+\s*years?|8\+\s*years?|10\+\s*years?)\b/.test(text)
  ) {
    return 'senior';
  }

  if (
    /\b(junior|jr\.?|entry[\s-]?level|graduate|0[\s-]?[12]\s*years?|1[\s-]?2\s*years?)\b/.test(text)
  ) {
    return 'junior';
  }

  // Default to mid-level if no clear indicator
  return 'mid';
}

/**
 * Detect work type (remote/hybrid/onsite) from title, description, and location.
 */
export function detectWorkType(
  title: string,
  description: string,
  location: string
): 'remote' | 'hybrid' | 'onsite' {
  const text = `${title} ${description} ${location}`.toLowerCase();

  if (/\b(hybrid|hibrid)\b/.test(text)) {
    return 'hybrid';
  }

  if (
    /\b(remote|remote[\s-]?first|work[\s-]?from[\s-]?home|wfh|telecommut|fully[\s-]?remote|la\s*distanta|de\s*acasa)\b/.test(text)
  ) {
    return 'remote';
  }

  if (
    /\b(on[\s-]?site|onsite|in[\s-]?office|office[\s-]?based|la\s*birou|sediu)\b/.test(text)
  ) {
    return 'onsite';
  }

  // Default to onsite if no clear indicator
  return 'onsite';
}

/**
 * Extract technology tags from title and description.
 */
export function extractTags(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const tags = new Set<string>();

  const tagPatterns: Record<string, RegExp> = {
    'react': /\breact(?:\.?js)?\b/,
    'typescript': /\btypescript\b|\bts\b/,
    'javascript': /\bjavascript\b|\bjs\b/,
    'node.js': /\bnode(?:\.?js)?\b/,
    'next.js': /\bnext(?:\.?js)?\b/,
    'vue': /\bvue(?:\.?js)?\b/,
    'angular': /\bangular(?:\.?js)?\b/,
    'html': /\bhtml5?\b/,
    'css': /\bcss3?\b/,
    'tailwind': /\btailwind(?:\s?css)?\b/,
    'sass': /\bsass\b|\bscss\b/,
    'graphql': /\bgraphql\b/,
    'rest': /\brest\s?api\b|\brestful\b/,
    'redux': /\bredux\b/,
    'webpack': /\bwebpack\b/,
    'vite': /\bvite\b/,
    'docker': /\bdocker\b/,
    'aws': /\baws\b|\bamazon\s*web\s*services\b/,
    'git': /\bgit\b/,
    'jest': /\bjest\b/,
    'cypress': /\bcypress\b/,
    'storybook': /\bstorybook\b/,
    'figma': /\bfigma\b/,
    'material-ui': /\bmaterial[\s-]?ui\b|\bmui\b/,
    'bootstrap': /\bbootstrap\b/,
    'jquery': /\bjquery\b/,
    'python': /\bpython\b/,
    'java': /\bjava\b(?!script)/,
    'php': /\bphp\b/,
    'sql': /\bsql\b|\bpostgres\b|\bmysql\b/,
    'mongodb': /\bmongo(?:db)?\b/,
    'firebase': /\bfirebase\b/,
    'supabase': /\bsupabase\b/,
    'prisma': /\bprisma\b/,
    'gatsby': /\bgatsby\b/,
    'remix': /\bremix\b/,
    'svelte': /\bsvelte\b/,
    'nuxt': /\bnuxt(?:\.?js)?\b/,
    'express': /\bexpress(?:\.?js)?\b/,
    'nestjs': /\bnest(?:\.?js)?\b/,
    'zustand': /\bzustand\b/,
    'mobx': /\bmobx\b/,
    'react-query': /\breact[\s-]?query\b|\btanstack\b/,
    'testing-library': /\btesting[\s-]?library\b/,
    'playwright': /\bplaywright\b/,
    'kubernetes': /\bkubernetes\b|\bk8s\b/,
    'ci/cd': /\bci\s?\/?\s?cd\b/,
    'agile': /\bagile\b|\bscrum\b/,
    'd3': /\bd3(?:\.?js)?\b/,
    'three.js': /\bthree(?:\.?js)?\b/,
    'electron': /\belectron\b/,
    'react-native': /\breact[\s-]?native\b/,
    'flutter': /\bflutter\b/,
  };

  for (const [tag, pattern] of Object.entries(tagPatterns)) {
    if (pattern.test(text)) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}

/**
 * Normalize various date string formats to ISO 8601 string.
 * Returns current date if parsing fails.
 */
export function normalizeDate(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') {
    return new Date().toISOString();
  }

  const cleaned = dateStr.trim().toLowerCase();

  // Handle relative dates like "2 days ago", "1 hour ago", "3 weeks ago"
  const relativeMatch = cleaned.match(
    /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/
  );
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const now = new Date();

    switch (unit) {
      case 'second': now.setSeconds(now.getSeconds() - amount); break;
      case 'minute': now.setMinutes(now.getMinutes() - amount); break;
      case 'hour': now.setHours(now.getHours() - amount); break;
      case 'day': now.setDate(now.getDate() - amount); break;
      case 'week': now.setDate(now.getDate() - amount * 7); break;
      case 'month': now.setMonth(now.getMonth() - amount); break;
      case 'year': now.setFullYear(now.getFullYear() - amount); break;
    }

    return now.toISOString();
  }

  // Handle "today" / "yesterday"
  if (cleaned === 'today' || cleaned === 'azi') {
    return new Date().toISOString();
  }
  if (cleaned === 'yesterday' || cleaned === 'ieri') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }

  // Handle Romanian date formats: "12 martie 2024"
  const romanianMonths: Record<string, number> = {
    'ianuarie': 0, 'februarie': 1, 'martie': 2, 'aprilie': 3,
    'mai': 4, 'iunie': 5, 'iulie': 6, 'august': 7,
    'septembrie': 8, 'octombrie': 9, 'noiembrie': 10, 'decembrie': 11,
  };
  const roMatch = cleaned.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (roMatch && romanianMonths[roMatch[2]] !== undefined) {
    const d = new Date(
      parseInt(roMatch[3], 10),
      romanianMonths[roMatch[2]],
      parseInt(roMatch[1], 10)
    );
    return d.toISOString();
  }

  // Try native Date parsing for ISO, RFC 2822, etc.
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // Handle dd/mm/yyyy or dd-mm-yyyy
  const dmyMatch = cleaned.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmyMatch) {
    const d = new Date(
      parseInt(dmyMatch[3], 10),
      parseInt(dmyMatch[2], 10) - 1,
      parseInt(dmyMatch[1], 10)
    );
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Fallback to current date
  return new Date().toISOString();
}

/**
 * Generate a deterministic hash ID for a job based on its URL, title, and company.
 * This prevents duplicate entries when re-scraping.
 */
export function generateJobId(url: string, title: string, company: string): string {
  const input = `${url}|${title.toLowerCase().trim()}|${company.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
}

/**
 * Clean HTML entities and extra whitespace from a string.
 */
export function cleanText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Delay execution for a given number of milliseconds.
 * Useful for rate-limiting scraper requests.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
