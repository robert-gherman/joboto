-- Joboto - PostgreSQL Schema (Neon-compatible, no Supabase RLS)
-- Run this in your Neon SQL editor to set up the database.

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'Romania',
  type TEXT NOT NULL CHECK (type IN ('remote', 'hybrid', 'onsite')),
  experience_level TEXT NOT NULL CHECK (experience_level IN ('intern', 'junior', 'mid', 'senior', 'lead')),
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  salary TEXT,
  posted_at TIMESTAMPTZ DEFAULT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_tags ON jobs USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_jobs_title_search ON jobs USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_jobs_fts ON jobs USING GIN(
  to_tsvector('english', title || ' ' || company || ' ' || description)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
