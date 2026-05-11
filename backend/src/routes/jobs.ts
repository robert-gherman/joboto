import { Router, Request, Response } from 'express';
import pool from '../utils/db';
import { JobFilters, Job } from '../types';
import { runAllScrapers } from '../scrapers';
import { sendNewJobsEmail } from '../utils/email';

const router = Router();

const ROMANIA_TERMS = [
  'romania', 'bucharest', 'bucurești', 'cluj', 'timișoara', 'timisoara',
  'iași', 'iasi', 'brașov', 'brasov', 'constanța', 'constanta',
  'sibiu', 'craiova', 'galați', 'galati', 'oradea', 'brăila', 'braila',
  'pitești', 'pitesti', 'arad', 'ploiești', 'ploiesti', 'târgu mureș',
  'targu mures', 'baia mare', 'buzău', 'buzau', 'satu mare', 'suceava',
];

const ROMANIA_REGEX = `(${ROMANIA_TERMS.join('|')})`;

function buildWhereClause(filters: JobFilters): { where: string; params: unknown[] } {
  const conditions: string[] = ['is_active = true'];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const p = `$${params.length}`;
    conditions.push(`(title ILIKE ${p} OR company ILIKE ${p} OR description ILIKE ${p})`);
  }

  if (filters.type) {
    params.push(filters.type);
    conditions.push(`type = $${params.length}`);
  }

  if (filters.experience_level) {
    params.push(filters.experience_level);
    conditions.push(`experience_level = $${params.length}`);
  }

  if (filters.source) {
    params.push(filters.source);
    conditions.push(`source ILIKE $${params.length}`);
  }

  if (filters.posted_after) {
    params.push(filters.posted_after);
    conditions.push(`posted_at >= $${params.length}`);
  }

  if (filters.tags && filters.tags.length > 0) {
    params.push(filters.tags);
    conditions.push(`tags @> $${params.length}::text[]`);
  }

  if (filters.location_romania) {
    conditions.push(`location ~* '${ROMANIA_REGEX}'`);
  }

  return { where: conditions.join(' AND '), params };
}

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
      location_romania: req.query.location_romania === 'true',
    };

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    const { where, params } = buildWhereClause(filters);

    if (filters.hide_duplicates) {
      const allJobs: any[] = [];
      const batchSize = 1000;
      let batchOffset = 0;
      let hasMore = true;

      while (hasMore) {
        const batchParams = [...params, batchSize, batchOffset];
        const limitIdx = `$${batchParams.length - 1}`;
        const offsetIdx = `$${batchParams.length}`;

        const { rows } = await pool.query(
          `SELECT * FROM jobs WHERE ${where} ORDER BY posted_at DESC NULLS LAST LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
          batchParams
        );

        if (rows.length > 0) {
          allJobs.push(...rows);
          batchOffset += rows.length;
          hasMore = rows.length === batchSize;
        } else {
          hasMore = false;
        }
      }

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
      const countParams = [...params];
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) FROM jobs WHERE ${where}`,
        countParams
      );
      const total = parseInt(countRows[0].count, 10);

      const dataParams = [...params, limit, offset];
      const limitIdx = `$${dataParams.length - 1}`;
      const offsetIdx = `$${dataParams.length}`;

      const { rows } = await pool.query(
        `SELECT * FROM jobs WHERE ${where} ORDER BY posted_at DESC NULLS LAST LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
        dataParams
      );

      res.json({
        jobs: rows,
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
          hide_duplicates: false,
        },
      });
    }
  } catch (err) {
    console.error('GET /api/jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/jobs/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekISO = weekAgo.toISOString();

    const [totalsResult, sourceResult, typeResult, expResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN posted_at >= $1 THEN 1 ELSE 0 END) as new_today,
                SUM(CASE WHEN posted_at >= $2 THEN 1 ELSE 0 END) as new_this_week
         FROM jobs WHERE is_active = true`,
        [todayISO, weekISO]
      ),
      pool.query(
        `SELECT source, COUNT(*) as count FROM jobs WHERE is_active = true GROUP BY source`
      ),
      pool.query(
        `SELECT type, COUNT(*) as count FROM jobs WHERE is_active = true GROUP BY type`
      ),
      pool.query(
        `SELECT experience_level, COUNT(*) as count FROM jobs WHERE is_active = true GROUP BY experience_level`
      ),
    ]);

    const totals = totalsResult.rows[0];
    const bySource: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byExperience: Record<string, number> = {};

    for (const row of sourceResult.rows) bySource[row.source] = parseInt(row.count, 10);
    for (const row of typeResult.rows) byType[row.type] = parseInt(row.count, 10);
    for (const row of expResult.rows) byExperience[row.experience_level] = parseInt(row.count, 10);

    res.json({
      total_jobs: parseInt(totals.total, 10),
      new_today: parseInt(totals.new_today, 10) || 0,
      new_this_week: parseInt(totals.new_this_week, 10) || 0,
      by_source: bySource,
      by_type: byType,
      by_experience_level: byExperience,
    });
  } catch (err) {
    console.error('GET /api/jobs/stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/jobs/recommendations', async (req: Request, res: Response): Promise<void> => {
  try {
    const queryText = (req.query.q as string) || '';
    const limit = Math.min(50, parseInt(req.query.limit as string, 10) || 10);

    if (!queryText.trim()) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const { rows: jobs } = await pool.query(
      `SELECT * FROM jobs WHERE is_active = true ORDER BY posted_at DESC NULLS LAST LIMIT 500`
    );

    if (jobs.length === 0) {
      res.json({ recommendations: [], query: queryText });
      return;
    }

    const queryTerms = queryText
      .toLowerCase()
      .replace(/[^\w\s.-]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 1);

    const docFreq: Record<string, number> = {};
    for (const term of queryTerms) {
      docFreq[term] = jobs.filter(job => {
        const text = `${job.title} ${job.company} ${job.description} ${(job.tags || []).join(' ')}`.toLowerCase();
        return text.includes(term);
      }).length;
    }

    const totalDocs = jobs.length;

    const scored = jobs.map(job => {
      const text = `${job.title} ${job.company} ${job.description} ${(job.tags || []).join(' ')}`.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = text.match(regex);
        const tf = matches ? matches.length : 0;

        if (tf === 0) continue;

        const df = docFreq[term] || 1;
        const idf = Math.log(totalDocs / df);
        let termScore = tf * idf;

        if (job.title.toLowerCase().includes(term)) {
          termScore *= 3;
        }

        if ((job.tags || []).some((t: string) => t.toLowerCase().includes(term))) {
          termScore *= 2;
        }

        score += termScore;
      }

      const postedDate = new Date(job.posted_at).getTime();
      const now = Date.now();
      const daysSincePosted = (now - postedDate) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, 1 - daysSincePosted / 30);
      score += recencyBoost * 0.5;

      return {
        ...job,
        relevance_score: Math.round(score * 100) / 100,
      };
    });

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

router.get('/jobs/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const minutes = Math.min(1440, Math.max(1, parseInt(req.query.minutes as string, 10) || 15));
    const since = req.query.since as string | undefined;
    const maxAgeHours = Math.min(48, Math.max(1, parseInt(req.query.max_age_hours as string, 10) || 4));

    const cutoff = since || new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const postedAfter = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

    const { rows, rowCount } = await pool.query(
      `SELECT * FROM jobs
       WHERE is_active = true AND created_at > $1 AND posted_at >= $2
       ORDER BY created_at DESC LIMIT 50`,
      [cutoff, postedAfter]
    );

    res.json({
      jobs: rows,
      count: rowCount ?? rows.length,
      since: cutoff,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('GET /api/jobs/recent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sources', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT source AS name, COUNT(*)::int AS count
       FROM jobs WHERE is_active = true
       GROUP BY source ORDER BY count DESC`
    );

    res.json({ sources: rows });
  } catch (err) {
    console.error('GET /api/sources error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/jobs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT * FROM jobs WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ job: rows[0] });
  } catch (err) {
    console.error('GET /api/jobs/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notifications/email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { job_ids } = req.body as { job_ids: string[] };

    if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
      res.status(400).json({ error: 'job_ids array is required' });
      return;
    }

    const ids = job_ids.slice(0, 20);

    const { rows: jobs } = await pool.query(
      `SELECT * FROM jobs WHERE id = ANY($1::text[])`,
      [ids]
    );

    if (jobs.length === 0) {
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

router.post('/jobs/scrape', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ message: 'Scrape started', status: 'running' });

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
