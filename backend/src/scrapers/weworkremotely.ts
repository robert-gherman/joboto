import * as cheerio from 'cheerio';
import { BaseScraper } from './base-scraper';
import { Job, ScraperResult } from '../types';
import {
  detectExperienceLevel,
  extractTags,
  normalizeDate,
  generateJobId,
  cleanText,
  delay,
} from '../utils/helpers';

export class WeWorkRemotelyScraper extends BaseScraper {
  name = 'WeWorkRemotely';
  baseUrl = 'https://weworkremotely.com';

  private searchUrls = [
    'https://weworkremotely.com/remote-jobs/search?term=react+frontend',
    'https://weworkremotely.com/remote-jobs/search?term=javascript+developer',
    'https://weworkremotely.com/remote-jobs/search?term=frontend+developer',
    'https://weworkremotely.com/categories/remote-front-end-programming-jobs',
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

    // WeWorkRemotely uses a specific list structure
    $(
      'li.feature, li.new, section.jobs article li, ul li[class*="feature"], .jobs-list li'
    ).each((_index, element) => {
      try {
        const el = $(element);

        // Skip headers/ads
        if (el.hasClass('ad') || el.hasClass('view-all')) return;

        const linkEl = el.find('a[href*="/remote-jobs/"]').last();
        if (!linkEl.length) return;

        let url = linkEl.attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url}`;
        }

        const title = cleanText(
          el.find(
            '.title, span[class*="title"], h3, .listing-header-new h3'
          ).text()
        );
        if (!title) return;

        const company = cleanText(
          el.find(
            '.company, span[class*="company"], .listing-company-name'
          ).text()
        );

        const region = cleanText(
          el.find(
            '.region, span[class*="region"], .company span.region'
          ).text()
        );

        const dateStr = cleanText(
          el.find('time, span[class*="date"]').attr('datetime') ||
          el.find('time, span[class*="date"]').text()
        );

        const tagsFromPage: string[] = [];
        el.find('.tag, .tags span, .listing-tag').each((_i, tagEl) => {
          const t = cleanText($(tagEl).text());
          if (t) tagsFromPage.push(t.toLowerCase());
        });

        if (!title || !url) return;

        const autoTags = extractTags(title, company);
        const combinedTags = [...new Set([...autoTags, ...tagsFromPage])];

        const job: Job = {
          id: generateJobId(url, title, company),
          title,
          company: company || 'Unknown Company',
          location: region || 'Remote (Worldwide)',
          type: 'remote', // All WWR jobs are remote
          experience_level: detectExperienceLevel(title, ''),
          description: title,
          url,
          source: this.name,
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
