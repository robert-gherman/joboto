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

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    url: string;
    permalink: string;
    author: string;
    created_utc: number;
    link_flair_text?: string;
    subreddit: string;
    score: number;
    num_comments: number;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
    after?: string;
  };
}

export class RedditScraper extends BaseScraper {
  name = 'Reddit';
  baseUrl = 'https://www.reddit.com';

  private searchConfigs = [
    {
      url: 'https://www.reddit.com/r/reactjs/search.json?q=hiring+romania&sort=new&restrict_sr=1&limit=25',
      subreddit: 'reactjs',
    },
    {
      url: 'https://www.reddit.com/r/reactjs/search.json?q=flair%3A%22Hiring%22+%28romania+OR+remote+OR+europe%29&sort=new&restrict_sr=1&limit=25',
      subreddit: 'reactjs',
    },
    {
      url: 'https://www.reddit.com/r/forhire/search.json?q=%28react+OR+frontend+OR+javascript%29+%28romania+OR+remote%29&sort=new&restrict_sr=1&limit=25',
      subreddit: 'forhire',
    },
    {
      url: 'https://www.reddit.com/r/remotejs/search.json?q=react+OR+frontend+OR+javascript&sort=new&restrict_sr=1&limit=25',
      subreddit: 'remotejs',
    },
    {
      url: 'https://www.reddit.com/r/webdev/search.json?q=hiring+%28react+OR+frontend%29+%28romania+OR+remote+OR+europe%29&sort=new&restrict_sr=1&limit=25',
      subreddit: 'webdev',
    },
  ];

  async scrape(): Promise<ScraperResult> {
    try {
      const allJobs: Job[] = [];

      for (const config of this.searchConfigs) {
        try {
          const raw = await this.fetchPage(config.url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'JobotoBot/1.0 (job aggregator for Romania frontend jobs)',
            },
          });

          let data: RedditResponse;
          try {
            data = JSON.parse(raw);
          } catch {
            this.logError(`Failed to parse JSON from r/${config.subreddit}`);
            continue;
          }

          if (!data?.data?.children) continue;

          const posts = data.data.children;
          const jobs = this.parsePosts(posts);
          allJobs.push(...jobs);
          this.log(`Found ${jobs.length} job posts from r/${config.subreddit}`);

          // Reddit rate limits - be respectful
          await delay(2000);
        } catch (err) {
          this.logError(`Failed to scrape r/${config.subreddit}`, err);
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

  private parsePosts(posts: RedditPost[]): Job[] {
    const jobs: Job[] = [];

    // Filter for hiring-related posts
    const hiringKeywords = [
      'hiring', '[hiring]', 'looking for', 'we are hiring',
      'job opening', 'open position', 'job opportunity',
      'seeking', 'need a developer', 'help wanted',
    ];

    const relevantKeywords = [
      'react', 'frontend', 'front-end', 'javascript', 'typescript',
      'vue', 'angular', 'next.js', 'nextjs', 'web developer',
    ];

    for (const post of posts) {
      try {
        const { data } = post;
        if (!data || !data.title) continue;

        const fullText = `${data.title} ${data.selftext || ''}`.toLowerCase();
        const titleLower = data.title.toLowerCase();
        const flairLower = (data.link_flair_text || '').toLowerCase();

        // Check if this is a hiring post
        const isHiring =
          hiringKeywords.some(kw => titleLower.includes(kw)) ||
          flairLower.includes('hiring') ||
          flairLower.includes('job');

        if (!isHiring) continue;

        // Check if it mentions relevant technologies
        const isRelevant = relevantKeywords.some(kw => fullText.includes(kw));
        if (!isRelevant) continue;

        const url = `https://www.reddit.com${data.permalink}`;

        // Try to extract company name from title: "[Hiring] Company Name - Position"
        let company = 'Unknown Company';
        const companyMatch = data.title.match(
          /\[hiring\]\s*(?:\[.*?\]\s*)?([^-|:]+?)(?:\s*[-|:])/i
        );
        if (companyMatch) {
          company = cleanText(companyMatch[1]);
        }

        // Try to extract location context
        let location = 'Remote';
        if (fullText.includes('romania') || fullText.includes('bucharest') || fullText.includes('bucuresti') || fullText.includes('cluj')) {
          location = 'Romania';
        } else if (fullText.includes('europe')) {
          location = 'Europe (Remote)';
        }

        // Clean the title - remove flair-like prefixes
        const cleanTitle = cleanText(
          data.title
            .replace(/\[hiring\]/gi, '')
            .replace(/\[remote\]/gi, '')
            .replace(/\[.*?\]/g, '')
            .trim()
        );

        const description = data.selftext
          ? cleanText(data.selftext.substring(0, 2000))
          : cleanTitle;

        const job: Job = {
          id: generateJobId(url, cleanTitle, company),
          title: cleanTitle || data.title,
          company,
          location,
          type: detectWorkType(data.title, data.selftext || '', location),
          experience_level: detectExperienceLevel(data.title, data.selftext || ''),
          description,
          url,
          source: `Reddit/r/${data.subreddit}`,
          posted_at: new Date(data.created_utc * 1000).toISOString(),
          scraped_at: new Date().toISOString(),
          tags: extractTags(data.title, data.selftext || ''),
          is_active: true,
        };

        jobs.push(job);
      } catch {
        // Skip malformed posts
      }
    }

    return jobs;
  }
}
