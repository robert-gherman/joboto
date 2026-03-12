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

export class LinkedInScraper extends BaseScraper {
  name = 'LinkedIn';
  baseUrl = 'https://www.linkedin.com';

  // Comprehensive search queries for Romania frontend/web/JS jobs
  // f_TPR=r604800 = past week, f_TPR=r2592000 = past month
  // geoId=106670623 = Romania
  private searchUrls = [
    // Core frontend searches
    'https://www.linkedin.com/jobs/search/?keywords=frontend+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=0',
    'https://www.linkedin.com/jobs/search/?keywords=frontend+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=25',
    'https://www.linkedin.com/jobs/search/?keywords=front+end+developer&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=frontend+engineer&location=Romania&geoId=106670623&f_TPR=r2592000',

    // React specific
    'https://www.linkedin.com/jobs/search/?keywords=react+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=0',
    'https://www.linkedin.com/jobs/search/?keywords=react+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=25',
    'https://www.linkedin.com/jobs/search/?keywords=react+engineer&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=reactjs&location=Romania&geoId=106670623&f_TPR=r2592000',

    // Web developer
    'https://www.linkedin.com/jobs/search/?keywords=web+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=0',
    'https://www.linkedin.com/jobs/search/?keywords=web+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=25',

    // JavaScript / TypeScript
    'https://www.linkedin.com/jobs/search/?keywords=javascript+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=0',
    'https://www.linkedin.com/jobs/search/?keywords=javascript+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=25',
    'https://www.linkedin.com/jobs/search/?keywords=typescript+developer&location=Romania&geoId=106670623&f_TPR=r2592000',

    // Full stack
    'https://www.linkedin.com/jobs/search/?keywords=full+stack+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=0',
    'https://www.linkedin.com/jobs/search/?keywords=full+stack+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=25',
    'https://www.linkedin.com/jobs/search/?keywords=fullstack+developer&location=Romania&geoId=106670623&f_TPR=r2592000',

    // Other frameworks
    'https://www.linkedin.com/jobs/search/?keywords=next.js+developer&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=vue+developer&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=angular+developer&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=node.js+developer&location=Romania&geoId=106670623&f_TPR=r2592000',

    // UI/UX + HTML/CSS
    'https://www.linkedin.com/jobs/search/?keywords=ui+developer&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=html+css+developer&location=Romania&geoId=106670623&f_TPR=r2592000',

    // Junior / Internship specific
    'https://www.linkedin.com/jobs/search/?keywords=junior+frontend&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=junior+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=0',
    'https://www.linkedin.com/jobs/search/?keywords=junior+developer&location=Romania&geoId=106670623&f_TPR=r2592000&start=25',
    'https://www.linkedin.com/jobs/search/?keywords=junior+react&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=intern+developer&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=internship+software&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=stagiar+developer&location=Romania&geoId=106670623&f_TPR=r2592000',

    // Romanian city-specific
    'https://www.linkedin.com/jobs/search/?keywords=frontend+developer&location=Bucharest&f_TPR=r2592000&start=0',
    'https://www.linkedin.com/jobs/search/?keywords=frontend+developer&location=Bucharest&f_TPR=r2592000&start=25',
    'https://www.linkedin.com/jobs/search/?keywords=frontend+developer&location=Cluj-Napoca&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=frontend+developer&location=Timisoara&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=frontend+developer&location=Iasi&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=react+developer&location=Bucharest&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=react+developer&location=Cluj-Napoca&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=web+developer&location=Bucharest&f_TPR=r2592000',

    // Software engineer (often includes frontend)
    'https://www.linkedin.com/jobs/search/?keywords=software+engineer&location=Romania&geoId=106670623&f_TPR=r604800&start=0',
    'https://www.linkedin.com/jobs/search/?keywords=software+engineer&location=Romania&geoId=106670623&f_TPR=r604800&start=25',

    // Remote jobs available to Romania
    'https://www.linkedin.com/jobs/search/?keywords=frontend+developer+remote&location=Romania&geoId=106670623&f_TPR=r2592000',
    'https://www.linkedin.com/jobs/search/?keywords=react+remote&location=Romania&geoId=106670623&f_TPR=r2592000',
  ];

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const searchUrl of this.searchUrls) {
        try {
          const html = await this.fetchPage(searchUrl);
          const jobs = this.parseListings(html);
          allJobs.push(...jobs);
          successCount++;
          if (jobs.length > 0) {
            this.log(`Found ${jobs.length} jobs from search`);
          }
          // Longer delay for LinkedIn to avoid rate limiting
          await delay(2000 + Math.random() * 1500);
        } catch (err) {
          failCount++;
          this.logError(`Failed to scrape search URL`, err);
          // On rate limit, wait longer
          await delay(5000 + Math.random() * 3000);
        }
      }

      const seen = new Set<string>();
      const uniqueJobs = allJobs.filter(job => {
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

  private parseListings(html: string): Job[] {
    const $ = cheerio.load(html);
    const jobs: Job[] = [];

    // LinkedIn public search uses these selectors for job cards
    $(
      '.base-card, .job-search-card, .jobs-search__results-list li, .result-card, div[data-entity-urn]'
    ).each((_index, element) => {
      try {
        const el = $(element);

        const titleEl = el.find(
          '.base-search-card__title, .job-search-card__title, h3.base-search-card__title, a[class*="title"]'
        );
        const title = cleanText(titleEl.text());
        if (!title) return;

        let url =
          el.find('a.base-card__full-link, a.result-card__full-card-link, a[class*="full-link"]').attr('href') ||
          titleEl.closest('a').attr('href') ||
          '';

        // Clean up LinkedIn tracking params
        if (url) {
          try {
            const urlObj = new URL(url.startsWith('http') ? url : `${this.baseUrl}${url}`);
            urlObj.searchParams.delete('trk');
            urlObj.searchParams.delete('refId');
            urlObj.searchParams.delete('trackingId');
            url = urlObj.toString();
          } catch {
            if (!url.startsWith('http')) {
              url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
            }
          }
        }

        const company = cleanText(
          el.find(
            '.base-search-card__subtitle, h4.base-search-card__subtitle, a[class*="subtitle"], .job-search-card__subtitle'
          ).text()
        );

        const location = cleanText(
          el.find(
            '.job-search-card__location, .base-search-card__metadata span, span[class*="location"]'
          ).text()
        ) || 'Romania';

        const dateStr = cleanText(
          el.find(
            'time, .job-search-card__listdate, datetime, span[class*="date"]'
          ).attr('datetime') ||
          el.find('time, span[class*="date"]').text()
        );

        const description = cleanText(
          el.find('.job-search-card__snippet, .base-search-card__snippet, p[class*="snippet"]').text()
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
