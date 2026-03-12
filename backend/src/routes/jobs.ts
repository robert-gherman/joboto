import { Router, Request, Response } from 'express';
import supabase from '../utils/supabase';
import { JobFilters } from '../types';
import { runAllScrapers } from '../scrapers';

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

    // Sorting
    if (filters.sort_by === 'posted_at') {
      query = query.order('posted_at', { ascending: false });
    } else {
      // For relevance, sort by posted_at descending as fallback
      // (true relevance scoring is handled in the recommendations endpoint)
      query = query.order('posted_at', { ascending: false });
    }

    // Pagination
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
      },
    });
  } catch (err) {
    console.error('GET /api/jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/jobs/stats
 * Aggregated statistics about the job listings.
 */
router.get('/jobs/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Total active jobs
    const { count: totalJobs } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Jobs by source
    const { data: sourceData } = await supabase
      .from('jobs')
      .select('source')
      .eq('is_active', true);

    const bySource: Record<string, number> = {};
    sourceData?.forEach(row => {
      bySource[row.source] = (bySource[row.source] || 0) + 1;
    });

    // Jobs by type
    const { data: typeData } = await supabase
      .from('jobs')
      .select('type')
      .eq('is_active', true);

    const byType: Record<string, number> = {};
    typeData?.forEach(row => {
      byType[row.type] = (byType[row.type] || 0) + 1;
    });

    // Jobs by experience level
    const { data: expData } = await supabase
      .from('jobs')
      .select('experience_level')
      .eq('is_active', true);

    const byExperience: Record<string, number> = {};
    expData?.forEach(row => {
      byExperience[row.experience_level] = (byExperience[row.experience_level] || 0) + 1;
    });

    // New jobs today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: newToday } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('scraped_at', todayStart.toISOString());

    res.json({
      total_jobs: totalJobs || 0,
      new_today: newToday || 0,
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
 * GET /api/sources
 * List all available sources with their job counts.
 */
router.get('/sources', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('source')
      .eq('is_active', true);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch sources', details: error.message });
      return;
    }

    const sourceCounts: Record<string, number> = {};
    data?.forEach(row => {
      sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1;
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
