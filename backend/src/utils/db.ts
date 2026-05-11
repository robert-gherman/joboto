import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Return timestamps as ISO strings instead of Date objects (matches Supabase behavior)
pg.types.setTypeParser(1114, (str: string) => str);
pg.types.setTypeParser(1184, (str: string) => str);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    'Missing DATABASE_URL environment variable. ' +
    'Please set it in your .env file (e.g. your Neon connection string).'
  );
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  max: 10,
});

export default pool;

export async function upsertJobs(jobs: Record<string, unknown>[]): Promise<number> {
  if (jobs.length === 0) return 0;

  const columns = [
    'id', 'title', 'company', 'location', 'type', 'experience_level',
    'description', 'url', 'source', 'salary', 'posted_at', 'scraped_at',
    'tags', 'is_active',
  ];

  const updateCols = columns
    .filter(c => c !== 'id')
    .map(c => `${c} = EXCLUDED.${c}`)
    .join(', ');

  const batchSize = 100;
  let upsertedCount = 0;

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const values: unknown[] = [];
    const valueRows: string[] = [];

    for (const job of batch) {
      const row: string[] = [];
      for (const col of columns) {
        values.push(job[col] ?? null);
        const idx = values.length;
        row.push(col === 'tags' ? `$${idx}::text[]` : `$${idx}`);
      }
      valueRows.push(`(${row.join(', ')})`);
    }

    const query = `
      INSERT INTO jobs (${columns.join(', ')})
      VALUES ${valueRows.join(', ')}
      ON CONFLICT (id) DO UPDATE SET ${updateCols}
    `;

    try {
      const result = await pool.query(query, values);
      upsertedCount += result.rowCount ?? batch.length;
    } catch (err: any) {
      console.error(`Upsert error (batch ${Math.floor(i / batchSize) + 1}):`, err.message);
    }
  }

  return upsertedCount;
}

export async function shutdownPool(): Promise<void> {
  await pool.end();
}
