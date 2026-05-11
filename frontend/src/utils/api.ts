import axios from 'axios';
import type {
  Job,
  JobFilters,
  JobStats,
  ResumeAnalysis,
  AITips,
  CoverLetterRequest,
  CoverLetterResponse,
  PaginatedResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Jobs
export async function fetchJobs(
  filters: Partial<JobFilters> & { page?: number; limit?: number }
): Promise<PaginatedResponse<Job>> {
  const params: Record<string, string | number> = {};

  if (filters.search) params.search = filters.search;
  if (filters.type) params.type = filters.type;
  if (filters.experience_level) params.experience_level = filters.experience_level;
  if (filters.source) params.source = filters.source;
  if (filters.posted_after) params.posted_after = filters.posted_after;
  if (filters.tags && filters.tags.length > 0) params.tags = filters.tags.join(',');
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;
  if (filters.sort_by) params.sort_by = filters.sort_by;
  if (filters.hide_duplicates) params.hide_duplicates = 'true';
  if (filters.location_romania) params.location_romania = 'true';

  const { data: raw } = await api.get('/jobs', { params });

  // Map backend response { jobs, pagination } to our PaginatedResponse
  return {
    data: raw.jobs || [],
    total: raw.pagination?.total ?? 0,
    page: raw.pagination?.page ?? 1,
    limit: raw.pagination?.limit ?? 20,
    total_pages: raw.pagination?.total_pages ?? 1,
  };
}

export async function fetchJobById(id: string): Promise<Job> {
  const { data: raw } = await api.get(`/jobs/${id}`);
  // Backend returns { job: {...} }
  return raw.job || raw;
}

export async function fetchJobStats(): Promise<JobStats> {
  const { data: raw } = await api.get('/jobs/stats');

  // Map backend response to our JobStats type
  return {
    total: raw.total_jobs ?? 0,
    by_source: raw.by_source ?? {},
    by_type: raw.by_type ?? {},
    by_experience: raw.by_experience_level ?? {},
    new_today: raw.new_today ?? 0,
    new_this_week: raw.new_this_week ?? 0,
  };
}

export async function fetchJobRecommendations(query: string): Promise<Job[]> {
  const { data: raw } = await api.get('/jobs/recommendations', {
    params: { q: query },
  });
  // Backend returns { recommendations: [...], query, total_matched }
  return raw.recommendations || raw || [];
}

// Recent jobs (for live feed)
// Initial load: jobs added to DB in the last `minutes` (default 15)
// Polling: jobs added since `since` timestamp
export async function fetchRecentJobs(
  options: { minutes?: number; since?: string } = {}
): Promise<{ jobs: Job[]; count: number; since: string; checked_at: string }> {
  const params: Record<string, string | number> = {};
  if (options.since) params.since = options.since;
  if (options.minutes) params.minutes = options.minutes;
  const { data } = await api.get('/jobs/recent', { params });
  return {
    jobs: data.jobs || [],
    count: data.count || 0,
    since: data.since || '',
    checked_at: data.checked_at || new Date().toISOString(),
  };
}

// Email notifications
export async function sendEmailAlert(jobIds: string[]): Promise<{ sent: boolean }> {
  const { data } = await api.post('/notifications/email', { job_ids: jobIds });
  return data;
}

export async function getNotificationStatus(): Promise<{
  email_enabled: boolean;
  email_to: string | null;
}> {
  const { data } = await api.get('/notifications/status');
  return data;
}

// Scraper control
export async function getScraperStatus(): Promise<{ paused: boolean }> {
  const { data } = await api.get('/scraper/status');
  return data;
}

export async function pauseScraper(): Promise<{ paused: boolean }> {
  const { data } = await api.post('/scraper/pause');
  return data;
}

export async function resumeScraper(): Promise<{ paused: boolean }> {
  const { data } = await api.post('/scraper/resume');
  return data;
}

// Sources
export async function fetchSources(): Promise<string[]> {
  const { data: raw } = await api.get('/sources');
  // Backend returns { sources: [{ name, count }] }
  if (raw.sources && Array.isArray(raw.sources)) {
    return raw.sources.map((s: { name: string; count: number }) => s.name);
  }
  return raw || [];
}

// AI endpoints
export async function analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
  const { data } = await api.post<ResumeAnalysis>('/ai/analyze-resume', {
    resume_text: resumeText,
  });
  return data;
}

export async function getJobTips(jobId: string): Promise<AITips> {
  const { data } = await api.post<AITips>('/ai/job-tips', {
    job_id: jobId,
  });
  return data;
}

export async function generateCoverLetter(
  request: CoverLetterRequest
): Promise<CoverLetterResponse> {
  const { data } = await api.post<CoverLetterResponse>('/ai/cover-letter', request);
  return data;
}

export default api;
