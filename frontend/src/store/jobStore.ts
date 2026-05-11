import { create } from 'zustand';
import type { Job, JobFilters, JobStats } from '../types';
import { fetchJobs, fetchJobStats, fetchSources as fetchSourcesApi } from '../utils/api';

interface JobStore {
  jobs: Job[];
  filters: JobFilters;
  stats: JobStats | null;
  sources: string[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  totalJobs: number;
  selectedJob: Job | null;

  fetchJobs: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchSources: () => Promise<void>;
  setFilter: <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  setSelectedJob: (job: Job | null) => void;
}

const defaultFilters: JobFilters = {
  search: '',
  type: '',
  experience_level: '',
  source: '',
  posted_after: '',
  tags: [],
  sort_by: 'posted_at',
  hide_duplicates: false,
  location_romania: false,
};

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  filters: { ...defaultFilters },
  stats: null,
  sources: [],
  loading: false,
  currentPage: 1,
  totalPages: 1,
  totalJobs: 0,
  selectedJob: null,

  fetchJobs: async () => {
    set({ loading: true });
    try {
      const { filters, currentPage } = get();
      const response = await fetchJobs({
        ...filters,
        page: currentPage,
        limit: 20,
      });
      set({
        jobs: response.data || [],
        totalPages: response.total_pages || 1,
        totalJobs: response.total || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      set({ loading: false, jobs: [] });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await fetchJobStats();
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  },

  fetchSources: async () => {
    try {
      const sources = await fetchSourcesApi();
      set({ sources });
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      currentPage: 1,
    }));
  },

  resetFilters: () => {
    set({ filters: { ...defaultFilters }, currentPage: 1 });
  },

  setPage: (page) => {
    set({ currentPage: page });
  },

  setSelectedJob: (job) => {
    set({ selectedJob: job });
  },
}));
