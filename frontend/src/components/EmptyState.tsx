import { SearchX, RefreshCw } from 'lucide-react';
import { useJobStore } from '../store/jobStore';

interface EmptyStateProps {
  title?: string;
  message?: string;
  showResetButton?: boolean;
}

export default function EmptyState({
  title = 'No jobs found',
  message = 'Try adjusting your filters or search terms to find more results.',
  showResetButton = true,
}: EmptyStateProps) {
  const resetFilters = useJobStore((s) => s.resetFilters);
  const fetchJobs = useJobStore((s) => s.fetchJobs);

  const handleReset = () => {
    resetFilters();
    fetchJobs();
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-surface-light flex items-center justify-center mb-6">
        <SearchX className="w-10 h-10 text-text-muted" />
      </div>
      <h3 className="text-xl font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary text-sm text-center max-w-md mb-6">{message}</p>
      {showResetButton && (
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Filters
        </button>
      )}
    </div>
  );
}
