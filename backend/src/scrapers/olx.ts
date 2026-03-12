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
 * OLX.ro Jobs section - Romanian classifieds with job listings
 */
export class OLXJobsScraper extends BaseScraper {
  name = 'OLX Jobs';
  baseUrl = 'https://www.olx.ro';

  private searchUrls = [
    'https://www.olx.ro/locuri-de-munca/q-frontend-developer/',
    'https://www.olx.ro/locuri-de-munca/q-react-developer/',
    'https://www.olx.ro/locuri-de-munca/q-web-developer/',
    'https://www.olx.ro/locuri-de-munca/q-javascript/',
    'https://www.olx.ro/locuri-de-munca/q-programator/',
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

    // OLX uses card-based listing layout
    $(
      'div[data-cy="l-card"], .offer-wrapper, .listing-grid-container > div, a[class*="css-"]'
    ).each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find('h6, h4, h3, [class*="title"]');
        const title = cleanText(titleEl.text());
        if (!title) return;

        // Filter: only include dev/IT related jobs
        const titleLower = title.toLowerCase();
        const isRelevant = ['developer', 'frontend', 'front-end', 'react', 'javascript',
          'web developer', 'programator', 'full stack', 'node', 'angular', 'vue',
          'typescript', 'html', 'css', 'software', 'it', 'ui'].some(kw => titleLower.includes(kw));
        if (!isRelevant) return;

        let url = el.attr('href') || el.find('a').first().attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        const location = cleanText(
          el.find('[class*="location"], .space, p[class*="breadcrumb"]').text()
        ) || 'Romania';

        const priceText = cleanText(
          el.find('[class*="price"], .price').text()
        );
        const salary = priceText || undefined;

        const dateStr = cleanText(
          el.find('[class*="date"], [class*="bottom"] span').text()
        );

        if (!title || !url) return;

        const job: Job = {
          id: generateJobId(url, title, 'OLX Listing'),
          title,
          company: 'Posted on OLX',
          location,
          type: detectWorkType(title, '', location),
          experience_level: detectExperienceLevel(title, ''),
          description: title,
          url,
          source: this.name,
          salary,
          posted_at: normalizeDate(dateStr),
          scraped_at: new Date().toISOString(),
          tags: extractTags(title, ''),
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
