import * as cheerio from 'cheerio';
import { BaseScraper } from './base-scraper';
import { Job, ScraperResult } from '../types';
import {
  detectExperienceLevel,
  detectWorkType,
  extractTags,
  generateJobId,
  cleanText,
  delay,
} from '../utils/helpers';

/**
 * Cariere.ro — Romanian job board built on WordPress.
 * Server-side rendered HTML, easy to parse with Cheerio.
 * Job cards use `article.loadmore-item` with standard selectors.
 * Date format: "martie 9, 2026 - mai 5, 2026" (Romanian month names).
 */
export class CariereScraper extends BaseScraper {
  name = 'Cariere';
  baseUrl = 'https://cariere.ro';
  protected crawlDelay = 2500;

  private searchUrls = [
    'https://cariere.ro/joburi/?search_keywords=frontend+developer',
    'https://cariere.ro/joburi/?search_keywords=frontend',
    'https://cariere.ro/joburi/?search_keywords=react+developer',
    'https://cariere.ro/joburi/?search_keywords=javascript+developer',
    'https://cariere.ro/joburi/?search_keywords=web+developer',
    'https://cariere.ro/joburi/?search_keywords=full+stack+developer',
    'https://cariere.ro/joburi/?search_keywords=typescript',
    'https://cariere.ro/joburi/?search_keywords=angular+developer',
    'https://cariere.ro/joburi/?search_keywords=vue+developer',
    'https://cariere.ro/joburi/?search_keywords=node.js+developer',
    // Page 2 for broader searches
    'https://cariere.ro/joburi/page/2/?search_keywords=frontend+developer',
    'https://cariere.ro/joburi/page/2/?search_keywords=react+developer',
  ];

  // Romanian month name → month index
  private static readonly RO_MONTHS: Record<string, number> = {
    ianuarie: 0, februarie: 1, martie: 2, aprilie: 3,
    mai: 4, iunie: 5, iulie: 6, august: 7,
    septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11,
  };

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const searchUrl of this.searchUrls) {
        try {
          const html = await this.fetchPage(searchUrl);
          const jobs = this.parseListings(html);
          allJobs.push(...jobs);
          successCount++;
          if (jobs.length > 0) {
            this.log(`Found ${jobs.length} jobs from search`);
          }
          await delay(this.crawlDelay + Math.random() * 1500);
        } catch (err) {
          failCount++;
          this.logError('Failed to scrape search URL', err);
          await delay(5000 + Math.random() * 3000);
        }
      }

      // Deduplicate by URL
      const seen = new Set<string>();
      const uniqueJobs = allJobs.filter((job) => {
        if (seen.has(job.url)) return false;
        seen.add(job.url);
        return true;
      });

      this.log(`Scraped ${successCount}/${this.searchUrls.length} URLs (${failCount} failed)`);
      this.log(`Total unique jobs: ${uniqueJobs.length}`);
      return this.success(uniqueJobs);
    } catch (error) {
      this.logError('Scraping failed', error);
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Parse Romanian date string like "martie 9, 2026 - mai 5, 2026"
   * Returns the start date as ISO string, or null.
   */
  private parseRomanianDate(dateStr: string): string | null {
    if (!dateStr) return null;

    // The date field is "startDate - endDate", take the start part
    const startPart = dateStr.split('-')[0].trim();

    // Match: "martie 9, 2026" or "martie 9 2026"
    const match = startPart.match(/^(\w+)\s+(\d{1,2}),?\s*(\d{4})$/i);
    if (!match) return null;

    const [, monthName, day, year] = match;
    const monthIndex = CariereScraper.RO_MONTHS[monthName.toLowerCase()];
    if (monthIndex === undefined) return null;

    const date = new Date(parseInt(year), monthIndex, parseInt(day));
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private parseListings(html: string): Job[] {
    const $ = cheerio.load(html);
    const jobs: Job[] = [];

    $('article.loadmore-item').each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find('h3 a');
        const title = cleanText(titleEl.text());
        if (!title) return;

        let url = titleEl.attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }
        if (!url) return;

        const company = cleanText(el.find('.company a').first().text()) || 'Unknown Company';
        const location = cleanText(el.find('.location a').text()) || 'Romania';
        const jobType = cleanText(el.find('.job-type a').text());
        const dateText = cleanText(el.find('.date').text());
        const description = cleanText(el.find('.category a').text()) || title;

        const postedAt = this.parseRomanianDate(dateText);

        // Detect work type from location/title (cariere.ro sometimes shows "Remote" in location)
        const locLower = location.toLowerCase();
        let workType = detectWorkType(title, description, location);
        if (locLower.includes('remote')) workType = 'remote';
        if (locLower.includes('hybrid')) workType = 'hybrid';

        // Map job type text
        if (jobType && jobType.toLowerCase().includes('remote')) workType = 'remote';

        const job: Job = {
          id: generateJobId(url, title, company),
          title,
          company,
          location,
          type: workType,
          experience_level: detectExperienceLevel(title, description),
          description: description || title,
          url,
          source: this.name,
          posted_at: postedAt,
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
