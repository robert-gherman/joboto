import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Briefcase, BarChart3, Sparkles, Menu, X, Heart } from 'lucide-react';
import { useJobStore } from '../store/jobStore';
import SavedJobs from './SavedJobs';

const navLinks = [
  { to: '/', label: 'Jobs', icon: Briefcase },
  { to: '/ai-tools', label: 'AI Tools', icon: Sparkles },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
];

export default function Navbar() {
  const location = useLocation();
  const totalJobs = useJobStore((s) => s.totalJobs);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [savedJobsOpen, setSavedJobsOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    const updateSavedCount = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('savedJobs') || '[]');
        setSavedCount(saved.length);
      } catch {
        setSavedCount(0);
      }
    };
    updateSavedCount();
    window.addEventListener('storage', updateSavedCount);
    window.addEventListener('savedJobsUpdated', updateSavedCount);
    return () => {
      window.removeEventListener('storage', updateSavedCount);
      window.removeEventListener('savedJobsUpdated', updateSavedCount);
    };
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group" aria-label="Joboto Home">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-light to-accent-light bg-clip-text text-transparent">
                Joboto
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive =
                  link.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(link.to);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'text-primary-light bg-primary/10'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-light'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-primary to-accent rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right section */}
            <div className="flex items-center gap-3">
              {/* Job count badge */}
              {totalJobs > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-medium text-primary-light">
                    {totalJobs.toLocaleString()} jobs
                  </span>
                </div>
              )}

              {/* Saved jobs button */}
              <button
                onClick={() => setSavedJobsOpen(true)}
                className="relative p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-light transition-all duration-200"
                aria-label="Saved jobs"
              >
                <Heart className="w-5 h-5" />
                {savedCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-danger text-[10px] font-bold flex items-center justify-center text-white">
                    {savedCount}
                  </span>
                )}
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-light transition-all duration-200"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border animate-fade-in">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const isActive =
                  link.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(link.to);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'text-primary-light bg-primary/10'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-light'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Saved Jobs Panel */}
      <SavedJobs isOpen={savedJobsOpen} onClose={() => setSavedJobsOpen(false)} />
    </>
  );
}
