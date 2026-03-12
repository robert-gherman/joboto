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

export class GlassdoorScraper extends BaseScraper {
  name = 'Glassdoor';
  baseUrl = 'https://www.glassdoor.com';

  private searchUrls = [
    'https://www.glassdoor.com/Job/romania-react-developer-jobs-SRCH_IL.0,7_IN204_KO8,23.htm',
    'https://www.glassdoor.com/Job/romania-frontend-developer-jobs-SRCH_IL.0,7_IN204_KO8,26.htm',
    'https://www.glassdoor.com/Job/romania-javascript-developer-jobs-SRCH_IL.0,7_IN204_KO8,28.htm',
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
          await delay(this.crawlDelay + 1000);
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

    // Glassdoor job listing selectors
    $(
      'li[data-test="jobListing"], .react-job-listing, .jobCard, li.jl, div[class*="JobCard"]'
    ).each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find(
          'a[data-test="job-link"], a.jobLink, .job-title a, a[class*="jobTitle"], .JobCard_jobTitle a'
        );
        const title = cleanText(titleEl.text());
        if (!title) return;

        let url = titleEl.attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        const company = cleanText(
          el.find(
            '.job-search-8wag7x, div[data-test="emp-name"], .employerName, .job-company, span[class*="EmployerName"]'
          ).text()
        );

        const location = cleanText(
          el.find(
            '.job-search-e3h5ci, div[data-test="emp-location"], .location, span[class*="location"]'
          ).text()
        ) || 'Romania';

        const salary = cleanText(
          el.find(
            '.salary-estimate, div[data-test="detailSalary"], span[class*="salary"]'
          ).text()
        ) || undefined;

        const dateStr = cleanText(
          el.find('.job-age, .listing-age, span[class*="age"], div[data-test="job-age"]').text()
        );

        if (!title || !url) return;

        const job: Job = {
          id: generateJobId(url, title, company),
          title,
          company: company || 'Unknown Company',
          location,
          type: detectWorkType(title, '', location),
          experience_level: detectExperienceLevel(title, ''),
          description: title,
          url,
          source: this.name,
          salary,
          posted_at: normalizeDate(dateStr || ''),
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
