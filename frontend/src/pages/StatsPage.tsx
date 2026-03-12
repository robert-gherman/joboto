import { useEffect } from 'react';
import {
  Briefcase,
  Zap,
  Globe,
  TrendingUp,
  Database,
  Users,
  BarChart3,
} from 'lucide-react';
import { useJobStore } from '../store/jobStore';
import StatsCard from '../components/StatsCard';

export default function StatsPage() {
  const { stats, fetchStats, fetchSources } = useJobStore();

  useEffect(() => {
    fetchStats();
    fetchSources();
  }, [fetchStats, fetchSources]);

  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const totalByType = Object.values(stats.by_type).reduce((a, b) => a + b, 0) || 1;
  const remotePercent = Math.round(((stats.by_type?.remote || 0) / totalByType) * 100);
  const sourceEntries = Object.entries(stats.by_source).sort((a, b) => b[1] - a[1]);
  const maxSourceCount = Math.max(...sourceEntries.map(([, v]) => v), 1);
  const typeEntries = Object.entries(stats.by_type);
  const totalTypeCount = typeEntries.reduce((acc, [, v]) => acc + v, 0) || 1;
  const experienceEntries = Object.entries(stats.by_experience).sort((a, b) => b[1] - a[1]);
  const maxExpCount = Math.max(...experienceEntries.map(([, v]) => v), 1);

  // Colors for pie chart segments
  const typeColors: Record<string, string> = {
    remote: '#10b981',
    hybrid: '#f59e0b',
    onsite: '#06b6d4',
  };

  // Build conic-gradient for CSS pie chart
  const buildConicGradient = () => {
    let accumulated = 0;
    const segments: string[] = [];
    typeEntries.forEach(([type, count]) => {
      const pct = (count / totalTypeCount) * 100;
      const color = typeColors[type] || '#64748b';
      segments.push(`${color} ${accumulated}% ${accumulated + pct}%`);
      accumulated += pct;
    });
    return `conic-gradient(${segments.join(', ')})`;
  };

  // Experience level colors
  const expColors: Record<string, string> = {
    intern: '#3b82f6',
    junior: '#10b981',
    mid: '#f59e0b',
    senior: '#f97316',
    lead: '#ef4444',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-6 h-6 text-primary-light" />
          <h1 className="text-2xl font-bold text-text-primary">Job Market Stats</h1>
        </div>
        <p className="text-text-secondary">
          Real-time overview of the frontend job market in Romania.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          value={stats.total}
          label="Total Jobs"
          icon={<Briefcase className="w-6 h-6" />}
          delay={0}
        />
        <StatsCard
          value={stats.new_today}
          label="New Today"
          icon={<Zap className="w-6 h-6" />}
          trend={{ value: 12, isPositive: true }}
          delay={100}
        />
        <StatsCard
          value={remotePercent}
          label="Remote %"
          icon={<Globe className="w-6 h-6" />}
          delay={200}
        />
        <StatsCard
          value={stats.new_this_week}
          label="New This Week"
          icon={<TrendingUp className="w-6 h-6" />}
          delay={300}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Jobs per Source - Bar Chart */}
        <div className="rounded-xl border border-border bg-surface-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Database className="w-5 h-5 text-primary-light" />
            <h2 className="text-lg font-semibold text-text-primary">Jobs by Source</h2>
          </div>
          <div className="space-y-3">
            {sourceEntries.map(([source, count], index) => (
              <div key={source} className="animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-secondary capitalize">{source}</span>
                  <span className="text-sm font-medium text-text-primary">{count}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-surface-lighter overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light transition-all duration-700 ease-out"
                    style={{
                      width: `${(count / maxSourceCount) * 100}%`,
                      transitionDelay: `${index * 100}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Work Type - Pie Chart */}
        <div className="rounded-xl border border-border bg-surface-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Globe className="w-5 h-5 text-accent-light" />
            <h2 className="text-lg font-semibold text-text-primary">Work Type Distribution</h2>
          </div>
          <div className="flex items-center gap-8">
            {/* CSS Pie Chart */}
            <div className="relative w-40 h-40 flex-shrink-0">
              <div
                className="w-full h-full rounded-full"
                style={{ background: buildConicGradient() }}
              />
              <div className="absolute inset-4 rounded-full bg-surface-card flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold text-text-primary">{totalTypeCount}</p>
                  <p className="text-xs text-text-muted">Total</p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3 flex-1">
              {typeEntries.map(([type, count]) => {
                const pct = Math.round((count / totalTypeCount) * 100);
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: typeColors[type] || '#64748b' }}
                      />
                      <span className="text-sm text-text-secondary capitalize">{type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{count}</span>
                      <span className="text-xs text-text-muted">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Experience Level Breakdown */}
        <div className="rounded-xl border border-border bg-surface-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-text-primary">Experience Levels</h2>
          </div>
          <div className="space-y-4">
            {experienceEntries.map(([level, count], index) => {
              const pct = Math.round((count / maxExpCount) * 100);
              return (
                <div
                  key={level}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-text-secondary capitalize">{level}</span>
                    <span className="text-sm font-medium text-text-primary">{count} jobs</span>
                  </div>
                  <div className="w-full h-4 rounded-full bg-surface-lighter overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: expColors[level] || '#64748b',
                        transitionDelay: `${index * 100}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Tags */}
        <div className="rounded-xl border border-border bg-surface-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-success" />
            <h2 className="text-lg font-semibold text-text-primary">Trending Technologies</h2>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            Most commonly mentioned technologies across all job listings.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { tag: 'React', size: 'text-base', weight: 'font-bold' },
              { tag: 'TypeScript', size: 'text-base', weight: 'font-bold' },
              { tag: 'JavaScript', size: 'text-sm', weight: 'font-semibold' },
              { tag: 'Next.js', size: 'text-sm', weight: 'font-semibold' },
              { tag: 'Node.js', size: 'text-sm', weight: 'font-medium' },
              { tag: 'CSS', size: 'text-xs', weight: 'font-medium' },
              { tag: 'Vue', size: 'text-xs', weight: 'font-medium' },
              { tag: 'Angular', size: 'text-xs', weight: 'font-medium' },
              { tag: 'Tailwind', size: 'text-xs', weight: 'font-medium' },
              { tag: 'Redux', size: 'text-xs', weight: 'font-normal' },
              { tag: 'GraphQL', size: 'text-xs', weight: 'font-normal' },
              { tag: 'Docker', size: 'text-xs', weight: 'font-normal' },
              { tag: 'AWS', size: 'text-xs', weight: 'font-normal' },
              { tag: 'Git', size: 'text-xs', weight: 'font-normal' },
              { tag: 'REST API', size: 'text-xs', weight: 'font-normal' },
              { tag: 'Sass', size: 'text-[11px]', weight: 'font-normal' },
              { tag: 'Webpack', size: 'text-[11px]', weight: 'font-normal' },
              { tag: 'Figma', size: 'text-[11px]', weight: 'font-normal' },
              { tag: 'MongoDB', size: 'text-[11px]', weight: 'font-normal' },
              { tag: 'PostgreSQL', size: 'text-[11px]', weight: 'font-normal' },
            ].map((item, i) => (
              <span
                key={item.tag}
                className={`px-3 py-1.5 rounded-lg ${item.size} ${item.weight} bg-surface-lighter/50 text-text-secondary border border-border hover:border-primary/30 hover:text-primary-light transition-all duration-200 cursor-default animate-fade-in`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {item.tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
