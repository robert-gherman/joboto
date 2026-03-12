export interface Job {
  id: string;
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

export interface JobFilters {
  search: string;
  type: string;
  experience_level: string;
  source: string;
  posted_after: string;
  tags: string[];
  sort_by: 'posted_at' | 'relevance';
}

export interface JobStats {
  total: number;
  by_source: Record<string, number>;
  by_type: Record<string, number>;
  by_experience: Record<string, number>;
  new_today: number;
  new_this_week: number;
}

export interface ResumeAnalysis {
  skills: string[];
  experience_level: string;
  matching_jobs: Array<Job & { match_score: number }>;
  suggestions: string[];
}

export interface AITips {
  tips: string[];
  skills_to_highlight: string[];
  interview_prep: string[];
  company_research: string[];
}

export interface CoverLetterRequest {
  job_id: string;
  user_name: string;
  user_skills: string;
  user_experience: string;
}

export interface CoverLetterResponse {
  cover_letter: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
