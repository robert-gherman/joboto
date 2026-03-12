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

export class IndeedScraper extends BaseScraper {
  name = 'Indeed';
  baseUrl = 'https://ro.indeed.com';

  private searchUrls = [
    'https://ro.indeed.com/jobs?q=react+frontend+developer&l=Romania',
    'https://ro.indeed.com/jobs?q=javascript+developer&l=Romania',
    'https://ro.indeed.com/jobs?q=frontend+developer&l=Romania',
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
          await delay(this.crawlDelay + 500);
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

    // Indeed uses these selectors for job cards
    $(
      '.job_seen_beacon, .jobsearch-ResultsList .result, div[class*="cardOutline"], .tapItem, div[data-jk]'
    ).each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find(
          'h2.jobTitle a, a[data-jk], .jobTitle span, h2 a span[title], a.jcs-JobTitle'
        );
        const title = cleanText(
          titleEl.attr('title') || titleEl.find('span[title]').attr('title') || titleEl.text()
        );
        if (!title) return;

        const jobKey = el.attr('data-jk') ||
          titleEl.attr('data-jk') ||
          el.find('a[data-jk]').attr('data-jk') || '';

        let url = '';
        if (jobKey) {
          url = `${this.baseUrl}/viewjob?jk=${jobKey}`;
        } else {
          const href = titleEl.attr('href') || el.find('a').first().attr('href') || '';
          url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        }

        const company = cleanText(
          el.find(
            '.companyName, span[data-testid="company-name"], .company, a[data-tn-element="companyName"]'
          ).text()
        );

        const location = cleanText(
          el.find(
            '.companyLocation, div[data-testid="text-location"], .location, span.location'
          ).text()
        ) || 'Romania';

        const description = cleanText(
          el.find(
            '.job-snippet, .job-snippet ul li, div[class*="snippet"], td.snip'
          ).text()
        );

        const dateStr = cleanText(
          el.find(
            '.date, span[class*="date"], .result-footer span.date'
          ).text()
        );

        const salary = cleanText(
          el.find(
            '.salary-snippet, div[class*="salary"], .estimated-salary, span[class*="salary"]'
          ).text()
        ) || undefined;

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
          salary,
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
