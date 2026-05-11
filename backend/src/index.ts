import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';

import jobsRouter from './routes/jobs';
import aiRouter from './routes/ai';
import { runAllScrapers } from './scrapers';
import { shutdownPool } from './utils/db';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const SCRAPE_INTERVAL = parseInt(process.env.SCRAPE_INTERVAL_MINUTES || '30', 10);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api', jobsRouter);
app.use('/api', aiRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// Scraper pause/resume control
let scraperPaused = false;

app.get('/api/scraper/status', (_req, res) => {
  res.json({ paused: scraperPaused });
});

app.post('/api/scraper/pause', (_req, res) => {
  scraperPaused = true;
  scheduledTask.stop();
  console.log('Scraper paused by user.');
  res.json({ paused: true, message: 'Scraper paused' });
});

app.post('/api/scraper/resume', (_req, res) => {
  scraperPaused = false;
  scheduledTask.start();
  console.log('Scraper resumed by user.');
  res.json({ paused: false, message: 'Scraper resumed' });
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Cron job for periodic scraping
// ---------------------------------------------------------------------------
const cronExpression = `*/${SCRAPE_INTERVAL} * * * *`;
let isScraping = false;

const scheduledTask = cron.schedule(cronExpression, async () => {
  if (isScraping) {
    console.log('Scrape already in progress, skipping scheduled run.');
    return;
  }

  isScraping = true;
  try {
    await runAllScrapers();
  } catch (err) {
    console.error('Scheduled scrape failed:', err);
  } finally {
    isScraping = false;
  }
}, {
  timezone: 'Europe/Bucharest',
});

console.log(`Cron job scheduled: every ${SCRAPE_INTERVAL} minutes (${cronExpression})`);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`\n=======================================`);
  console.log(`  Joboto Backend Server`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Scrape interval: ${SCRAPE_INTERVAL} minutes`);
  console.log(`=======================================\n`);

  // Run initial scrape after a brief delay to let the server start
  setTimeout(async () => {
    if (isScraping) return;
    isScraping = true;
    console.log('Running initial scrape...');
    try {
      await runAllScrapers();
    } catch (err) {
      console.error('Initial scrape failed:', err);
    } finally {
      isScraping = false;
    }
  }, 3000);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  scheduledTask.stop();
  console.log('Cron job stopped.');

  server.close(async () => {
    console.log('HTTP server closed.');
    await shutdownPool();
    console.log('Database pool closed.');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
