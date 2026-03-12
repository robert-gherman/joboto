import * as cheerio from 'cheerio';
import { BaseScraper } from './base-scraper';
import { Job, ScraperResult } from '../types';
import {
  detectExperienceLevel,
  detectWorkType,
  extractTags,
  normalizeDate,
  generateJobId,
  cleanText,
  delay,
} from '../utils/helpers';

/**
 * Juniors.ro - Romanian job board specifically for juniors and entry-level positions
 */
export class JuniorsScraper extends BaseScraper {
  name = 'Juniors.ro';
  baseUrl = 'https://www.juniors.ro';

  private searchUrls = [
    'https://www.juniors.ro/jobs?q=frontend',
    'https://www.juniors.ro/jobs?q=react',
    'https://www.juniors.ro/jobs?q=javascript',
    'https://www.juniors.ro/jobs?q=web+developer',
    'https://www.juniors.ro/jobs?q=full+stack',
    'https://www.juniors.ro/jobs?q=html+css',
    'https://www.juniors.ro/jobs?q=developer',
    'https://www.juniors.ro/jobs',
  ];

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];

      for (const searchUrl of this.searchUrls) {
        try {
          const html = await this.fetchPage(searchUrl);
          const jobs = this.parseListings(html);
          allJobs.push(...jobs);
          this.log(`Found ${jobs.length} jobs from ${searchUrl}`);
          await delay(this.crawlDelay);
        } catch (err) {
          this.logError(`Failed to scrape ${searchUrl}`, err);
        }
      }

      const seen = new Set<string>();
      const uniqueJobs = allJobs.filter(job => {
        if (seen.has(job.url)) return false;
        seen.add(job.url);
        return true;
      });

      this.log(`Total unique jobs: ${uniqueJobs.length}`);
      return this.success(uniqueJobs);
    } catch (error) {
      this.logError('Scraping failed', error);
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }

  private parseListings(html: string): Job[] {
    const $ = cheerio.load(html);
    const jobs: Job[] = [];

    // Try multiple selector patterns for juniors.ro
    $(
      '.job-card, .job-listing, .job-item, article[class*="job"], div[class*="job-card"], .listing-item, .card'
    ).each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find(
          'h2 a, h3 a, h4 a, a[class*="title"], .job-title a, .card-title a, a.title'
        );
        const title = cleanText(titleEl.text());
        if (!title) return;

        let url = titleEl.attr('href') || el.find('a').first().attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        const company = cleanText(
          el.find(
            '.company, .company-name, span[class*="company"], .employer, .firma'
          ).text()
        );

        const location = cleanText(
          el.find(
            '.location, span[class*="location"], .city, .oras'
          ).text()
        ) || 'Romania';

        const description = cleanText(
          el.find(
            '.description, .snippet, p[class*="desc"], .job-description, .card-text'
          ).text()
        );

        const dateStr = cleanText(
          el.find('time, .date, span[class*="date"], .posted').text()
        );

        if (!title || !url) return;

        // Since this is juniors.ro, default experience to junior/intern
        const expLevel = detectExperienceLevel(title, description);
        const finalExp = expLevel === 'mid' ? 'junior' : expLevel; // Default to junior for this site

        const job: Job = {
          id: generateJobId(url, title, company),
          title,
          company: company || 'Unknown Company',
          location,
          type: detectWorkType(title, description, location),
          experience_level: finalExp,
          description: description || title,
          url,
          source: this.name,
          posted_at: normalizeDate(dateStr),
          scraped_at: new Date().toISOString(),
          tags: extractTags(title, description),
          is_active: true,
        };

        jobs.push(job);
      } catch {
        // Skip malformed entries
      }
    });

    return jobs;
  }
}
