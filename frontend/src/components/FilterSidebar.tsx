import { useState, useEffect } from 'react';
import {
  Monitor,
  Home,
  Building2,
  Globe,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { useJobStore } from '../store/jobStore';

const workTypes = [
  { value: '', label: 'All Types', icon: Globe },
  { value: 'remote', label: 'Remote', icon: Monitor },
  { value: 'hybrid', label: 'Hybrid', icon: Home },
  { value: 'onsite', label: 'Onsite', icon: Building2 },
];

const experienceLevels = [
  { value: 'intern', label: 'Intern', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'junior', label: 'Junior', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'mid', label: 'Mid', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'senior', label: 'Senior', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'lead', label: 'Lead', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
];

const dateOptions = [
  { value: '', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '3days', label: 'Last 3 Days' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const popularTags = [
  'React', 'TypeScript', 'Next.js', 'Vue', 'Angular', 'Node.js',
  'JavaScript', 'CSS', 'Tailwind', 'Redux', 'GraphQL', 'REST API',
  'Docker', 'AWS', 'Git', 'Figma', 'Sass', 'Webpack',
];

interface FilterSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function FilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 text-sm font-semibold text-text-primary hover:text-primary-light transition-colors duration-200"
        aria-expanded={isOpen}
      >
        {title}
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function FilterSidebar({ mobileOpen, onMobileClose }: FilterSidebarProps) {
  const { filters, setFilter, resetFilters, fetchJobs, sources, stats } = useJobStore();

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const getDateValue = (option: string) => {
    const now = new Date();
    switch (option) {
      case 'today': {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return today.toISOString();
      }
      case '3days': {
        const d = new Date(now);
        d.setDate(d.getDate() - 3);
        return d.toISOString();
      }
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return d.toISOString();
      }
      case 'month': {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        return d.toISOString();
      }
      default:
        return '';
    }
  };

  const handleDateChange = (option: string) => {
    setFilter('posted_after', getDateValue(option));
    fetchJobs();
  };

  const getCurrentDateOption = () => {
    if (!filters.posted_after) return '';
    const diff = Date.now() - new Date(filters.posted_after).getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours <= 24) return 'today';
    if (hours <= 72) return '3days';
    if (hours <= 168) return 'week';
    return 'month';
  };

  const handleTagToggle = (tag: string) => {
    const tagLower = tag.toLowerCase();
    const currentTags = filters.tags;
    const newTags = currentTags.includes(tagLower)
      ? currentTags.filter((t) => t !== tagLower)
      : [...currentTags, tagLower];
    setFilter('tags', newTags);
    fetchJobs();
  };

  const handleReset = () => {
    resetFilters();
    fetchJobs();
  };

  const hasActiveFilters =
    filters.type ||
    filters.experience_level ||
    filters.posted_after ||
    filters.source ||
    filters.tags.length > 0;

  const sidebarContent = (
    <div className="space-y-4">
      {/* Header with reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-primary-light transition-colors duration-200"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Work Type */}
      <FilterSection title="Work Type">
        <div className="space-y-1">
          {workTypes.map((wt) => {
            const Icon = wt.icon;
            const isActive = filters.type === wt.value;
            return (
              <button
                key={wt.value}
                onClick={() => {
                  setFilter('type', wt.value);
                  fetchJobs();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary-light border border-primary/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-lighter/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{wt.label}</span>
                {stats?.by_type && wt.value && (
                  <span className="text-xs text-text-muted">
                    {stats.by_type[wt.value] || 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Experience Level */}
      <FilterSection title="Experience Level">
        <div className="space-y-1.5">
          {experienceLevels.map((exp) => {
            const isActive = filters.experience_level === exp.value;
            return (
              <button
                key={exp.value}
                onClick={() => {
                  setFilter('experience_level', isActive ? '' : exp.value);
                  fetchJobs();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary-light'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-lighter/30'
                }`}
              >
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${exp.color}`}>
                  {exp.label}
                </span>
                {stats?.by_experience && (
                  <span className="text-xs text-text-muted">
                    {stats.by_experience[exp.value] || 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Date Posted */}
      <FilterSection title="Date Posted">
        <div className="space-y-1">
          {dateOptions.map((opt) => {
            const isActive = getCurrentDateOption() === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleDateChange(opt.value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary-light'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-lighter/30'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Source */}
      {sources.length > 0 && (
        <FilterSection title="Source" defaultOpen={false}>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {sources.map((source) => {
              const isActive = filters.source === source;
              return (
                <button
                  key={source}
                  onClick={() => {
                    setFilter('source', isActive ? '' : source);
                    fetchJobs();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 text-primary-light'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-lighter/30'
                  }`}
                >
                  <span className="capitalize">{source}</span>
                  {stats?.by_source && (
                    <span className="text-xs text-text-muted">
                      {stats.by_source[source] || 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Tags */}
      <FilterSection title="Technologies" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => {
            const isActive = filters.tags.includes(tag.toLowerCase());
            return (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-surface-lighter/50 text-text-secondary hover:text-text-primary hover:bg-surface-lighter'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-20 space-y-4 p-4 rounded-xl bg-surface-card border border-border">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/60 z-40 animate-fade-in"
            onClick={onMobileClose}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-surface-card border-r border-border z-50 overflow-y-auto animate-slide-in">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="text-sm font-semibold text-text-primary">Filters</span>
              <button
                onClick={onMobileClose}
                className="p-1.5 rounded-lg hover:bg-surface-lighter text-text-muted hover:text-text-primary transition-colors duration-200"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">{sidebarContent}</div>
          </div>
        </>
      )}
    </>
  );
}
