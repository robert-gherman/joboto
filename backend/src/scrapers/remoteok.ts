import { BaseScraper } from './base-scraper';
import { Job, ScraperResult } from '../types';
import {
  detectExperienceLevel,
  extractTags,
  generateJobId,
} from '../utils/helpers';

interface RemoteOKJob {
  id: string;
  epoch: number;
  date: string;
  company: string;
  company_logo?: string;
  position: string;
  description?: string;
  tags: string[];
  url: string;
  salary_min?: number;
  salary_max?: number;
  location?: string;
  original?: boolean;
}

export class RemoteOKScraper extends BaseScraper {
  name = 'RemoteOK';
  baseUrl = 'https://remoteok.com';

  private apiUrls = [
    'https://remoteok.com/api?tag=react',
    'https://remoteok.com/api?tag=frontend',
    'https://remoteok.com/api?tag=javascript',
  ];

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];

      for (const apiUrl of this.apiUrls) {
        try {
          const rawData = await this.fetchPage(apiUrl, {
            headers: {
              'Accept': 'application/json',
            },
          });

          let data: RemoteOKJob[];
          try {
            const parsed = JSON.parse(rawData);
            // RemoteOK API returns an array where first element is metadata
            data = Array.isArray(parsed) ? parsed.slice(1) : [];
          } catch {
            this.logError(`Failed to parse JSON from ${apiUrl}`);
            continue;
          }

          const relevantKeywords = [
            'react', 'frontend', 'front-end', 'javascript', 'typescript',
            'vue', 'angular', 'next.js', 'nextjs', 'web developer',
          ];

          const filtered = data.filter(job => {
            if (!job.position || !job.company) return false;

            const text = `${job.position} ${(job.tags || []).join(' ')} ${job.description || ''}`.toLowerCase();
            return relevantKeywords.some(kw => text.includes(kw));
          });

          const jobs: Job[] = filtered.map(item => {
            const jobUrl = item.url?.startsWith('http')
              ? item.url
              : `${this.baseUrl}/remote-jobs/${item.id}`;

            let salary: string | undefined;
            if (item.salary_min && item.salary_max) {
              salary = `$${item.salary_min.toLocaleString()}-$${item.salary_max.toLocaleString()}`;
            }

            const description = item.description || item.position;
            const tagList = item.tags || [];

            return {
              id: generateJobId(jobUrl, item.position, item.company),
              title: item.position,
              company: item.company,
              location: item.location || 'Remote (Worldwide)',
              type: 'remote' as const,
              experience_level: detectExperienceLevel(item.position, description),
              description,
              url: jobUrl,
              source: this.name,
              salary,
              posted_at: item.date || new Date(item.epoch * 1000).toISOString(),
              scraped_at: new Date().toISOString(),
              tags: [
                ...new Set([
                  ...extractTags(item.position, description),
                  ...tagList.map(t => t.toLowerCase()),
                ]),
              ],
              is_active: true,
            };
          });

          allJobs.push(...jobs);
          this.log(`Found ${jobs.length} relevant jobs from ${apiUrl}`);
        } catch (err) {
          this.logError(`Failed to fetch ${apiUrl}`, err);
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
}
