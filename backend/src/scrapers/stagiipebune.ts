import * as cheerio from 'cheerio';
import { BaseScraper } from './base-scraper';
import { Job, ScraperResult } from '../types';
import {
  detectWorkType,
  extractTags,
  generateJobId,
  cleanText,
  delay,
} from '../utils/helpers';

/**
 * StagiiPeBune.ro - Romanian internship & entry-level job platform
 * Partners include Bitdefender, Adobe, Microsoft, Stripe, UiPath, ING
 * Job URLs follow pattern: /jobs/[company]/[position]
 */
export class StagiiPeBuneScraper extends BaseScraper {
  name = 'StagiiPeBune';
  baseUrl = 'https://stagiipebune.ro';

  // Main page has all listings, also try category/search variations
  private searchUrls = [
    'https://stagiipebune.ro',
    'https://stagiipebune.ro/internships',
    'https://stagiipebune.ro/search?q=developer',
    'https://stagiipebune.ro/search?q=frontend',
    'https://stagiipebune.ro/search?q=web',
    'https://stagiipebune.ro/search?q=react',
    'https://stagiipebune.ro/search?q=javascript',
    'https://stagiipebune.ro/search?q=software',
    'https://stagiipebune.ro/search?q=IT',
    'https://stagiipebune.ro/search?q=programare',
    // Category pages
    'https://stagiipebune.ro/category/web',
    'https://stagiipebune.ro/category/software',
    'https://stagiipebune.ro/category/it',
    'https://stagiipebune.ro/category/development',
  ];

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];

      for (const searchUrl of this.searchUrls) {
        try {
          const html = await this.fetchPage(searchUrl);
          const jobs = this.parseListings(html);
          allJobs.push(...jobs);
          if (jobs.length > 0) {
            this.log(`Found ${jobs.length} jobs from ${searchUrl}`);
          }
          await delay(this.crawlDelay);
        } catch (err) {
          // Many of these URLs may 404 — that's fine, we try all patterns
          this.logError(`Failed to scrape ${searchUrl}`, err);
        }
      }

      const seen = new Set<string>();
      const uniqueJobs = allJobs.filter(job => {
        const key = job.url.toLowerCase().replace(/\/$/, '');
        if (seen.has(key)) return false;
        seen.add(key);
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

    // Find all job/internship links on the page
    // Known pattern: /jobs/[company]/[position]
    $('a[href*="/jobs/"], a[href*="/internship/"], a[href*="/stagiu/"]').each(
      (_index, element) => {
        try {
          const el = $(element);

          let title = cleanText(el.find('h2, h3, h4, span, strong, .title').first().text());
          if (!title) {
            title = cleanText(el.text());
          }
          if (!title || title.length < 5 || title.length > 300) return;
          // Skip navigation links
          if (['home', 'about', 'contact', 'login', 'register'].some(w => title.toLowerCase() === w)) return;

          let url = el.attr('href') || '';
          if (url && !url.startsWith('http')) {
            url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
          }

          // Try to extract company from URL path: /jobs/[company]/[position]
          let company = '';
          try {
            const urlPath = new URL(url).pathname;
            const parts = urlPath.split('/').filter(Boolean);
            if (parts.length >= 2 && parts[0] === 'jobs') {
              company = parts[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }
          } catch {
            // URL parsing failed
          }

          // Also check parent elements for company info
          if (!company) {
            const parent = el.closest('div, li, article, section');
            company = cleanText(
              parent.find('.company, .firma, [class*="company"], [class*="partner"]').text()
            );
          }

          // Check nearby img alt for company name
          if (!company) {
            const nearbyImg = el.find('img[alt]').first();
            if (nearbyImg.length) {
              company = cleanText(nearbyImg.attr('alt') || '');
            }
          }

          const parent = el.closest('div, li, article');
          const location = cleanText(
            parent.find('.location, .city, [class*="location"]').text()
          ) || 'Bucharest, Romania';

          if (!url) return;

          const job: Job = {
            id: generateJobId(url, title, company),
            title,
            company: company || 'Unknown Company',
            location,
            type: detectWorkType(title, '', location),
            experience_level: 'intern', // StagiiPeBune is specifically for internships
            description: title,
            url,
            source: this.name,
            posted_at: new Date().toISOString(),
            scraped_at: new Date().toISOString(),
            tags: extractTags(title, ''),
            is_active: true,
          };

          jobs.push(job);
        } catch {
          // Skip malformed entries
        }
      }
    );

    // Also look for card-based layouts
    $(
      '.internship-card, .stagiu-card, .job-card, article[class*="internship"], ' +
      'div[class*="card"][class*="job"], div[class*="card"][class*="internship"], ' +
      '.listing-item'
    ).each((_index, element) => {
      try {
        const el = $(element);
        const titleEl = el.find('h2, h3, h4, a[class*="title"], .title');
        const title = cleanText(titleEl.text());
        if (!title || title.length < 5) return;

        let url = el.find('a').first().attr('href') || titleEl.find('a').attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        const company = cleanText(
          el.find('.company, .employer, [class*="company"]').text()
        );

        if (!url || !title) return;

        const id = generateJobId(url, title, company);
        if (jobs.some(j => j.id === id)) return;

        const job: Job = {
          id,
          title,
          company: company || 'Unknown Company',
          location: 'Romania',
          type: detectWorkType(title, '', ''),
          experience_level: 'intern',
          description: title,
          url,
          source: this.name,
          posted_at: new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          tags: extractTags(title, ''),
          is_active: true,
        };

        jobs.push(job);
      } catch {
        // Skip
      }
    });

    return jobs;
  }
}
