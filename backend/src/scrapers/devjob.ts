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

export class DevJobScraper extends BaseScraper {
  name = 'DevJob';
  baseUrl = 'https://devjob.ro';

  private searchUrls = [
    'https://devjob.ro/jobs?q=react+frontend',
    'https://devjob.ro/jobs?q=javascript+developer',
    'https://devjob.ro/jobs?q=frontend',
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

    // DevJob.ro is a Romanian dev-specific job board
    $(
      '.job-item, .job-card, .job-listing, article.job, div[class*="job-row"], .listing-card'
    ).each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find(
          'h2 a, h3 a, a[class*="title"], .job-title a, .listing-title a'
        );
        const title = cleanText(titleEl.text());
        if (!title) return;

        let url = titleEl.attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        const company = cleanText(
          el.find(
            '.company, .company-name, span[class*="company"], a[class*="company"]'
          ).text()
        );

        const location = cleanText(
          el.find(
            '.location, span[class*="location"], .job-location'
          ).text()
        ) || 'Romania';

        const description = cleanText(
          el.find(
            '.description, .job-description, p[class*="desc"], .snippet'
          ).text()
        );

        const dateStr = cleanText(
          el.find('.date, time, span[class*="date"], .job-date').text()
        );

        const salary = cleanText(
          el.find('.salary, span[class*="salary"], .job-salary').text()
        ) || undefined;

        const tagsFromPage: string[] = [];
        el.find('.tag, .badge, .tech-tag, span[class*="tag"]').each((_i, tagEl) => {
          const tagText = cleanText($(tagEl).text());
          if (tagText) tagsFromPage.push(tagText.toLowerCase());
        });

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
