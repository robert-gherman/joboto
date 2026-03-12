import { useState } from 'react';
import { LayoutGrid, List, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { useJobStore } from '../store/jobStore';
import JobCard from './JobCard';
import SkeletonCard from './SkeletonCard';
import EmptyState from './EmptyState';

export default function JobList() {
  const {
    jobs,
    loading,
    totalJobs,
    currentPage,
    totalPages,
    filters,
    setPage,
    setFilter,
    fetchJobs,
  } = useJobStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleSortChange = (value: string) => {
    setFilter('sort_by', value as 'posted_at' | 'relevance');
    fetchJobs();
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setPage(page);
    fetchJobs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build active filters summary
  const activeFiltersList: string[] = [];
  if (filters.type) activeFiltersList.push(filters.type);
  if (filters.experience_level) activeFiltersList.push(filters.experience_level);
  if (filters.source) activeFiltersList.push(filters.source);
  if (filters.tags.length > 0) activeFiltersList.push(...filters.tags);

  // Page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex-1 min-w-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{totalJobs.toLocaleString()}</span>{' '}
            jobs found
          </span>
          {activeFiltersList.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5">
              {activeFiltersList.slice(0, 3).map((f) => (
                <span
                  key={f}
                  className="px-2 py-0.5 rounded-full text-[11px] bg-primary/10 text-primary-light border border-primary/20"
                >
                  {f}
                </span>
              ))}
              {activeFiltersList.length > 3 && (
                <span className="text-xs text-text-muted">
                  +{activeFiltersList.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={filters.sort_by}
              onChange={(e) => handleSortChange(e.target.value)}
              className="bg-surface-light border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-primary transition-colors duration-200"
              aria-label="Sort jobs"
            >
              <option value="posted_at">Newest First</option>
              <option value="relevance">Most Relevant</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors duration-200 ${
                viewMode === 'grid'
                  ? 'bg-primary/10 text-primary-light'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors duration-200 ${
                viewMode === 'list'
                  ? 'bg-primary/10 text-primary-light'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
              : 'space-y-3'
          }
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && jobs.length === 0 && <EmptyState />}

      {/* Job cards */}
      {!loading && jobs.length > 0 && (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
              : 'space-y-3'
          }
        >
          {jobs.map((job, index) => (
            <JobCard key={job.id} job={job} index={index} view={viewMode} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-8">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-light disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {getPageNumbers().map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-text-muted text-sm">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => handlePageChange(page as number)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentPage === page
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-light'
                }`}
              >
                {page}
              </button>
            )
          )}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-light disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
