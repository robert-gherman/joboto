import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio,
  Bell,
  BellOff,
  ExternalLink,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  Volume2,
  VolumeX,
  Mail,
  MailX,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Job } from '../types';
import { fetchRecentJobs, sendEmailAlert, getNotificationStatus } from '../utils/api';

const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

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

export default function LiveJobFeed() {
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [newJobIds, setNewJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [emailTo, setEmailTo] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const seenJobIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  // Check if email is configured on the backend
  useEffect(() => {
    getNotificationStatus()
      .then((status) => {
        setEmailConfigured(status.email_enabled);
        setEmailTo(status.email_to);
      })
      .catch(() => setEmailConfigured(false));
  }, []);

  // Create a simple notification sound using AudioContext
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch {
      // AudioContext not available
    }
  }, [soundEnabled]);

  // Request notification permission
  const enableNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
  };

  const toggleNotifications = () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
    } else {
      enableNotifications();
    }
  };

  const toggleEmail = () => {
    if (!emailConfigured) return;
    const next = !emailEnabled;
    setEmailEnabled(next);
    localStorage.setItem('joboto-email', String(next));
  };

  // Send email alert for new jobs
  const sendEmailForJobs = useCallback(
    async (jobs: Job[]) => {
      if (!emailEnabled || !emailConfigured || jobs.length === 0) return;
      setEmailSending(true);
      try {
        await sendEmailAlert(jobs.map((j) => j.id));
      } catch (err) {
        console.error('Failed to send email alert:', err);
      } finally {
        setEmailSending(false);
      }
    },
    [emailEnabled, emailConfigured]
  );

  // Send browser notification
  const sendNotification = useCallback(
    (jobs: Job[]) => {
      if (!notificationsEnabled || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      const title =
        jobs.length === 1
          ? `New job: ${jobs[0].title}`
          : `${jobs.length} new jobs posted!`;

      const body =
        jobs.length === 1
          ? `${jobs[0].company} - ${jobs[0].location}`
          : jobs
              .slice(0, 3)
              .map((j) => `${j.title} at ${j.company}`)
              .join('\n');

      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'joboto-new-jobs',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    },
    [notificationsEnabled]
  );

  // Fetch recent jobs
  // First call: jobs added to DB in the last 15 minutes
  // Subsequent calls: jobs added since last check
  const checkForNewJobs = useCallback(async () => {
    try {
      const result = await fetchRecentJobs(
        isFirstLoad.current
          ? { minutes: 240 }
          : { since: lastCheck || undefined }
      );

      if (isFirstLoad.current) {
        // First load — show all recent jobs, mark them all as "seen"
        setRecentJobs(result.jobs);
        result.jobs.forEach((j) => seenJobIds.current.add(j.id));
        isFirstLoad.current = false;
      } else {
        // Subsequent polls — detect truly new jobs
        const brandNewJobs = result.jobs.filter(
          (j) => !seenJobIds.current.has(j.id)
        );

        if (brandNewJobs.length > 0) {
          setNewCount((prev) => prev + brandNewJobs.length);
          setNewJobIds((prev) => {
            const next = new Set(prev);
            brandNewJobs.forEach((j) => next.add(j.id));
            return next;
          });
          brandNewJobs.forEach((j) => seenJobIds.current.add(j.id));

          // Merge new jobs to the top of the list
          setRecentJobs((prev) => {
            const merged = [...brandNewJobs, ...prev];
            // Keep only unique, max 50
            const seen = new Set<string>();
            return merged
              .filter((j) => {
                if (seen.has(j.id)) return false;
                seen.add(j.id);
                return true;
              })
              .slice(0, 50);
          });

          // Browser notification + sound
          sendNotification(brandNewJobs);
          playNotificationSound();

          // Email alert
          sendEmailForJobs(brandNewJobs);

          // Dispatch event for Navbar badge
          window.dispatchEvent(
            new CustomEvent('joboto-new-jobs', {
              detail: { count: brandNewJobs.length },
            })
          );

          // Auto-expand when new jobs arrive
          setExpanded(true);
        }
      }

      setLastCheck(result.checked_at);
    } catch (err) {
      console.error('Live feed poll failed:', err);
    } finally {
      setLoading(false);
    }
  }, [lastCheck, sendNotification, playNotificationSound, sendEmailForJobs]);

  // Initial fetch + polling
  useEffect(() => {
    checkForNewJobs();
    const interval = setInterval(checkForNewJobs, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkForNewJobs]);

  // Clear "new" highlight after 30 seconds
  useEffect(() => {
    if (newJobIds.size === 0) return;
    const timeout = setTimeout(() => {
      setNewJobIds(new Set());
      setNewCount(0);
    }, 30000);
    return () => clearTimeout(timeout);
  }, [newJobIds]);

  // Load preferences from localStorage
  useEffect(() => {
    const pref = localStorage.getItem('joboto-notifications');
    if (pref === 'true' && 'Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
    const soundPref = localStorage.getItem('joboto-sound');
    if (soundPref === 'false') setSoundEnabled(false);
    const emailPref = localStorage.getItem('joboto-email');
    if (emailPref === 'true') setEmailEnabled(true);
  }, []);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('joboto-notifications', String(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('joboto-sound', String(soundEnabled));
  }, [soundEnabled]);

  if (loading && recentJobs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <div className="h-4 w-48 rounded animate-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden animate-fade-in">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-light/30 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio className="w-5 h-5 text-danger" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-danger animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-danger" />
          </div>
          <span className="text-sm font-semibold text-text-primary">Live Feed</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-danger/10 text-danger border border-danger/20">
            {recentJobs.length} recent
          </span>
          {newCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/10 text-success border border-success/20 animate-scale-in">
              +{newCount} new!
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Email toggle */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              toggleEmail();
            }}
            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
              !emailConfigured
                ? 'text-text-muted/40 cursor-not-allowed'
                : emailEnabled
                  ? 'text-success bg-success/10'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-lighter/30'
            }`}
            title={
              !emailConfigured
                ? 'Email not configured — set Gmail App Password in .env'
                : emailEnabled
                  ? `Email alerts on (${emailTo})`
                  : 'Enable email alerts'
            }
          >
            {emailSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : emailEnabled ? (
              <Mail className="w-4 h-4" />
            ) : (
              <MailX className="w-4 h-4" />
            )}
          </div>
          {/* Notification toggle */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              toggleNotifications();
            }}
            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
              notificationsEnabled
                ? 'text-primary-light bg-primary/10'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-lighter/30'
            }`}
            title={notificationsEnabled ? 'Notifications on' : 'Enable notifications'}
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
          </div>
          {/* Sound toggle */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              setSoundEnabled(!soundEnabled);
            }}
            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
              soundEnabled
                ? 'text-primary-light bg-primary/10'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-lighter/30'
            }`}
            title={soundEnabled ? 'Sound on' : 'Sound off'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </button>

      {/* Email status banner */}
      {expanded && emailEnabled && emailConfigured && (
        <div className="px-4 py-2 bg-success/5 border-t border-success/10 flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-success" />
          <span className="text-[11px] text-success">
            Email alerts active — new jobs will be sent to{' '}
            <span className="font-medium">{emailTo}</span>
          </span>
        </div>
      )}

      {/* Job list */}
      {expanded && (
        <div className="border-t border-border">
          {recentJobs.length === 0 ? (
            <div className="p-6 text-center">
              <Zap className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-secondary">No new jobs in the last few hours</p>
              <p className="text-xs text-text-muted mt-1">
                Checking every 2 minutes — you'll be notified when new listings appear
              </p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto divide-y divide-border/50">
              {recentJobs.map((job) => {
                const isNew = newJobIds.has(job.id);
                const postedAgo = job.posted_at
                  ? formatDistanceToNow(new Date(job.posted_at), { addSuffix: true })
                  : 'Just now';

                return (
                  <div
                    key={job.id}
                    className={`group flex items-start gap-3 px-4 py-3 transition-all duration-500 hover:bg-surface-light/30 ${
                      isNew ? 'bg-success/5 live-feed-highlight' : ''
                    }`}
                  >
                    {/* New indicator */}
                    <div className="flex-shrink-0 pt-1">
                      {isNew ? (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full h-2.5 w-2.5 bg-text-muted/30" />
                      )}
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/job/${job.id}`}
                          className="text-sm font-medium text-text-primary hover:text-primary-light transition-colors duration-200 line-clamp-1"
                        >
                          {job.title}
                        </Link>
                        {isNew && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/30 uppercase tracking-wide">
                            new
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-text-secondary">{job.company}</span>
                        <span className="text-text-muted">-</span>
                        <span className="flex items-center gap-0.5 text-xs text-text-muted">
                          <MapPin className="w-3 h-3" />
                          {job.location}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            typeStyles[job.type] || ''
                          }`}
                        >
                          {job.type}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            experienceStyles[job.experience_level] || ''
                          }`}
                        >
                          {job.experience_level}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-text-muted ml-auto">
                          <Clock className="w-3 h-3" />
                          {postedAgo}
                        </span>
                      </div>
                    </div>

                    {/* Quick apply */}
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white"
                      title="Apply now"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 bg-surface-light/20 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-text-muted">
              Auto-refreshing every 2 min
              {lastCheck && (
                <>
                  {' '}
                  - Last check:{' '}
                  {formatDistanceToNow(new Date(lastCheck), { addSuffix: true })}
                </>
              )}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                checkForNewJobs();
              }}
              className="text-[11px] text-primary-light hover:text-primary font-medium transition-colors duration-200"
            >
              Check now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
