import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Heart,
  ExternalLink,
  Clock,
  DollarSign,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Job } from '../types';

interface JobCardProps {
  job: Job;
  index?: number;
  view?: 'grid' | 'list';
}

const typeStyles: Record<string, string> = {
  remote: 'bg-success/10 text-success border-success/20',
  hybrid: 'bg-warning/10 text-warning border-warning/20',
  onsite: 'bg-accent/10 text-accent border-accent/20',
};

const experienceStyles: Record<string, string> = {
  intern: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  junior: 'bg-green-500/10 text-green-400 border-green-500/20',
  mid: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  senior: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  lead: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const avatarColors = [
  'from-primary to-purple-600',
  'from-accent to-blue-600',
  'from-success to-teal-600',
  'from-warning to-orange-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
  'from-cyan-500 to-teal-600',
  'from-violet-500 to-purple-600',
];

function getAvatarColor(company: string) {
  let hash = 0;
  for (let i = 0; i < company.length; i++) {
    hash = company.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function JobCard({ job, index = 0, view = 'grid' }: JobCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    try {
      const saved: Job[] = JSON.parse(localStorage.getItem('savedJobs') || '[]');
      setIsSaved(saved.some((j) => j.id === job.id));
    } catch {
      setIsSaved(false);
    }
  }, [job.id]);

  const toggleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const saved: Job[] = JSON.parse(localStorage.getItem('savedJobs') || '[]');
      if (isSaved) {
        const updated = saved.filter((j) => j.id !== job.id);
        localStorage.setItem('savedJobs', JSON.stringify(updated));
      } else {
        saved.push(job);
        localStorage.setItem('savedJobs', JSON.stringify(saved));
      }
      setIsSaved(!isSaved);
      window.dispatchEvent(new Event('savedJobsUpdated'));
    } catch {
      // Ignore storage errors
    }
  };

  const postedAgo = (() => {
    if (!job.posted_at) return 'Date unknown';
    try {
      return formatDistanceToNow(new Date(job.posted_at), { addSuffix: true });
    } catch {
      return 'Date unknown';
    }
  })();

  if (view === 'list') {
    return (
      <div
        className="group rounded-xl border border-border bg-surface-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 animate-fade-in"
        style={{ animationDelay: `${index * 50}ms` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center gap-4 p-4">
          {/* Avatar */}
          <div
            className={`w-11 h-11 rounded-lg bg-gradient-to-br ${getAvatarColor(
              job.company
            )} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
          >
            {job.company.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  to={`/job/${job.id}`}
                  className="text-sm font-semibold text-text-primary hover:text-primary-light transition-colors duration-200 line-clamp-1"
                >
                  {job.title}
                </Link>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-text-secondary">{job.company}</span>
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <MapPin className="w-3 h-3" />
                    {job.location}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    typeStyles[job.type] || ''
                  }`}
                >
                  {job.type}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    experienceStyles[job.experience_level] || ''
                  }`}
                >
                  {job.experience_level}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 overflow-hidden">
                {job.salary && (
                  <span className="flex items-center gap-1 text-xs font-medium text-success">
                    <DollarSign className="w-3 h-3" />
                    {job.salary}
                  </span>
                )}
                <div className="flex gap-1 overflow-hidden">
                  {job.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-surface-lighter/50 text-text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                  {job.tags.length > 4 && (
                    <span className="text-[10px] text-text-muted">+{job.tags.length - 4}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Clock className="w-3 h-3" />
                  {postedAgo}
                </span>
                <button
                  onClick={toggleSave}
                  className={`p-1 rounded transition-colors duration-200 ${
                    isSaved
                      ? 'text-danger'
                      : 'text-text-muted hover:text-danger'
                  }`}
                  aria-label={isSaved ? 'Remove from saved' : 'Save job'}
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative rounded-xl border border-border bg-surface-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getAvatarColor(
              job.company
            )} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}
          >
            {job.company.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <Link
              to={`/job/${job.id}`}
              className="block text-base font-semibold text-text-primary hover:text-primary-light transition-colors duration-200 line-clamp-2 leading-tight"
            >
              {job.title}
            </Link>
            <p className="text-sm text-text-secondary mt-0.5">{job.company}</p>
          </div>
          <button
            onClick={toggleSave}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              isSaved
                ? 'text-danger bg-danger/10'
                : 'text-text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100'
            }`}
            aria-label={isSaved ? 'Remove from saved' : 'Save job'}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-xs text-text-muted mb-3">
          <MapPin className="w-3.5 h-3.5" />
          <span>{job.location}</span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              typeStyles[job.type] || ''
            }`}
          >
            {job.type}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              experienceStyles[job.experience_level] || ''
            }`}
          >
            {job.experience_level}
          </span>
          {job.salary && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success border border-success/20">
              <DollarSign className="w-3 h-3" />
              {job.salary}
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {job.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md text-[11px] bg-surface-lighter/50 text-text-secondary"
            >
              {tag}
            </span>
          ))}
          {job.tags.length > 5 && (
            <span className="px-2 py-0.5 text-[11px] text-text-muted">
              +{job.tags.length - 5}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <Clock className="w-3 h-3" />
            <span>{postedAgo}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted capitalize px-1.5 py-0.5 rounded bg-surface-lighter/30">
              {job.source}
            </span>
            {/* Quick apply & view details on hover */}
            <div
              className={`flex items-center gap-1 transition-all duration-200 ${
                isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
              }`}
            >
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-primary hover:bg-primary-dark text-white transition-colors duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
                Apply
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
