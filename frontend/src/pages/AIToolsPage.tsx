import { useState } from 'react';
import {
  FileText,
  Lightbulb,
  PenTool,
  Loader2,
  Search,
  Copy,
  Check,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Job, ResumeAnalysis, AITips } from '../types';
import { analyzeResume, getJobTips, generateCoverLetter, fetchJobs } from '../utils/api';

type Tab = 'resume' | 'tips' | 'cover-letter';

const tabs: { id: Tab; label: string; icon: typeof FileText; description: string }[] = [
  {
    id: 'resume',
    label: 'Resume Analyzer',
    icon: FileText,
    description: 'Analyze your resume and find matching jobs',
  },
  {
    id: 'tips',
    label: 'Job Tips',
    icon: Lightbulb,
    description: 'Get AI-powered tips for any job listing',
  },
  {
    id: 'cover-letter',
    label: 'Cover Letter',
    icon: PenTool,
    description: 'Generate a tailored cover letter',
  },
];

export default function AIToolsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('resume');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-light text-xs font-medium mb-4 border border-accent/20">
          <Sparkles className="w-3.5 h-3.5" />
          AI-Powered Tools
        </div>
        <h1 className="text-3xl font-bold text-text-primary">
          Supercharge Your Job Search
        </h1>
        <p className="mt-2 text-text-secondary max-w-lg mx-auto">
          Use AI to analyze your resume, get personalized job tips, and generate cover letters.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-8 justify-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-surface-card text-text-secondary hover:text-text-primary border border-border hover:border-primary/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="animate-scale-in" key={activeTab}>
        {activeTab === 'resume' && <ResumeAnalyzerTab />}
        {activeTab === 'tips' && <JobTipsTab />}
        {activeTab === 'cover-letter' && <CoverLetterTab />}
      </div>
    </div>
  );
}

// ============ Resume Analyzer Tab ============
function ResumeAnalyzerTab() {
  const [resumeText, setResumeText] = useState('');
  const [result, setResult] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!resumeText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const analysis = await analyzeResume(resumeText);
      setResult(analysis);
    } catch {
      setError('Failed to analyze resume. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-card p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Paste Your Resume</h2>
        <p className="text-sm text-text-secondary mb-4">
          Paste your resume text below and our AI will extract skills, detect your experience level,
          and find matching jobs.
        </p>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your resume or CV text here..."
          className="w-full h-48 p-4 rounded-lg bg-surface-light border border-border text-text-primary placeholder-text-muted text-sm resize-none focus:outline-none focus:border-primary transition-colors duration-200"
          aria-label="Resume text"
        />
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-text-muted">{resumeText.length} characters</span>
          <button
            onClick={handleAnalyze}
            disabled={loading || !resumeText.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {loading ? 'Analyzing...' : 'Analyze Resume'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-fade-in">
          {/* Experience Level */}
          <div className="rounded-xl border border-border bg-surface-card p-6">
            <h3 className="text-base font-semibold text-text-primary mb-3">
              Detected Experience Level
            </h3>
            <div className="inline-flex px-4 py-2 rounded-full bg-primary/10 text-primary-light text-sm font-medium border border-primary/20 capitalize">
              {result.experience_level}
            </div>
          </div>

          {/* Skills */}
          <div className="rounded-xl border border-border bg-surface-card p-6">
            <h3 className="text-base font-semibold text-text-primary mb-3">Extracted Skills</h3>
            <div className="flex flex-wrap gap-2">
              {result.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 rounded-lg text-sm bg-accent/10 text-accent-light border border-accent/20"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="rounded-xl border border-warning/20 bg-surface-card p-6">
              <h3 className="text-base font-semibold text-text-primary mb-3">
                Improvement Suggestions
              </h3>
              <ul className="space-y-2">
                {result.suggestions.map((suggestion, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-warning mt-0.5 font-bold">-</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Matching Jobs */}
          {result.matching_jobs.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-card p-6">
              <h3 className="text-base font-semibold text-text-primary mb-4">
                Top Matching Jobs ({result.matching_jobs.length})
              </h3>
              <div className="space-y-3">
                {result.matching_jobs.map((job) => (
                  <Link
                    key={job.id}
                    to={`/job/${job.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-surface-light transition-colors duration-200 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary group-hover:text-primary-light transition-colors">
                        {job.title}
                      </p>
                      <p className="text-xs text-text-muted">{job.company}</p>
                    </div>
                    {/* Match score bar */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-20 h-2 rounded-full bg-surface-lighter overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                          style={{ width: `${job.match_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-primary-light w-8 text-right">
                        {job.match_score}%
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-light transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Job Tips Tab ============
function JobTipsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [tips, setTips] = useState<AITips | null>(null);
  const [searching, setSearching] = useState(false);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSelectedJob(null);
    setTips(null);
    try {
      const result = await fetchJobs({ search: searchQuery, limit: 10 });
      setJobs(result.data);
    } catch {
      setJobs([]);
    } finally {
      setSearching(false);
    }
  };

  const handleGetTips = async (job: Job) => {
    setSelectedJob(job);
    setTipsLoading(true);
    setError('');
    try {
      const result = await getJobTips(job.id);
      setTips(result);
    } catch {
      setError('Failed to get tips. Please try again.');
    } finally {
      setTipsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search for a job */}
      <div className="rounded-xl border border-border bg-surface-card p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Search for a Job</h2>
        <p className="text-sm text-text-secondary mb-4">
          Find a job listing and get AI-generated tips for your application.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by job title..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-light border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-primary transition-colors duration-200"
              aria-label="Search jobs for tips"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all duration-200 disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {/* Job results */}
        {jobs.length > 0 && (
          <div className="mt-4 space-y-2">
            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => handleGetTips(job)}
                className={`w-full text-left flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                  selectedJob?.id === job.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-surface-light border border-transparent'
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{job.title}</p>
                  <p className="text-xs text-text-muted">
                    {job.company} - {job.location}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tips display */}
      {tipsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="ml-3 text-sm text-text-secondary">Generating tips...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {tips && selectedJob && !tipsLoading && (
        <div className="space-y-4 animate-fade-in">
          <div className="text-sm text-text-secondary">
            Tips for: <span className="text-text-primary font-medium">{selectedJob.title}</span> at{' '}
            <span className="text-text-primary font-medium">{selectedJob.company}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tips.tips.length > 0 && (
              <div className="rounded-xl border border-border bg-surface-card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-warning" />
                  Application Tips
                </h3>
                <ul className="space-y-2">
                  {tips.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                      <span className="text-warning mt-0.5">-</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tips.skills_to_highlight.length > 0 && (
              <div className="rounded-xl border border-border bg-surface-card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-light" />
                  Skills to Highlight
                </h3>
                <div className="flex flex-wrap gap-2">
                  {tips.skills_to_highlight.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs bg-primary/10 text-primary-light border border-primary/20"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {tips.interview_prep.length > 0 && (
              <div className="rounded-xl border border-border bg-surface-card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent-light" />
                  Interview Prep
                </h3>
                <ul className="space-y-2">
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
              <div className="rounded-xl border border-border bg-surface-card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-success" />
                  Company Research
                </h3>
                <ul className="space-y-2">
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
  );
}

// ============ Cover Letter Tab ============
function CoverLetterTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [userName, setUserName] = useState('');
  const [userSkills, setUserSkills] = useState('');
  const [userExperience, setUserExperience] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSelectedJob(null);
    setCoverLetter('');
    try {
      const result = await fetchJobs({ search: searchQuery, limit: 10 });
      setJobs(result.data);
    } catch {
      setJobs([]);
    } finally {
      setSearching(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedJob || !userName.trim() || !userSkills.trim() || !userExperience.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const result = await generateCoverLetter({
        job_id: selectedJob.id,
        user_name: userName,
        user_skills: userSkills,
        user_experience: userExperience,
      });
      setCoverLetter(result.cover_letter);
    } catch {
      setError('Failed to generate cover letter. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Select a job */}
      <div className="rounded-xl border border-border bg-surface-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
            1
          </span>
          <h2 className="text-lg font-semibold text-text-primary">Select a Job</h2>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for a job..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-light border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-primary transition-colors duration-200"
              aria-label="Search jobs for cover letter"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all duration-200 disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>

        {jobs.length > 0 && (
          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`w-full text-left flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                  selectedJob?.id === job.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-surface-light border border-transparent'
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{job.title}</p>
                  <p className="text-xs text-text-muted">{job.company}</p>
                </div>
                {selectedJob?.id === job.id && (
                  <Check className="w-4 h-4 text-primary-light" />
                )}
              </button>
            ))}
          </div>
        )}

        {selectedJob && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary-light">
            Selected: {selectedJob.title} at {selectedJob.company}
          </div>
        )}
      </div>

      {/* Step 2: Your information */}
      <div className="rounded-xl border border-border bg-surface-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
            2
          </span>
          <h2 className="text-lg font-semibold text-text-primary">Your Information</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-text-secondary mb-1.5">
              Your Name
            </label>
            <input
              id="userName"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-2.5 rounded-lg bg-surface-light border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-primary transition-colors duration-200"
            />
          </div>
          <div>
            <label htmlFor="userSkills" className="block text-sm font-medium text-text-secondary mb-1.5">
              Key Skills
            </label>
            <input
              id="userSkills"
              type="text"
              value={userSkills}
              onChange={(e) => setUserSkills(e.target.value)}
              placeholder="React, TypeScript, Node.js, 5+ years frontend experience..."
              className="w-full px-4 py-2.5 rounded-lg bg-surface-light border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-primary transition-colors duration-200"
            />
          </div>
          <div>
            <label htmlFor="userExperience" className="block text-sm font-medium text-text-secondary mb-1.5">
              Experience Summary
            </label>
            <textarea
              id="userExperience"
              value={userExperience}
              onChange={(e) => setUserExperience(e.target.value)}
              placeholder="Brief description of your relevant experience..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-surface-light border border-border text-text-primary placeholder-text-muted text-sm resize-none focus:outline-none focus:border-primary transition-colors duration-200"
            />
          </div>
        </div>
      </div>

      {/* Step 3: Generate */}
      <div className="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={generating || !selectedJob || !userName.trim() || !userSkills.trim() || !userExperience.trim()}
          className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PenTool className="w-4 h-4" />
          )}
          {generating ? 'Generating...' : 'Generate Cover Letter'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Generated Cover Letter */}
      {coverLetter && (
        <div className="rounded-xl border border-primary/20 bg-surface-card p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Your Cover Letter</h3>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-light hover:bg-surface-lighter text-text-secondary text-xs font-medium transition-all duration-200"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-success" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="p-5 rounded-lg bg-surface-light border border-border text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {coverLetter}
          </div>
        </div>
      )}
    </div>
  );
}
