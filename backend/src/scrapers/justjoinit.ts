import { BaseScraper } from './base-scraper';
import { Job, ScraperResult } from '../types';
import {
  detectExperienceLevel,
  detectWorkType,
  extractTags,
  generateJobId,
} from '../utils/helpers';

interface JustJoinOffer {
  id: string;
  title: string;
  street?: string;
  city: string;
  country_code: string;
  address_text?: string;
  marker_icon: string;
  workplace_type: string;
  company_name: string;
  company_url?: string;
  company_size?: string;
  experience_level: string;
  published_at: string;
  remote_interview: boolean;
  salary_from?: number;
  salary_to?: number;
  salary_currency?: string;
  salary_type?: string;
  employment_types?: Array<{
    type: string;
    salary?: {
      from: number;
      to: number;
      currency: string;
    };
  }>;
  skills: Array<{
    name: string;
    level: number;
  }>;
  remote: boolean;
  body?: string;
}

export class JustJoinItScraper extends BaseScraper {
  name = 'JustJoinIT';
  baseUrl = 'https://justjoin.it';

  async scrape(): Promise<ScraperResult> {
    try {
      this.log('Fetching offers from JustJoinIT API...');

      const data = await this.fetchJson<JustJoinOffer[]>(
        'https://justjoin.it/api/offers'
      );

      if (!Array.isArray(data)) {
        this.logError('Unexpected response format from JustJoinIT API');
        return this.failure('Unexpected API response format');
      }

      // Filter for Romania-based or remote jobs with relevant skills
      const relevantKeywords = [
        'react', 'frontend', 'front-end', 'javascript', 'typescript',
        'vue', 'angular', 'next.js', 'nextjs', 'web developer',
      ];

      const filteredOffers = data.filter(offer => {
        const isRomania =
          offer.country_code?.toLowerCase() === 'ro' ||
          offer.city?.toLowerCase().includes('bucharest') ||
          offer.city?.toLowerCase().includes('bucuresti') ||
          offer.city?.toLowerCase().includes('cluj') ||
          offer.city?.toLowerCase().includes('timisoara') ||
          offer.city?.toLowerCase().includes('iasi') ||
          offer.city?.toLowerCase().includes('brasov');

        const isRemote = offer.remote || offer.workplace_type === 'remote';

        const isRelevant = relevantKeywords.some(
          keyword =>
            offer.title.toLowerCase().includes(keyword) ||
            offer.marker_icon?.toLowerCase() === 'javascript' ||
            offer.skills?.some(s => s.name.toLowerCase().includes(keyword))
        );

        return (isRomania || isRemote) && isRelevant;
      });

      const jobs: Job[] = filteredOffers.map(offer => {
        const skillNames = offer.skills?.map(s => s.name.toLowerCase()) || [];
        const titleAndSkills = `${offer.title} ${skillNames.join(' ')}`;

        let salary: string | undefined;
        if (offer.employment_types && offer.employment_types.length > 0) {
          const emp = offer.employment_types[0];
          if (emp.salary) {
            salary = `${emp.salary.from}-${emp.salary.to} ${emp.salary.currency}`;
          }
        } else if (offer.salary_from && offer.salary_to) {
          salary = `${offer.salary_from}-${offer.salary_to} ${offer.salary_currency || 'PLN'}`;
        }

        const url = `${this.baseUrl}/offers/${offer.id}`;

        let workType: 'remote' | 'hybrid' | 'onsite' = 'onsite';
        if (offer.remote || offer.workplace_type === 'remote') {
          workType = 'remote';
        } else if (offer.workplace_type === 'hybrid') {
          workType = 'hybrid';
        }

        let experienceLevel: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' = 'mid';
        const expMap: Record<string, 'junior' | 'mid' | 'senior' | 'lead'> = {
          'junior': 'junior',
          'mid': 'mid',
          'senior': 'senior',
          'lead': 'lead',
        };
        if (offer.experience_level && expMap[offer.experience_level.toLowerCase()]) {
          experienceLevel = expMap[offer.experience_level.toLowerCase()];
        } else {
          experienceLevel = detectExperienceLevel(offer.title, '');
        }

        return {
          id: generateJobId(url, offer.title, offer.company_name),
          title: offer.title,
          company: offer.company_name,
          location: `${offer.city}${offer.country_code ? ', ' + offer.country_code.toUpperCase() : ''}`,
          type: workType,
          experience_level: experienceLevel,
          description: offer.body || offer.title,
          url,
          source: this.name,
          salary,
          posted_at: offer.published_at || new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          tags: [
            ...new Set([...extractTags(offer.title, offer.body || ''), ...skillNames]),
          ],
          is_active: true,
        };
      });

      this.log(`Found ${jobs.length} relevant jobs from ${data.length} total offers`);
      return this.success(jobs);
    } catch (error) {
      this.logError('Scraping failed', error);
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }
}
