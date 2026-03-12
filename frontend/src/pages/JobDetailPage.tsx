import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import type { Job } from '../types';
import { fetchJobById, fetchJobRecommendations } from '../utils/api';
import JobDetail from '../components/JobDetail';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [similarJobs, setSimilarJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const loadJob = async () => {
      setLoading(true);
      setError('');
      try {
        const jobData = await fetchJobById(id);
        setJob(jobData);

        // Fetch similar jobs
        try {
          const similar = await fetchJobRecommendations(jobData.title);
          setSimilarJobs(similar.filter((j) => j.id !== id).slice(0, 5));
        } catch {
          // Not critical
        }
      } catch {
        setError('Failed to load job. It may have been removed.');
      } finally {
        setLoading(false);
      }
    };

    loadJob();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-text-secondary">Loading job details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mb-4">
            <span className="text-3xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Job Not Found</h2>
          <p className="text-sm text-text-secondary mb-6">
            {error || 'This job could not be loaded.'}
          </p>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all duration-200"
          >
            Browse All Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-muted mb-6 animate-fade-in">
        <Link to="/" className="hover:text-text-primary transition-colors duration-200">
          Jobs
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-text-secondary truncate max-w-xs">{job.title}</span>
      </nav>

      <JobDetail job={job} similarJobs={similarJobs} />
    </div>
  );
}
