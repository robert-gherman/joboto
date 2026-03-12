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

export class StackOverflowScraper extends BaseScraper {
  name = 'StackOverflow';
  baseUrl = 'https://stackoverflow.com';

  // Stack Overflow Jobs redirects to their talent platform, but we can try
  // the collective/jobs search pages as well as their partner site
  private searchUrls = [
    'https://stackoverflow.com/jobs?q=react+frontend&l=Romania&d=50&u=Km',
    'https://stackoverflow.com/jobs?q=javascript+developer&l=Romania&d=50&u=Km',
    // Also try the newer Stack Overflow Talent pages
    'https://stackoverflow.com/jobs/companies?q=react&l=Romania',
  ];

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];

      for (const searchUrl of this.searchUrls) {
        try {
          const html = await this.fetchPage(searchUrl);
          const jobs = this.parseListings(html);
          allJobs.push(...jobs);
          this.log(`Found ${jobs.length} jobs from search`);
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

    // Stack Overflow job listing selectors
    $(
      'div.js-result, div[data-jobid], .listResults .job, .-job, div[class*="s-card"], div.js-search-result'
    ).each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find(
          'h2 a, a[class*="s-link"], .job-link, a.s-link, h3 a'
        );
        const title = cleanText(titleEl.text());
        if (!title) return;

        let url = titleEl.attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        const company = cleanText(
          el.find(
            'h3.fc-black-700 span a, .employer, span[class*="company"], .fc-black-700 a'
          ).text()
        );

        const location = cleanText(
          el.find(
            '.fc-black-500, .location, span[class*="location"], .job-location'
          ).text()
        ) || 'Romania';

        const description = cleanText(
          el.find('.job-snippet, .description, p.fs-body1, .-description').text()
        );

        const dateStr = cleanText(
          el.find(
            '.fc-black-400, span[class*="date"], .posted-date'
          ).text()
        );

        // SO lists tech tags as badges
        const tagsFromPage: string[] = [];
        el.find('a.post-tag, .tags a, span[class*="tag"], .js-post-tag-list-item').each(
          (_i, tagEl) => {
            const t = cleanText($(tagEl).text());
            if (t) tagsFromPage.push(t.toLowerCase());
          }
        );

        const salary = cleanText(
          el.find('.salary, span[class*="salary"]').text()
        ) || undefined;

        if (!title || !url) return;

        const autoTags = extractTags(title, description);
        const combinedTags = [...new Set([...autoTags, ...tagsFromPage])];

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
          salary,
          posted_at: normalizeDate(dateStr),
          scraped_at: new Date().toISOString(),
          tags: combinedTags,
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
