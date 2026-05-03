import { Router, Request, Response } from 'express';
import supabase from '../utils/supabase';
import { JobFilters, Job } from '../types';
import { runAllScrapers } from '../scrapers';
import { sendNewJobsEmail } from '../utils/email';

const router = Router();

/**
 * GET /api/jobs
 * List jobs with full filtering, pagination, and sorting.
 */
router.get('/jobs', async (req: Request, res: Response): Promise<void> => {
  try {
    const filters: JobFilters = {
      search: req.query.search as string | undefined,
      type: req.query.type as string | undefined,
      experience_level: req.query.experience_level as string | undefined,
      source: req.query.source as string | undefined,
      posted_after: req.query.posted_after as string | undefined,
      tags: req.query.tags
        ? (req.query.tags as string).split(',').map(t => t.trim().toLowerCase())
        : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      sort_by: (req.query.sort_by as 'posted_at' | 'relevance') || 'posted_at',
      hide_duplicates: req.query.hide_duplicates === 'true',
    };

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    // Full-text search across title, company, description
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query = query.or(
        `title.ilike.${searchTerm},company.ilike.${searchTerm},description.ilike.${searchTerm}`
      );
    }

    // Filter by work type
    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    // Filter by experience level
    if (filters.experience_level) {
      query = query.eq('experience_level', filters.experience_level);
    }

    // Filter by source
    if (filters.source) {
      query = query.ilike('source', filters.source);
    }

    // Filter by posted date
    if (filters.posted_after) {
      query = query.gte('posted_at', filters.posted_after);
    }

    // Filter by tags (must contain all specified tags)
    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    // Sorting — nullsFirst: false pushes unknown dates to the end
    if (filters.sort_by === 'posted_at') {
      query = query.order('posted_at', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('posted_at', { ascending: false, nullsFirst: false });
    }

    if (filters.hide_duplicates) {
      // Fetch all matching rows (paginated in batches) so we can deduplicate
      const allJobs: any[] = [];
      const batchSize = 1000;
      let batchOffset = 0;
      let hasMore = true;

      // Re-build the base query without range for batch fetching
      while (hasMore) {
        let batchQuery = supabase
          .from('jobs')
          .select('*')
          .eq('is_active', true);

        if (filters.search) {
          const searchTerm = `%${filters.search}%`;
          batchQuery = batchQuery.or(
            `title.ilike.${searchTerm},company.ilike.${searchTerm},description.ilike.${searchTerm}`
          );
        }
        if (filters.type) batchQuery = batchQuery.eq('type', filters.type);
        if (filters.experience_level) batchQuery = batchQuery.eq('experience_level', filters.experience_level);
        if (filters.source) batchQuery = batchQuery.ilike('source', filters.source);
        if (filters.posted_after) batchQuery = batchQuery.gte('posted_at', filters.posted_after);
        if (filters.tags && filters.tags.length > 0) batchQuery = batchQuery.contains('tags', filters.tags);

        batchQuery = batchQuery
          .order('posted_at', { ascending: false, nullsFirst: false })
          .range(batchOffset, batchOffset + batchSize - 1);

        const { data: batchData, error: batchError } = await batchQuery;
        if (batchError) {
          res.status(500).json({ error: 'Failed to fetch jobs', details: batchError.message });
          return;
        }
        if (batchData && batchData.length > 0) {
          allJobs.push(...batchData);
          batchOffset += batchData.length;
          hasMore = batchData.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Deduplicate: keep the first (most recent) job per normalized title+company
      const seen = new Map<string, boolean>();
      const uniqueJobs = allJobs.filter(job => {
        const key = `${(job.title || '').toLowerCase().trim()}::${(job.company || '').toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
      });

      const total = uniqueJobs.length;
      const paginatedJobs = uniqueJobs.slice(offset, offset + limit);

      res.json({
        jobs: paginatedJobs,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
          has_next: offset + limit < total,
          has_prev: page > 1,
        },
        filters: {
          search: filters.search || null,
          type: filters.type || null,
          experience_level: filters.experience_level || null,
          source: filters.source || null,
          posted_after: filters.posted_after || null,
          tags: filters.tags || null,
          hide_duplicates: true,
        },
      });
    } else {
      // Normal path: use DB pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        res.status(500).json({ error: 'Failed to fetch jobs', details: error.message });
        return;
      }

      res.json({
        jobs: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
          has_next: offset + limit < (count || 0),
          has_prev: page > 1,
        },
        filters: {
          search: filters.search || null,
          type: filters.type || null,
          experience_level: filters.experience_level || null,
          source: filters.source || null,
          posted_after: filters.posted_after || null,
          tags: filters.tags || null,
          hide_duplicates: false,
        },
      });
    }
  } catch (err) {
    console.error('GET /api/jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/jobs/stats
 * Aggregated statistics about the job listings.
 * Fetches all rows in batches to avoid Supabase's 1000 row default limit.
 */
router.get('/jobs/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Total active jobs
    const { count: totalJobs } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Fetch all source/type/experience data in one query, paginated to avoid the 1000 row limit
    const allRows: { source: string; type: string; experience_level: string; posted_at: string | null }[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('source, type, experience_level, posted_at')
        .eq('is_active', true)
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Stats query error at offset', offset, error.message);
        break;
      }

      if (data && data.length > 0) {
        allRows.push(...data);
        offset += data.length;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Aggregate counts
    const bySource: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byExperience: Record<string, number> = {};

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekISO = weekAgo.toISOString();

    let newToday = 0;
    let newThisWeek = 0;

    for (const row of allRows) {
      bySource[row.source] = (bySource[row.source] || 0) + 1;
      byType[row.type] = (byType[row.type] || 0) + 1;
      byExperience[row.experience_level] = (byExperience[row.experience_level] || 0) + 1;

      if (row.posted_at && row.posted_at >= todayISO) newToday++;
      if (row.posted_at && row.posted_at >= weekISO) newThisWeek++;
    }

    res.json({
      total_jobs: totalJobs || allRows.length,
      new_today: newToday,
      new_this_week: newThisWeek,
      by_source: bySource,
      by_type: byType,
      by_experience_level: byExperience,
    });
  } catch (err) {
    console.error('GET /api/jobs/stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/jobs/recommendations
 * AI-style recommendations using keyword matching and TF-IDF scoring.
 */
router.get('/jobs/recommendations', async (req: Request, res: Response): Promise<void> => {
  try {
    const queryText = (req.query.q as string) || '';
    const limit = Math.min(50, parseInt(req.query.limit as string, 10) || 10);

    if (!queryText.trim()) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    // Fetch recent active jobs
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('posted_at', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch jobs', details: error.message });
      return;
    }

    if (!jobs || jobs.length === 0) {
      res.json({ recommendations: [], query: queryText });
      return;
    }

    // Simple TF-IDF style scoring
    const queryTerms = queryText
      .toLowerCase()
      .replace(/[^\w\s.-]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 1);

    // Calculate document frequency for each term
    const docFreq: Record<string, number> = {};
    for (const term of queryTerms) {
      docFreq[term] = jobs.filter(job => {
        const text = `${job.title} ${job.company} ${job.description} ${(job.tags || []).join(' ')}`.toLowerCase();
        return text.includes(term);
      }).length;
    }

    const totalDocs = jobs.length;

    // Score each job
    const scored = jobs.map(job => {
      const text = `${job.title} ${job.company} ${job.description} ${(job.tags || []).join(' ')}`.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        // Term frequency in document
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = text.match(regex);
        const tf = matches ? matches.length : 0;

        if (tf === 0) continue;

        // Inverse document frequency
        const df = docFreq[term] || 1;
        const idf = Math.log(totalDocs / df);

        // TF-IDF score
        let termScore = tf * idf;

        // Boost if term appears in title (3x weight)
        if (job.title.toLowerCase().includes(term)) {
          termScore *= 3;
        }

        // Boost if term appears in tags (2x weight)
        if ((job.tags || []).some((t: string) => t.toLowerCase().includes(term))) {
          termScore *= 2;
        }

        score += termScore;
      }

      // Recency boost: jobs posted more recently get a small boost
      const postedDate = new Date(job.posted_at).getTime();
      const now = Date.now();
      const daysSincePosted = (now - postedDate) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, 1 - daysSincePosted / 30); // Decays over 30 days
      score += recencyBoost * 0.5;

      return {
        ...job,
        relevance_score: Math.round(score * 100) / 100,
      };
    });

    // Sort by score descending and take top results
    const recommendations = scored
      .filter(j => j.relevance_score > 0)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit);

    res.json({
      recommendations,
      query: queryText,
      total_matched: recommendations.length,
    });
  } catch (err) {
    console.error('GET /api/jobs/recommendations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/jobs/recent
 * Returns jobs added to the database within the last N minutes (default 15).
 * Uses `created_at` — the timestamp when our scraper first discovered the job.
 * The live feed polls this every 2 minutes to detect freshly scraped listings.
 *
 * IMPORTANT: This route MUST be defined before /jobs/:id to avoid being
 * swallowed by the parameterised route.
 */
router.get('/jobs/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const minutes = Math.min(1440, Math.max(1, parseInt(req.query.minutes as string, 10) || 15));
    const since = req.query.since as string | undefined;
    // Max age for posted_at — only show jobs actually posted within this window (default 4h)
    const maxAgeHours = Math.min(48, Math.max(1, parseInt(req.query.max_age_hours as string, 10) || 4));

    // Use `since` if provided (polling), otherwise look back N minutes
    const cutoff = since || new Date(Date.now() - minutes * 60 * 1000).toISOString();

    // posted_at must also be recent — filters out old jobs the scraper just discovered
    const postedAfter = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

    const { data, error, count } = await supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .gt('created_at', cutoff)
      .gte('posted_at', postedAfter)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch recent jobs', details: error.message });
      return;
    }

    res.json({
      jobs: data || [],
      count: count || (data?.length ?? 0),
      since: cutoff,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('GET /api/jobs/recent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/sources
 * List all available sources with their job counts.
 */
router.get('/sources', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Fetch all sources with pagination to avoid 1000 row limit
    const allSources: string[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('source')
        .eq('is_active', true)
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Sources query error:', error.message);
        break;
      }

      if (data && data.length > 0) {
        allSources.push(...data.map(row => row.source));
        offset += data.length;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const sourceCounts: Record<string, number> = {};
    allSources.forEach(source => {
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    const sources = Object.entries(sourceCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ sources });
  } catch (err) {
    console.error('GET /api/sources error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/jobs/:id
 * Get a single job by ID.
 */
router.get('/jobs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ job: data });
  } catch (err) {
    console.error('GET /api/jobs/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/email
 * Send an email alert with the provided jobs.
 * Called by the frontend when new jobs are detected and email alerts are on.
 */
router.post('/notifications/email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { job_ids } = req.body as { job_ids: string[] };

    if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
      res.status(400).json({ error: 'job_ids array is required' });
      return;
    }

    // Cap at 20 jobs per email to prevent abuse
    const ids = job_ids.slice(0, 20);

    // Fetch the actual job data
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .in('id', ids);

    if (error || !jobs || jobs.length === 0) {
      res.status(404).json({ error: 'No jobs found for the given IDs' });
      return;
    }

    const sent = await sendNewJobsEmail(jobs as Job[]);

    res.json({
      sent,
      jobs_count: jobs.length,
      message: sent ? 'Email alert sent' : 'Email not configured — check .env',
    });
  } catch (err) {
    console.error('POST /api/notifications/email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/notifications/status
 * Check if email notifications are configured on the backend.
 */
router.get('/notifications/status', async (_req: Request, res: Response): Promise<void> => {
  const configured =
    process.env.EMAIL_ENABLED === 'true' &&
    !!process.env.EMAIL_SMTP_USER &&
    !!process.env.EMAIL_SMTP_PASS &&
    process.env.EMAIL_SMTP_PASS !== 'your-gmail-app-password-here';

  res.json({
    email_enabled: configured,
    email_to: configured ? process.env.EMAIL_TO : null,
  });
});

/**
 * POST /api/jobs/scrape
 * Trigger a manual scrape. For dev/admin use.
 */
router.post('/jobs/scrape', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ message: 'Scrape started', status: 'running' });

    // Run scrape in background (don't await to avoid timeout)
    runAllScrapers()
      .then(result => {
        console.log('Manual scrape completed:', {
          totalJobs: result.totalJobs,
          newJobs: result.newJobs,
          duration: `${(result.duration / 1000).toFixed(1)}s`,
        });
      })
      .catch(err => {
        console.error('Manual scrape failed:', err);
      });
  } catch (err) {
    console.error('POST /api/jobs/scrape error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
