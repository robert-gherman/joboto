import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Command } from 'lucide-react';
import { useJobStore } from '../store/jobStore';

const popularSearches = [
  'React Developer',
  'Frontend Engineer',
  'Full Stack Developer',
  'TypeScript',
  'Next.js',
  'Vue.js Developer',
  'Angular Developer',
  'Node.js',
  'UI/UX Developer',
  'JavaScript',
];

export default function SearchBar() {
  const { filters, setFilter } = useJobStore();
  const [localValue, setLocalValue] = useState(filters.search);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur();
        setShowSuggestions(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = useCallback(
    (value: string) => {
      setFilter('search', value);
      setShowSuggestions(false);
    },
    [setFilter]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setShowSuggestions(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(localValue);
    }
  };

  const handleClear = () => {
    setLocalValue('');
    setFilter('search', '');
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setLocalValue(suggestion);
    handleSubmit(suggestion);
    inputRef.current?.blur();
  };

  const filteredSuggestions = popularSearches.filter((s) =>
    s.toLowerCase().includes(localValue.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <div
        className={`relative flex items-center rounded-xl border transition-all duration-300 ${
          isFocused
            ? 'border-primary bg-surface-light shadow-lg shadow-primary/10'
            : 'border-border bg-surface-light/50 hover:border-surface-lighter'
        }`}
      >
        <Search
          className={`absolute left-4 w-5 h-5 transition-colors duration-200 ${
            isFocused ? 'text-primary-light' : 'text-text-muted'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder="Search React, Frontend, Full Stack jobs in Romania..."
          className="w-full py-3.5 pl-12 pr-24 bg-transparent text-text-primary placeholder-text-muted text-sm focus:outline-none"
          aria-label="Search jobs"
        />

        <div className="absolute right-3 flex items-center gap-2">
          {localValue && (
            <button
              onClick={handleClear}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-all duration-200"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-surface-lighter/50 text-text-muted text-xs">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 py-2 rounded-xl bg-surface-light border border-border shadow-xl shadow-black/20 z-50 animate-fade-in">
          <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
            Popular Searches
          </div>
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onMouseDown={() => handleSuggestionClick(suggestion)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-lighter/50 transition-colors duration-150"
            >
              <Search className="w-3.5 h-3.5 text-text-muted" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
