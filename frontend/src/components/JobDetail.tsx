import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  ExternalLink,
  Share2,
  Sparkles,
  Clock,
  Building2,
  DollarSign,
  Loader2,
  Check,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { Job, AITips } from '../types';
import { getJobTips } from '../utils/api';

interface JobDetailProps {
  job: Job;
  similarJobs?: Job[];
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

export default function JobDetail({ job, similarJobs = [] }: JobDetailProps) {
  const [tips, setTips] = useState<AITips | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGetTips = async () => {
    if (tips) return;
    setTipsLoading(true);
    setTipsError('');
    try {
      const result = await getJobTips(job.id);
      setTips(result);
    } catch {
      setTipsError('Failed to get AI tips. Please try again.');
    } finally {
      setTipsLoading(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const postedDate = (() => {
    if (!job.posted_at) return 'Date unknown';
    try {
      return format(new Date(job.posted_at), 'MMM d, yyyy');
    } catch {
      return 'Date unknown';
    }
  })();

  const postedAgo = (() => {
    if (!job.posted_at) return '';
    try {
      return formatDistanceToNow(new Date(job.posted_at), { addSuffix: true });
    } catch {
      return '';
    }
  })();

  return (
    <div className="animate-fade-in">
      {/* Back navigation */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-200 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to results
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="rounded-xl border border-border bg-surface-card p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {job.company.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-text-primary leading-tight">
                  {job.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-sm text-text-secondary">
                    <Building2 className="w-4 h-4" />
                    {job.company}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-text-secondary">
                    <MapPin className="w-4 h-4" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-text-muted">
                    <Calendar className="w-4 h-4" />
                    {postedDate}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      typeStyles[job.type] || ''
                    }`}
                  >
                    {job.type}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      experienceStyles[job.experience_level] || ''
                    }`}
                  >
                    {job.experience_level}
                  </span>
                  {job.salary && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                      <DollarSign className="w-3 h-3" />
                      {job.salary}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-border">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <ExternalLink className="w-4 h-4" />
                Apply Now
              </a>
              <button
                onClick={handleGetTips}
                disabled={tipsLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent-light text-sm font-medium border border-accent/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {tipsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                AI Tips
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-light hover:bg-surface-lighter text-text-secondary text-sm font-medium transition-all duration-200"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-success" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Share
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl border border-border bg-surface-card p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Job Description</h2>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </div>

          {/* Tags */}
          {job.tags.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-card p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Technologies & Tags</h2>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-lg text-sm bg-surface-lighter/50 text-text-secondary border border-border hover:border-primary/30 hover:text-primary-light transition-all duration-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Tips */}
          {tipsError && (
            <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
              {tipsError}
            </div>
          )}

          {tips && (
            <div className="rounded-xl border border-accent/20 bg-surface-card p-6 animate-scale-in">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="w-5 h-5 text-accent-light" />
                <h2 className="text-lg font-semibold text-text-primary">AI-Powered Tips</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tips.tips.length > 0 && (
                  <div className="p-4 rounded-lg bg-surface-light border border-border">
                    <h3 className="text-sm font-semibold text-text-primary mb-2">General Tips</h3>
                    <ul className="space-y-1.5">
                      {tips.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                          <span className="text-primary-light mt-0.5">-</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tips.skills_to_highlight.length > 0 && (
                  <div className="p-4 rounded-lg bg-surface-light border border-border">
                    <h3 className="text-sm font-semibold text-text-primary mb-2">
                      Skills to Highlight
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {tips.skills_to_highlight.map((skill, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary-light border border-primary/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {tips.interview_prep.length > 0 && (
                  <div className="p-4 rounded-lg bg-surface-light border border-border">
                    <h3 className="text-sm font-semibold text-text-primary mb-2">
                      Interview Prep
                    </h3>
                    <ul className="space-y-1.5">
                      {tips.interview_prep.map((q, i) => (
                        <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                          <span className="text-accent-light mt-0.5">-</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tips.company_research.length > 0 && (
                  <div className="p-4 rounded-lg bg-surface-light border border-border">
                    <h3 className="text-sm font-semibold text-text-primary mb-2">
                      Company Research
                    </h3>
                    <ul className="space-y-1.5">
                      {tips.company_research.map((item, i) => (
                        <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                          <span className="text-success mt-0.5">-</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Company info */}
          <div className="rounded-xl border border-border bg-surface-card p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">About the Company</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                {job.company.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{job.company}</p>
                <p className="text-xs text-text-muted capitalize">{job.source}</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-text-muted" />
                {job.location}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-text-muted" />
                Posted {postedAgo}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="rounded-xl border border-border bg-surface-card p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Job Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Type</span>
                <span className="text-text-primary capitalize">{job.type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Level</span>
                <span className="text-text-primary capitalize">{job.experience_level}</span>
              </div>
              {job.salary && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Salary</span>
                  <span className="text-success font-medium">{job.salary}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Source</span>
                <span className="text-text-primary capitalize">{job.source}</span>
              </div>
            </div>
          </div>

          {/* Similar Jobs */}
          {similarJobs.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-card p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Similar Jobs</h3>
              <div className="space-y-3">
                {similarJobs.slice(0, 5).map((sJob) => (
                  <Link
                    key={sJob.id}
                    to={`/job/${sJob.id}`}
                    className="block p-3 rounded-lg hover:bg-surface-light transition-colors duration-200 group"
                  >
                    <p className="text-sm font-medium text-text-primary group-hover:text-primary-light transition-colors duration-200 line-clamp-1">
                      {sJob.title}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{sJob.company}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          typeStyles[sJob.type] || ''
                        }`}
                      >
                        {sJob.type}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
