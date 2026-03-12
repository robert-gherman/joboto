import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables. ' +
    'Please set them in your .env file.'
  );
}

const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export default supabase;

/**
 * Upsert jobs into the database. Uses the job `id` as the conflict key.
 * Returns the count of successfully upserted jobs.
 */
export async function upsertJobs(jobs: Record<string, unknown>[]): Promise<number> {
  if (jobs.length === 0) return 0;

  const batchSize = 100;
  let upsertedCount = 0;

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const { error, data } = await supabase
      .from('jobs')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
      .select('id');

    if (error) {
      console.error(`Supabase upsert error (batch ${i / batchSize + 1}):`, error.message);
    } else {
      upsertedCount += data?.length ?? batch.length;
    }
  }

  return upsertedCount;
}
