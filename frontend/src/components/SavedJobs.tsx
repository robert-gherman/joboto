import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Heart, ExternalLink, Trash2, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Job } from '../types';

interface SavedJobsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SavedJobs({ isOpen, onClose }: SavedJobsProps) {
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = JSON.parse(localStorage.getItem('savedJobs') || '[]');
        setSavedJobs(saved);
      } catch {
        setSavedJobs([]);
      }
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const removeJob = (jobId: string) => {
    const updated = savedJobs.filter((j) => j.id !== jobId);
    setSavedJobs(updated);
    localStorage.setItem('savedJobs', JSON.stringify(updated));
    window.dispatchEvent(new Event('savedJobsUpdated'));
  };

  const clearAll = () => {
    setSavedJobs([]);
    localStorage.setItem('savedJobs', JSON.stringify([]));
    window.dispatchEvent(new Event('savedJobsUpdated'));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-96 max-w-[90vw] bg-surface-card border-l border-border z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-danger" />
            <h2 className="text-lg font-semibold text-text-primary">
              Saved Jobs ({savedJobs.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {savedJobs.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-text-muted hover:text-danger transition-colors duration-200"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-lighter text-text-muted hover:text-text-primary transition-colors duration-200"
              aria-label="Close saved jobs"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {savedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-light flex items-center justify-center mb-4">
                <Briefcase className="w-8 h-8 text-text-muted" />
              </div>
              <h3 className="text-base font-medium text-text-primary mb-1">No saved jobs</h3>
              <p className="text-sm text-text-secondary">
                Click the heart icon on any job to save it here.
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {savedJobs.map((job, index) => (
                <div
                  key={job.id}
                  className="rounded-lg border border-border bg-surface-light/50 p-3 group animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/job/${job.id}`}
                        onClick={onClose}
                        className="text-sm font-medium text-text-primary hover:text-primary-light transition-colors duration-200 line-clamp-1"
                      >
                        {job.title}
                      </Link>
                      <p className="text-xs text-text-secondary mt-0.5">{job.company}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            job.type === 'remote'
                              ? 'bg-success/10 text-success'
                              : job.type === 'hybrid'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-accent/10 text-accent'
                          }`}
                        >
                          {job.type}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {job.posted_at
                            ? formatDistanceToNow(new Date(job.posted_at), { addSuffix: true })
                            : 'Date unknown'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-text-muted hover:text-primary-light transition-colors"
                        aria-label="Open job"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => removeJob(job.id)}
                        className="p-1 rounded text-text-muted hover:text-danger transition-colors"
                        aria-label="Remove from saved"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
