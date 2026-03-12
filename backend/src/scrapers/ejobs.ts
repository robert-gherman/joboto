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

export class EJobsScraper extends BaseScraper {
  name = 'eJobs';
  baseUrl = 'https://www.ejobs.ro';

  private searchUrls = [
    // Direct category URL patterns that eJobs uses
    'https://www.ejobs.ro/locuri-de-munca/it-software',
    'https://www.ejobs.ro/locuri-de-munca/it-software/page2',
    'https://www.ejobs.ro/locuri-de-munca/it-software/page3',
    // Search queries
    'https://www.ejobs.ro/locuri-de-munca?keywords=frontend',
    'https://www.ejobs.ro/locuri-de-munca?keywords=react',
    'https://www.ejobs.ro/locuri-de-munca?keywords=javascript',
    'https://www.ejobs.ro/locuri-de-munca?keywords=web+developer',
    'https://www.ejobs.ro/locuri-de-munca?keywords=full+stack',
    'https://www.ejobs.ro/locuri-de-munca?keywords=programator',
    'https://www.ejobs.ro/locuri-de-munca?keywords=junior+developer',
    'https://www.ejobs.ro/locuri-de-munca?keywords=developer+intern',
    'https://www.ejobs.ro/locuri-de-munca?keywords=node.js',
    'https://www.ejobs.ro/locuri-de-munca?keywords=vue',
    'https://www.ejobs.ro/locuri-de-munca?keywords=angular',
    'https://www.ejobs.ro/locuri-de-munca?keywords=typescript',
    'https://www.ejobs.ro/locuri-de-munca?keywords=html+css',
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

      // Deduplicate by URL
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

    // eJobs uses card-based layouts for job listings
    // Try many selector variations as eJobs changes their HTML frequently
    $(
      'div.JobCard, article.job-card, div[data-job-id], .JCContent, div.jc-content, ' +
      '.CardJob, div[class*="JobCard"], div[class*="jobCard"], ' +
      'a[class*="CardOffer"], div[class*="CardOffer"], ' +
      'div[class*="job-list"] > div, .results-list > div'
    ).each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find(
          'h2 a, .job-title a, .JCTitle a, a.JCTitle, .jc-title a, h2.job-title a, ' +
          'a[class*="CardTitle"], h2[class*="title"], h3[class*="title"], ' +
          'a[class*="title"], .card-title a'
        );
        const title = cleanText(titleEl.text());
        if (!title) return;

        let url = titleEl.attr('href') || el.find('a').first().attr('href') || '';
        if (url && !url.startsWith('http')) {
          url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        }

        const company = cleanText(
          el.find(
            '.JCCompany, .company-name, .jc-company, span[class*="company"], ' +
            'a[class*="company"], div[class*="Company"], .employer'
          ).text()
        );

        const location = cleanText(
          el.find(
            '.JCLocation, .job-location, .jc-location, span[class*="location"], ' +
            'div[class*="Location"], .oras'
          ).text()
        ) || 'Romania';

        const description = cleanText(
          el.find(
            '.JCDescription, .job-description, .jc-description, p[class*="desc"], ' +
            'div[class*="Description"]'
          ).text()
        );

        const dateStr = cleanText(
          el.find('.JCDate, .job-date, .jc-date, span[class*="date"], time').text()
        );

        const salary = cleanText(
          el.find('.JCSalary, .salary, .jc-salary, span[class*="salary"], div[class*="Salary"]').text()
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
