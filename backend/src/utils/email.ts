import nodemailer from 'nodemailer';
import { Job } from '../types';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASS,
  },
});

function buildJobRow(job: Job): string {
  const posted = job.posted_at
    ? new Date(job.posted_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Just now';

  const typeBadge =
    job.type === 'remote'
      ? '#10b981'
      : job.type === 'hybrid'
        ? '#f59e0b'
        : '#06b6d4';

  const levelBadge =
    job.experience_level === 'junior' || job.experience_level === 'intern'
      ? '#22c55e'
      : job.experience_level === 'mid'
        ? '#eab308'
        : '#f97316';

  return `
    <tr style="border-bottom: 1px solid #1e293b;">
      <td style="padding: 16px;">
        <div style="margin-bottom: 4px;">
          <a href="${job.url}" style="color: #818cf8; font-weight: 600; font-size: 15px; text-decoration: none;">
            ${job.title}
          </a>
        </div>
        <div style="color: #94a3b8; font-size: 13px; margin-bottom: 8px;">
          ${job.company} &middot; ${job.location} &middot; ${posted}
        </div>
        <div>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; color: white; background: ${typeBadge}; margin-right: 6px;">
            ${job.type}
          </span>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; color: white; background: ${levelBadge}; margin-right: 6px;">
            ${job.experience_level}
          </span>
          ${job.tags
            .slice(0, 4)
            .map(
              (t) =>
                `<span style="display: inline-block; padding: 2px 6px; border-radius: 8px; font-size: 10px; color: #94a3b8; background: #1e293b; margin-right: 4px;">${t}</span>`
            )
            .join('')}
        </div>
      </td>
      <td style="padding: 16px; text-align: right; vertical-align: middle;">
        <a href="${job.url}" target="_blank" rel="noopener noreferrer"
           style="display: inline-block; padding: 8px 16px; background: #6366f1; color: white; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none;">
          Apply
        </a>
      </td>
    </tr>`;
}

function buildEmailHtml(jobs: Job[]): string {
  const jobRows = jobs.map(buildJobRow).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <!-- Header -->
    <div style="text-align: center; padding: 24px 0; border-bottom: 1px solid #1e293b;">
      <div style="display: inline-block; width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #06b6d4); line-height: 36px; text-align: center; color: white; font-weight: bold; font-size: 18px; vertical-align: middle;">
        J
      </div>
      <span style="font-size: 22px; font-weight: 700; background: linear-gradient(90deg, #818cf8, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; vertical-align: middle; margin-left: 8px;">
        Joboto
      </span>
      <div style="margin-top: 8px;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; font-size: 12px; font-weight: 600;">
          &#x1F534; ${jobs.length} New Job${jobs.length > 1 ? 's' : ''} Posted
        </span>
      </div>
    </div>

    <!-- Jobs -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
      <tbody>
        ${jobRows}
      </tbody>
    </table>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0; color: #64748b; font-size: 12px; border-top: 1px solid #1e293b; margin-top: 16px;">
      <p>Be first to apply — these jobs were just posted!</p>
      <p style="margin-top: 8px; color: #475569;">
        You're receiving this because email alerts are enabled on Joboto.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendNewJobsEmail(jobs: Job[]): Promise<boolean> {
  if (!process.env.EMAIL_ENABLED || process.env.EMAIL_ENABLED !== 'true') {
    return false;
  }

  if (!process.env.EMAIL_SMTP_USER || !process.env.EMAIL_SMTP_PASS || process.env.EMAIL_SMTP_PASS === 'your-gmail-app-password-here') {
    console.warn('Email: SMTP credentials not configured, skipping email');
    return false;
  }

  if (jobs.length === 0) return false;

  const to = process.env.EMAIL_TO || process.env.EMAIL_SMTP_USER;
  const from = process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER;

  const subject =
    jobs.length === 1
      ? `New job: ${jobs[0].title} at ${jobs[0].company}`
      : `${jobs.length} new frontend jobs just posted!`;

  try {
    await transporter.sendMail({
      from: `"Joboto Alerts" <${from}>`,
      to,
      subject,
      html: buildEmailHtml(jobs),
    });
    console.log(`Email: Sent alert for ${jobs.length} new jobs to ${to}`);
    return true;
  } catch (err) {
    console.error('Email: Failed to send alert:', err);
    return false;
  }
}
