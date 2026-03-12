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
 * PitestiFirme / Profesia.ro equivalent - Romanian job portal
 * Also covers Profession.ro and similar Romanian platforms
 */
export class ProfesiaScraper extends BaseScraper {
  name = 'Profession';
  baseUrl = 'https://www.profession.ro';

  private searchUrls = [
    'https://www.profession.ro/locuri-de-munca?q=frontend+developer',
    'https://www.profession.ro/locuri-de-munca?q=react',
    'https://www.profession.ro/locuri-de-munca?q=javascript',
    'https://www.profession.ro/locuri-de-munca?q=web+developer',
    'https://www.profession.ro/locuri-de-munca?q=programator+web',
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

    $(
      '.job-card, .job-item, .job-listing, article, div[class*="job"], .listing, .search-result'
    ).each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find('h2 a, h3 a, h4 a, a[class*="title"], .title a');
        const title = cleanText(titleEl.text());
        if (!title) return;

        let url = titleEl.attr('href') || el.find('a').first().attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        const company = cleanText(
          el.find('.company, .firma, span[class*="company"]').text()
        );

        const location = cleanText(
          el.find('.location, .oras, span[class*="location"]').text()
        ) || 'Romania';

        const description = cleanText(
          el.find('.description, p, .snippet').text()
        );

        const dateStr = cleanText(
          el.find('time, .date, span[class*="date"]').text()
        );

        if (!title || !url) return;

        const job: Job = {
          id: generateJobId(url, title, company),
          title,
          company: company || 'Unknown Company',
          location,
          type: detectWorkType(title, description, location),
          experience_level: detectExperienceLevel(title, description),
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
