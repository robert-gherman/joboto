import { useEffect, useState } from "react";
import {
  Briefcase,
  Zap,
  Globe,
  Database,
  SlidersHorizontal,
} from "lucide-react";
import { useJobStore } from "../store/jobStore";
import { useDebounce } from "../hooks/useDebounce";
import SearchBar from "../components/SearchBar";
import FilterSidebar from "../components/FilterSidebar";
import JobList from "../components/JobList";
import LiveJobFeed from "../components/LiveJobFeed";

export default function HomePage() {
  const { filters, stats, fetchJobs, fetchStats, fetchSources } = useJobStore();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const debouncedSearch = useDebounce(filters.search, 400);

  // Initial load
  useEffect(() => {
    fetchJobs();
    fetchStats();
    fetchSources();
  }, [fetchJobs, fetchStats, fetchSources]);

  // Re-fetch on search changes (debounced)
  useEffect(() => {
    fetchJobs();
  }, [debouncedSearch, fetchJobs]);

  const quickStats = [
    {
      icon: <Briefcase className="w-5 h-5" />,
      value: stats?.total || 0,
      label: "Total Jobs",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      value: stats?.new_today || 0,
      label: "New Today",
    },
    {
      icon: <Globe className="w-5 h-5" />,
      value: stats?.by_type?.remote || 0,
      label: "Remote Jobs",
    },
    {
      icon: <Database className="w-5 h-5" />,
      value: stats ? Object.keys(stats.by_source).length : 0,
      label: "Sources",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-surface to-surface pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text-primary leading-tight animate-fade-in">
              Find{" "}
              <span className="bg-gradient-to-r from-primary-light to-accent-light bg-clip-text text-transparent">
                Frontend Jobs
              </span>{" "}
              in Romania
            </h1>
            <p className="mt-4 text-base sm:text-lg text-text-secondary animate-fade-in max-w-2xl mx-auto">
              Job aggregator scanning 12+ sources. Updated every 30 minutes.
            </p>

            {/* Search */}
            <div className="mt-8 animate-slide-up">
              <SearchBar />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 animate-slide-up">
              {quickStats.map((stat, i) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-card/80 border border-border"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="text-primary-light">{stat.icon}</div>
                  <div className="text-left">
                    <p className="text-lg font-bold text-text-primary">
                      {stat.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-text-muted">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live Job Feed */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <LiveJobFeed />
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile filter toggle */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-card border border-border text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {(filters.type ||
              filters.experience_level ||
              filters.source ||
              filters.tags.length > 0 ||
              filters.location_romania) && (
              <span className="w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
        </div>

        <div className="flex gap-6">
          <FilterSidebar
            mobileOpen={mobileFiltersOpen}
            onMobileClose={() => setMobileFiltersOpen(false)}
          />
          <JobList />
        </div>
      </section>
    </div>
  );
}
