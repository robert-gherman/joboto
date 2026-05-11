export interface Job {
  id?: string;
  title: string;
  company: string;
  location: string;
  type: 'remote' | 'hybrid' | 'onsite';
  experience_level: 'intern' | 'junior' | 'mid' | 'senior' | 'lead';
  description: string;
  url: string;
  source: string;
  salary?: string;
  posted_at: string | null;
  scraped_at: string;
  tags: string[];
  is_active: boolean;
}

export interface ScraperResult {
  jobs: Job[];
  source: string;
  success: boolean;
  error?: string;
}

export interface JobFilters {
  search?: string;
  type?: string;
  experience_level?: string;
  source?: string;
  posted_after?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sort_by?: 'posted_at' | 'relevance';
  hide_duplicates?: boolean;
  location_romania?: boolean;
}
