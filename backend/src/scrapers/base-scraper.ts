import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { ScraperResult } from '../types';
import { delay } from '../utils/helpers';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
];

// Global circuit breaker: tracks blocked domains to avoid hammering them
const blockedDomains = new Map<string, number>(); // domain -> unblock timestamp
const BLOCK_DURATION = 60 * 60 * 1000; // 1 hour cooldown after 403/429

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function isDomainBlocked(url: string): boolean {
  const domain = getDomain(url);
  const unblockAt = blockedDomains.get(domain);
  if (!unblockAt) return false;
  if (Date.now() >= unblockAt) {
    blockedDomains.delete(domain);
    return false;
  }
  return true;
}

function blockDomain(url: string): void {
  const domain = getDomain(url);
  blockedDomains.set(domain, Date.now() + BLOCK_DURATION);
  console.warn(`[CircuitBreaker] Blocked ${domain} for 1 hour due to rate limiting`);
}

export abstract class BaseScraper {
  abstract name: string;
  abstract baseUrl: string;

  /** Maximum number of retries for a failed request */
  protected maxRetries: number = 2;

  /** Delay between retries in milliseconds */
  protected retryDelay: number = 3000;

  /** Request timeout in milliseconds */
  protected timeout: number = 15000;

  /** Delay between consecutive page fetches to be respectful */
  protected crawlDelay: number = 2000;

  abstract scrape(): Promise<ScraperResult>;

  /**
   * Fetch a page with user-agent rotation, timeout, retry logic,
   * and circuit breaker for rate-limited domains.
   */
  protected async fetchPage(url: string, config?: AxiosRequestConfig): Promise<string> {
    // Circuit breaker: skip if domain is blocked
    if (isDomainBlocked(url)) {
      throw new Error(`Domain ${getDomain(url)} is temporarily blocked (rate limited)`);
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

        const response = await axios.get(url, {
          timeout: this.timeout,
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,ro;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...(config?.headers || {}),
          },
          maxRedirects: 5,
          validateStatus: (status) => status < 400,
          ...config,
        });

        return typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        // Check for rate limiting (429) or forbidden (403) — trip the circuit breaker
        const axiosErr = error as AxiosError;
        const status = axiosErr?.response?.status;
        if (status === 429 || status === 403) {
          blockDomain(url);
          throw new Error(`${getDomain(url)} returned ${status} — domain blocked for 1 hour`);
        }

        console.warn(
          `[${this.name}] Fetch attempt ${attempt}/${this.maxRetries} failed for ${url}: ${err.message}`
        );

        if (attempt < this.maxRetries) {
          const backoff = this.retryDelay * Math.pow(2, attempt - 1);
          await delay(backoff);
        }
      }
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${this.maxRetries} attempts`);
  }

  /**
   * Fetch JSON data from a URL.
   */
  protected async fetchJson<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const raw = await this.fetchPage(url, {
      ...config,
      headers: {
        'Accept': 'application/json',
        ...(config?.headers || {}),
      },
    });

    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  /**
   * Build a successful ScraperResult.
   */
  protected success(jobs: ScraperResult['jobs']): ScraperResult {
    return {
      jobs,
      source: this.name,
      success: true,
    };
  }

  /**
   * Build a failed ScraperResult.
   */
  protected failure(error: string): ScraperResult {
    return {
      jobs: [],
      source: this.name,
      success: false,
      error,
    };
  }

  /**
   * Log info message with scraper context.
   */
  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }

  /**
   * Log error message with scraper context.
   */
  protected logError(message: string, error?: unknown): void {
    const errMsg = error instanceof Error ? error.message : String(error || '');
    console.error(`[${this.name}] ${message}${errMsg ? ': ' + errMsg : ''}`);
  }
}
