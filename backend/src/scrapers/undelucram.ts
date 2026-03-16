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
 * UndeLucram.ro — Romanian employer review + job board.
 * SPA that loads job cards via AJAX. The response is JSON with an `html` field
 * containing pre-rendered HTML job cards.
 * Job cards use `[data-job-item]` selector.
 * Date format: "DD.MM.YYYY" (e.g. "13.03.2026").
 */
export class UndeLucramScraper extends BaseScraper {
  name = 'UndeLucram';
  baseUrl = 'https://www.undelucram.ro';
  protected crawlDelay = 2500;

  // URL segments: /ro/locuri-de-munca/{job-type}/{industry}/{sort}
  // it-c = IT&C industry, sort-date = newest first
  private searchUrls = [
    'https://www.undelucram.ro/ro/locuri-de-munca/full-time/it-c/sort-date',
    'https://www.undelucram.ro/ro/locuri-de-munca/full-time/it-c/sort-date/page-2',
    'https://www.undelucram.ro/ro/locuri-de-munca/full-time/it-c/sort-date/page-3',
    'https://www.undelucram.ro/ro/locuri-de-munca/part-time/it-c/sort-date',
    'https://www.undelucram.ro/ro/locuri-de-munca/full-time/it-c/entry-level/sort-date',
    'https://www.undelucram.ro/ro/locuri-de-munca/full-time/it-c/student-internship/sort-date',
    'https://www.undelucram.ro/ro/locuri-de-munca/full-time/it-c/bucuresti/sort-date',
    'https://www.undelucram.ro/ro/locuri-de-munca/full-time/it-c/cluj/sort-date',
    'https://www.undelucram.ro/ro/locuri-de-munca/full-time/it-c/timisoara/sort-date',
    'https://www.undelucram.ro/ro/locuri-de-munca/full-time/it-c/iasi/sort-date',
  ];

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const searchUrl of this.searchUrls) {
        try {
          const html = await this.fetchPage(searchUrl);
          const jobs = this.parseResponse(html);
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
   * Parse DD.MM.YYYY date string to ISO.
   */
  private parseDateDMY(dateStr: string): string | null {
    if (!dateStr) return null;
    const match = dateStr.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private parseResponse(rawHtml: string): Job[] {
    // The response might be JSON with an html field, or plain HTML
    let html = rawHtml;
    try {
      const parsed = JSON.parse(rawHtml);
      if (parsed.html) {
        html = parsed.html;
      }
    } catch {
      // Not JSON, use as raw HTML
    }

    return this.parseHtml(html);
  }

  private parseHtml(html: string): Job[] {
    const $ = cheerio.load(html);
    const jobs: Job[] = [];

    $('[data-job-item]').each((_index, element) => {
      try {
        const el = $(element);

        // Title from h4 inside a link
        const titleEl = el.find('h4').first();
        const title = cleanText(titleEl.text());
        if (!title) return;

        // URL from the parent anchor or the first link
        let url =
          titleEl.closest('a').attr('href') ||
          el.find('a[href*="/locuri-de-munca/"]').first().attr('href') ||
          '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }
        if (!url) return;

        // Company from h5
        const company = cleanText(el.find('h5').first().text()) || 'Unknown Company';

        // Location — look for text nodes mentioning cities or Remote/Hybrid
        const allText = cleanText(el.text());
        let location = 'Romania';
        const locationPatterns = [
          /\b(Bucuresti|Bucharest|Cluj|Timisoara|Iasi|Brasov|Sibiu|Constanta|Oradea|Craiova)\b/i,
          /\b(Remote|Hybrid)\b/i,
        ];
        for (const pattern of locationPatterns) {
          const m = allText.match(pattern);
          if (m) {
            location = m[1];
            break;
          }
        }

        // Date — look for DD.MM.YYYY pattern in text
        let postedAt: string | null = null;
        const dateMatch = allText.match(/(\d{2}\.\d{2}\.\d{4})/);
        if (dateMatch) {
          postedAt = this.parseDateDMY(dateMatch[1]);
        }

        // Work type detection
        const locLower = allText.toLowerCase();
        let workType = detectWorkType(title, allText, location);
        if (locLower.includes('remote')) workType = 'remote';
        if (locLower.includes('hybrid')) workType = 'hybrid';

        const description = title;

        const job: Job = {
          id: generateJobId(url, title, company),
          title,
          company,
          location,
          type: workType,
          experience_level: detectExperienceLevel(title, allText),
          description,
          url,
          source: this.name,
          posted_at: postedAt,
          scraped_at: new Date().toISOString(),
          tags: extractTags(title, allText),
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
