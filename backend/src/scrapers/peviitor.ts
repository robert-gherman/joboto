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
 * Peviitor.ro - Romanian job aggregator with a public JSON API.
 * API returns structured data with salary, tags, location, remote info.
 * One of Romania's most comprehensive job data sources.
 */
export class PeviitorScraper extends BaseScraper {
  name = 'Peviitor';
  baseUrl = 'https://api.peviitor.ro';

  // Queries to search for frontend/web/JS jobs
  private searchQueries = [
    'frontend developer',
    'frontend',
    'front end',
    'react developer',
    'react',
    'reactjs',
    'javascript developer',
    'javascript',
    'web developer',
    'full stack developer',
    'fullstack',
    'vue developer',
    'vue',
    'angular developer',
    'angular',
    'node.js developer',
    'node.js',
    'nodejs',
    'typescript',
    'next.js',
    'nextjs',
    'ui developer',
    'html css',
    'junior developer',
    'junior frontend',
    'intern developer',
    'stagiar',
    'software engineer',
    'programator',
    'programator web',
  ];

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];

      for (const query of this.searchQueries) {
        try {
          // Peviitor public API — response.docs contains job objects
          const apiUrl = `https://api.peviitor.ro/v1/search/?q=${encodeURIComponent(query)}&country=Romania&page=1&size=100`;
          const raw = await this.fetchJson(apiUrl);
          const data = raw as Record<string, unknown>;

          // API response format: { response: { docs: [...], numFound: N } }
          const response = data?.response as Record<string, unknown> | undefined;
          const docs = response?.docs;

          if (docs && Array.isArray(docs)) {
            const jobs = this.parseResults(docs as Record<string, unknown>[]);
            allJobs.push(...jobs);
            const numFound = response?.numFound || docs.length;
            this.log(`Found ${jobs.length} jobs for "${query}" (${numFound} total available)`);

            // If there are more pages, fetch page 2
            if (typeof numFound === 'number' && numFound > 100) {
              try {
                const page2Url = `https://api.peviitor.ro/v1/search/?q=${encodeURIComponent(query)}&country=Romania&page=2&size=100`;
                const raw2 = await this.fetchJson(page2Url) as Record<string, unknown>;
                const response2 = raw2?.response as Record<string, unknown> | undefined;
                const docs2 = response2?.docs;
                if (docs2 && Array.isArray(docs2)) {
                  const jobs2 = this.parseResults(docs2 as Record<string, unknown>[]);
                  allJobs.push(...jobs2);
                  this.log(`Found ${jobs2.length} more jobs for "${query}" (page 2)`);
                }
                await delay(800);
              } catch {
                // Page 2 failed, that's ok
              }
            }
          }

          await delay(600);
        } catch (err) {
          this.logError(`Failed to search "${query}"`, err);
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

  private parseResults(docs: Record<string, unknown>[]): Job[] {
    const jobs: Job[] = [];

    for (const item of docs) {
      try {
        const title = cleanText(String(item.job_title || item.title || ''));
        if (!title) continue;

        const url = String(item.job_link || item.url || item.link || '');
        if (!url || !url.startsWith('http')) continue;

        const company = cleanText(String(item.company || 'Unknown Company'));

        // city and location are arrays in Peviitor API
        const cities = Array.isArray(item.city) ? item.city : [];
        const locations = Array.isArray(item.location) ? item.location : [];
        const counties = Array.isArray(item.county) ? item.county : [];
        const location = cleanText(
          [...cities, ...locations, ...counties].filter(Boolean).join(', ')
        ) || 'Romania';

        // Remote/work mode
        const workMode = String(item.remote || item.workmode || '').toLowerCase();

        // Salary from API (array like ["6700-7500 RON"])
        const salaryArr = Array.isArray(item.salary) ? item.salary : [];
        const salary = salaryArr.filter((s: unknown) => s && String(s).trim()).join(', ') || undefined;

        // Tags from API
        const apiTags = Array.isArray(item.tags) ? item.tags.map((t: unknown) => String(t).toLowerCase()) : [];

        // Date
        const dateStr = String(item.date || item.vdate || '');
        const postedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

        // Detect work type from API workmode field
        let workType: 'remote' | 'hybrid' | 'onsite' = 'onsite';
        if (workMode.includes('remote')) workType = 'remote';
        else if (workMode.includes('hybrid')) workType = 'hybrid';
        else workType = detectWorkType(title, '', location);

        const description = title; // Peviitor doesn't include description in search results

        const job: Job = {
          id: String(item.id || generateJobId(url, title, company)),
          title,
          company,
          location,
          type: workType,
          experience_level: detectExperienceLevel(title, apiTags.join(' ')),
          description,
          url,
          source: this.name,
          salary,
          posted_at: postedAt,
          scraped_at: new Date().toISOString(),
          tags: [...new Set([...extractTags(title, ''), ...apiTags.filter((t: string) => t.length > 1)])],
          is_active: true,
        };

        jobs.push(job);
      } catch {
        // Skip malformed entries
      }
    }

    return jobs;
  }
}
