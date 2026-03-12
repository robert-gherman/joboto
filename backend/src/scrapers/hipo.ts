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
 * Hipo.ro - Romanian job board. Partially server-rendered.
 * Job links and company logos are in the initial HTML even if full cards need JS.
 */
export class HipoScraper extends BaseScraper {
  name = 'Hipo';
  baseUrl = 'https://www.hipo.ro';

  private searchUrls = [
    'https://www.hipo.ro/locuri-de-munca/cautare?q=frontend+developer',
    'https://www.hipo.ro/locuri-de-munca/cautare?q=react',
    'https://www.hipo.ro/locuri-de-munca/cautare?q=javascript',
    'https://www.hipo.ro/locuri-de-munca/cautare?q=web+developer',
    'https://www.hipo.ro/locuri-de-munca/cautare?q=full+stack',
    'https://www.hipo.ro/locuri-de-munca/cautare?q=programator',
    'https://www.hipo.ro/locuri-de-munca/cautare?q=developer',
    'https://www.hipo.ro/locuri-de-munca/cautare?q=junior',
    'https://www.hipo.ro/locuri-de-munca/cautare?q=node',
    'https://www.hipo.ro/locuri-de-munca/cautare?q=typescript',
    // IT category pages
    'https://www.hipo.ro/locuri-de-munca/it-c',
    'https://www.hipo.ro/locuri-de-munca/it-c/page/2',
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

  // Only frontend/web/software dev keywords — strict filtering
  private static readonly TECH_KEYWORDS = [
    'developer', 'dezvoltator', 'programator',
    'frontend', 'front-end', 'front end', 'backend', 'back-end', 'full stack', 'fullstack',
    'react', 'vue', 'angular', 'javascript', 'typescript', 'node.js', 'next.js',
    'web developer', 'software developer', 'software engineer',
    'html', 'css', 'ui developer', 'ux developer', 'devops',
    'python developer', 'java developer', '.net developer', 'php developer',
    'mobile developer', 'ios developer', 'android developer',
  ];

  private static readonly NOISE_TITLES = [
    'inscriere', 'register', 'login', 'vezi toate', 'mai mult', 'conferinta',
    'workshop', 'eveniment', 'event', 'top talents', 'cei mai doriti',
    'inspirat', 'gratuit', 'intalneste',
  ];

  private isRelevantJob(title: string): boolean {
    const lower = title.toLowerCase();
    // Skip noise titles
    if (HipoScraper.NOISE_TITLES.some(noise => lower.includes(noise))) return false;
    // Must contain at least one tech keyword
    return HipoScraper.TECH_KEYWORDS.some(kw => lower.includes(kw));
  }

  private parseListings(html: string): Job[] {
    const $ = cheerio.load(html);
    const jobs: Job[] = [];

    // Hipo uses link-based job listings
    // Pattern: /locuri-de-munca/locuri_de_munca/{ID}/...
    $('a[href*="/locuri-de-munca/locuri_de_munca/"], a[href*="/locuri-de-munca/job/"]').each(
      (_index, element) => {
        try {
          const el = $(element);

          // Get the title from the link text or child elements
          let title = cleanText(el.find('span, h2, h3, h4, strong').first().text());
          if (!title) {
            title = cleanText(el.text());
          }
          if (!title || title.length < 5 || title.length > 300) return;

          // Filter: only keep tech/dev relevant jobs
          if (!this.isRelevantJob(title)) return;

          let url = el.attr('href') || '';
          if (url && !url.startsWith('http')) {
            url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
          }

          // Try to get company from nearby logo alt text
          const parent = el.closest('div, li, article');
          let company = '';
          const logoImg = parent.find('img[src*="logofirma"], img[alt]');
          if (logoImg.length) {
            company = cleanText(logoImg.attr('alt') || '');
          }
          if (!company) {
            company = cleanText(parent.find('.company, .firma, [class*="company"]').text());
          }

          const location = cleanText(
            parent.find('.location, .oras, [class*="location"], [class*="city"]').text()
          ) || 'Romania';

          const dateStr = cleanText(
            parent.find('time, .date, [class*="date"]').text()
          );

          if (!url) return;

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
            posted_at: normalizeDate(dateStr),
            scraped_at: new Date().toISOString(),
            tags: extractTags(title, ''),
            is_active: true,
          };

          jobs.push(job);
        } catch {
          // Skip malformed entries
        }
      }
    );

    return jobs;
  }
}
