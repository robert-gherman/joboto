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
 * BestJobs.eu - Major Romanian job board.
 * Built with Next.js — job data is in __NEXT_DATA__.props.pageProps.jobListCardsFromServer.items[]
 * Each item has: id, slug, title, companyName, locations, salary, estimatedSalary, workplaceJob
 */
export class BestJobsScraper extends BaseScraper {
  name = 'BestJobs';
  baseUrl = 'https://www.bestjobs.eu';

  private searchUrls = [
    'https://www.bestjobs.eu/en/jobs?keyword=frontend+developer&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=react+developer&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=react&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=javascript&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=web+developer&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=full+stack&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=typescript&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=junior+developer&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=node.js&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=angular&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=vue&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=programator&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=software+developer&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=intern+developer&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=html+css&location=romania',
    'https://www.bestjobs.eu/en/jobs?keyword=next.js&location=romania',
  ];

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];

      for (const searchUrl of this.searchUrls) {
        try {
          const html = await this.fetchPage(searchUrl);
          const jobs = this.parseNextData(html);
          allJobs.push(...jobs);
          this.log(`Found ${jobs.length} jobs from ${searchUrl}`);
          await delay(this.crawlDelay);
        } catch (err) {
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

  /**
   * Parse job data from Next.js __NEXT_DATA__ JSON.
   * Path: props.pageProps.jobListCardsFromServer.items[]
   */
  private parseNextData(html: string): Job[] {
    const jobs: Job[] = [];

    try {
      const $ = cheerio.load(html);
      const nextDataScript = $('#__NEXT_DATA__').html();
      if (!nextDataScript) {
        this.log('No __NEXT_DATA__ found, trying HTML fallback');
        return this.parseHtmlFallback(html);
      }

      const nextData = JSON.parse(nextDataScript);
      const pageProps = nextData?.props?.pageProps;
      if (!pageProps) return jobs;

      // Main job data path
      const serverData = pageProps.jobListCardsFromServer;
      const items = serverData?.items;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return this.parseHtmlFallback(html);
      }

      for (const item of items) {
        try {
          const title = cleanText(String(item.title || ''));
          if (!title) continue;

          // Build URL from slug
          const slug = item.slug || '';
          const url = slug
            ? `${this.baseUrl}/en/job/${slug}`
            : `${this.baseUrl}/en/job/${item.id || ''}`;

          const company = cleanText(String(item.companyName || 'Unknown Company'));

          // Locations is usually an array or string
          let location = 'Romania';
          if (item.locations) {
            if (Array.isArray(item.locations)) {
              location = item.locations.map((l: unknown) => {
                if (typeof l === 'string') return l;
                if (typeof l === 'object' && l !== null) return (l as Record<string, unknown>).name || (l as Record<string, unknown>).city || '';
                return '';
              }).filter(Boolean).join(', ') || 'Romania';
            } else if (typeof item.locations === 'string') {
              location = item.locations;
            }
          }

          // Salary
          let salary: string | undefined;
          if (item.salary && typeof item.salary === 'object') {
            const s = item.salary as Record<string, unknown>;
            salary = [s.min, s.max, s.currency].filter(Boolean).join(' ');
          } else if (item.salary) {
            salary = String(item.salary);
          }
          if (!salary && item.estimatedSalary) {
            salary = `~${item.estimatedSalary} (estimated)`;
          }

          // Work type from workplaceJob field or title
          const workplaceType = String(item.workplaceJob || item.workplace || '').toLowerCase();
          let workType: 'remote' | 'hybrid' | 'onsite' = 'onsite';
          if (workplaceType.includes('remote') || title.toLowerCase().includes('remote')) {
            workType = 'remote';
          } else if (workplaceType.includes('hybrid')) {
            workType = 'hybrid';
          } else {
            workType = detectWorkType(title, '', location);
          }

          // Extract real publication date from the data
          const dateRaw = item.date || item.createdAt || item.publishedAt || item.postedAt || item.created_at || '';
          let postedAt: string | null = null;
          if (dateRaw) {
            const parsed = new Date(String(dateRaw));
            if (!isNaN(parsed.getTime())) {
              postedAt = parsed.toISOString();
            }
          }

          const job: Job = {
            id: generateJobId(url, title, company),
            title,
            company,
            location: cleanText(location),
            type: workType,
            experience_level: detectExperienceLevel(title, ''),
            description: title,
            url,
            source: this.name,
            salary: salary || undefined,
            posted_at: postedAt,
            scraped_at: new Date().toISOString(),
            tags: extractTags(title, ''),
            is_active: true,
          };

          jobs.push(job);
        } catch {
          // Skip malformed items
        }
      }
    } catch (err) {
      this.logError('Failed to parse __NEXT_DATA__', err);
      return this.parseHtmlFallback(html);
    }

    return jobs;
  }

  /**
   * Fallback: parse job links directly from HTML
   */
  private parseHtmlFallback(html: string): Job[] {
    const $ = cheerio.load(html);
    const jobs: Job[] = [];

    $('a[href*="/job/"], a[href*="/en/job/"], a[href*="/ro/job/"]').each((_index, element) => {
      try {
        const el = $(element);
        const title = cleanText(el.text());
        if (!title || title.length < 5 || title.length > 200) return;

        let url = el.attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        if (!url) return;

        const job: Job = {
          id: generateJobId(url, title, ''),
          title,
          company: 'Unknown Company',
          location: 'Romania',
          type: detectWorkType(title, '', ''),
          experience_level: detectExperienceLevel(title, ''),
          description: title,
          url,
          source: this.name,
          posted_at: null,
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
