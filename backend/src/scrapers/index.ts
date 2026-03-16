import { Job, ScraperResult } from '../types';
import { upsertJobs } from '../utils/supabase';
import { generateJobId, delay } from '../utils/helpers';

// === Priority 1: LinkedIn (broadest reach, verified working) ===
import { LinkedInScraper } from './linkedin';

// === Priority 2: Peviitor API (clean JSON API, 190+ results) ===
import { PeviitorScraper } from './peviitor';

// === Priority 3: Romanian job boards ===
import { BestJobsScraper } from './bestjobs';
import { HipoScraper } from './hipo';
import { StagiiPeBuneScraper } from './stagiipebune';
import { EJobsScraper } from './ejobs';
import { DevJobScraper } from './devjob';

// === Priority 4: International with Romania filter ===
import { IndeedScraper } from './indeed';
import { GlassdoorScraper } from './glassdoor';

// === Priority 5: Additional Romanian boards ===
import { CariereScraper } from './cariere';
import { UndeLucramScraper } from './undelucram';

// === Lower priority: Remote/international boards ===
import { WeWorkRemotelyScraper } from './weworkremotely';
import { RedditScraper } from './reddit';
import { RemoteOKScraper } from './remoteok';

// Removed (confirmed dead/broken):
// - JustJoinIT: API returns 404, discontinued
// - Juniors.ro: 403 blocked
// - Profession.ro: domain doesn't exist
// - MyJob.ro: mostly labor jobs, not tech
// - OLX.ro: 403 blocked by Cloudflare
// - StackOverflow Jobs: 403 blocked
// - JobRadar24.ro: WAF-blocked, requires headless browser

import { BaseScraper } from './base-scraper';

/**
 * All registered scrapers, ordered by priority.
 * Romanian-focused sources first.
 */
export const scrapers: BaseScraper[] = [
  // Primary sources (verified working or high-value)
  new LinkedInScraper(),       // Working: 997 jobs, broadest reach
  new PeviitorScraper(),       // Working: JSON API, 190+ results
  new BestJobsScraper(),       // Next.js with __NEXT_DATA__
  new HipoScraper(),           // Partially SSR, link extraction
  new StagiiPeBuneScraper(),   // Internships, 110+ listings

  // May work with retries (block sometimes)
  new EJobsScraper(),          // Largest Romanian board, may block
  new DevJobScraper(),         // Romanian dev board, SPA (limited)

  // Additional Romanian boards
  new CariereScraper(),        // WordPress SSR, easy parse
  new UndeLucramScraper(),     // Employer reviews + jobs, AJAX

  // International (often blocked but worth trying)
  new IndeedScraper(),
  new GlassdoorScraper(),

  // Remote/international (lower priority for Romania)
  new WeWorkRemotelyScraper(),
  new RedditScraper(),
  new RemoteOKScraper(),
];

export interface AggregatedResult {
  totalJobs: number;
  newJobs: number;
  results: ScraperResult[];
  duration: number;
}

/**
 * Run all scrapers concurrently, deduplicate by URL, and upsert into the database.
 */
export async function runAllScrapers(): Promise<AggregatedResult> {
  const startTime = Date.now();
  console.log(`\n========================================`);
  console.log(`Starting scrape run at ${new Date().toISOString()}`);
  console.log(`Running ${scrapers.length} scrapers...`);
  console.log(`========================================\n`);

  // Run scrapers SEQUENTIALLY with a gap between each to avoid
  // burst traffic that looks like a bot attack from a single IP
  const results: ScraperResult[] = [];
  const allJobs: Job[] = [];

  for (let i = 0; i < scrapers.length; i++) {
    const scraper = scrapers[i];
    const scraperName = scraper.name;

    try {
      const result = await scraper.scrape();
      results.push(result);
      if (result.success) {
        allJobs.push(...result.jobs);
        console.log(`[${scraperName}] Success: ${result.jobs.length} jobs`);
      } else {
        console.warn(`[${scraperName}] Failed: ${result.error}`);
      }
    } catch (err) {
      console.error(`[${scraperName}] Rejected: ${err}`);
      results.push({
        jobs: [],
        source: scraperName,
        success: false,
        error: String(err),
      });
    }

    // Wait 3-5s between scrapers so requests are spread out
    if (i < scrapers.length - 1) {
      await delay(3000 + Math.random() * 2000);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueJobs = allJobs.filter(job => {
    const key = job.url.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Drop jobs older than 2 months — no point storing stale listings
  const TWO_MONTHS_AGO = new Date();
  TWO_MONTHS_AGO.setMonth(TWO_MONTHS_AGO.getMonth() - 2);
  const twoMonthsCutoff = TWO_MONTHS_AGO.getTime();

  const freshJobs = uniqueJobs.filter(job => {
    if (!job.posted_at) return true; // Keep jobs with unknown dates (they might be recent)
    const postedTime = new Date(job.posted_at).getTime();
    if (isNaN(postedTime)) return true;
    return postedTime >= twoMonthsCutoff;
  });

  const droppedCount = uniqueJobs.length - freshJobs.length;
  if (droppedCount > 0) {
    console.log(`Dropped ${droppedCount} jobs older than 2 months`);
  }

  // Ensure all jobs have IDs
  const jobsWithIds = freshJobs.map(job => ({
    ...job,
    id: job.id || generateJobId(job.url, job.title, job.company),
  }));

  // Upsert to database
  let newJobs = 0;
  try {
    newJobs = await upsertJobs(jobsWithIds as unknown as Record<string, unknown>[]);
    console.log(`\nUpserted ${newJobs} jobs to database`);
  } catch (err) {
    console.error('Failed to upsert jobs to database:', err);
  }

  const duration = Date.now() - startTime;
  console.log(`\n========================================`);
  console.log(`Scrape run completed in ${(duration / 1000).toFixed(1)}s`);
  console.log(`Total unique jobs found: ${uniqueJobs.length} (${freshJobs.length} within 2 months)`);
  console.log(`Jobs stored in database: ${newJobs}`);
  console.log(`========================================\n`);

  return {
    totalJobs: freshJobs.length,
    newJobs,
    results,
    duration,
  };
}

// Allow running as standalone script
if (require.main === module) {
  runAllScrapers()
    .then(result => {
      console.log('Scrape complete:', {
        totalJobs: result.totalJobs,
        newJobs: result.newJobs,
        duration: `${(result.duration / 1000).toFixed(1)}s`,
        sources: result.results.map(r => ({
          source: r.source,
          success: r.success,
          jobs: r.jobs.length,
          error: r.error,
        })),
      });
      process.exit(0);
    })
    .catch(err => {
      console.error('Scrape failed:', err);
      process.exit(1);
    });
}
