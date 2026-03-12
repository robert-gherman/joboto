import { Router, Request, Response } from 'express';
import supabase from '../utils/supabase';
import { extractTags } from '../utils/helpers';

const router = Router();

/**
 * Common skill categories for frontend/React/JS roles.
 */
const SKILL_CATEGORIES: Record<string, string[]> = {
  'core-frontend': ['html', 'css', 'javascript', 'typescript'],
  'frameworks': ['react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'gatsby', 'remix'],
  'state-management': ['redux', 'zustand', 'mobx', 'react-query', 'context api', 'recoil'],
  'styling': ['tailwind', 'sass', 'css-in-js', 'styled-components', 'material-ui', 'bootstrap', 'css modules'],
  'testing': ['jest', 'cypress', 'playwright', 'testing-library', 'vitest', 'enzyme'],
  'build-tools': ['webpack', 'vite', 'rollup', 'esbuild', 'parcel', 'turbopack'],
  'backend': ['node.js', 'express', 'nestjs', 'graphql', 'rest', 'prisma', 'sql', 'mongodb'],
  'devops': ['docker', 'kubernetes', 'aws', 'ci/cd', 'git', 'github actions', 'vercel'],
  'design': ['figma', 'storybook', 'design systems', 'responsive design', 'accessibility'],
  'soft-skills': ['agile', 'scrum', 'communication', 'teamwork', 'leadership', 'problem-solving'],
};

/**
 * Extract skills from text using pattern matching.
 */
function extractSkillsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const skills = new Set<string>();

  // Use the tag extractor
  const tags = extractTags(text, '');
  tags.forEach(t => skills.add(t));

  // Additional skill-specific patterns
  const additionalPatterns: Record<string, RegExp> = {
    'responsive design': /responsive\s*design/i,
    'accessibility': /\ba11y\b|accessibility|\bwcag\b|\baria\b/i,
    'design systems': /design\s*system/i,
    'css-in-js': /css[\s-]?in[\s-]?js|styled[\s-]?components|emotion/i,
    'css modules': /css\s*modules/i,
    'context api': /context\s*api/i,
    'github actions': /github\s*actions/i,
    'problem-solving': /problem[\s-]?solving/i,
    'communication': /communication\s*skills?|strong\s*communicat/i,
    'teamwork': /team\s*work|team[\s-]?player|collaborat/i,
    'leadership': /leadership|mentoring|mentor/i,
    'recoil': /\brecoil\b/i,
    'vitest': /\bvitest\b/i,
    'enzyme': /\benzyme\b/i,
    'rollup': /\brollup\b/i,
    'esbuild': /\besbuild\b/i,
    'parcel': /\bparcel\b/i,
    'vercel': /\bvercel\b/i,
    'turbopack': /\bturbopack\b/i,
    'styled-components': /styled[\s-]?components/i,
  };

  for (const [skill, pattern] of Object.entries(additionalPatterns)) {
    if (pattern.test(lower)) {
      skills.add(skill);
    }
  }

  return Array.from(skills);
}

/**
 * Categorize a set of skills into their respective categories.
 */
function categorizeSkills(skills: string[]): Record<string, string[]> {
  const categorized: Record<string, string[]> = {};

  for (const [category, categorySkills] of Object.entries(SKILL_CATEGORIES)) {
    const matched = skills.filter(s =>
      categorySkills.some(cs =>
        s.toLowerCase().includes(cs.toLowerCase()) || cs.toLowerCase().includes(s.toLowerCase())
      )
    );
    if (matched.length > 0) {
      categorized[category] = matched;
    }
  }

  // Any uncategorized skills
  const allCategorized = new Set(Object.values(categorized).flat().map(s => s.toLowerCase()));
  const uncategorized = skills.filter(s => !allCategorized.has(s.toLowerCase()));
  if (uncategorized.length > 0) {
    categorized['other'] = uncategorized;
  }

  return categorized;
}

/**
 * Calculate match score between user skills and job requirements.
 */
function calculateMatchScore(userSkills: string[], jobTags: string[], jobText: string): number {
  if (userSkills.length === 0) return 0;

  const jobLower = jobText.toLowerCase();
  const jobTagsLower = new Set(jobTags.map(t => t.toLowerCase()));

  let matchedCount = 0;
  let weightedScore = 0;

  for (const skill of userSkills) {
    const skillLower = skill.toLowerCase();
    const inTags = jobTagsLower.has(skillLower);
    const inText = jobLower.includes(skillLower);

    if (inTags) {
      matchedCount++;
      weightedScore += 2; // Higher weight for explicit tag matches
    } else if (inText) {
      matchedCount++;
      weightedScore += 1;
    }
  }

  // Normalize: percentage of matched skills, weighted by importance
  const maxPossible = userSkills.length * 2;
  return Math.round((weightedScore / maxPossible) * 100);
}

/**
 * POST /api/ai/analyze-resume
 * Analyze resume text, extract skills, match against current jobs.
 */
router.post('/ai/analyze-resume', async (req: Request, res: Response): Promise<void> => {
  try {
    const { resume_text, limit: requestLimit } = req.body;

    if (!resume_text || typeof resume_text !== 'string') {
      res.status(400).json({ error: 'resume_text is required and must be a string' });
      return;
    }

    const limit = Math.min(50, parseInt(requestLimit, 10) || 15);

    // Extract skills from resume
    const skills = extractSkillsFromText(resume_text);
    const categorizedSkills = categorizeSkills(skills);

    // Fetch active jobs to match against
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('posted_at', { ascending: false })
      .limit(500);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch jobs', details: error.message });
      return;
    }

    // Score each job
    const matches = (jobs || [])
      .map(job => {
        const jobText = `${job.title} ${job.description} ${job.company}`;
        const matchScore = calculateMatchScore(skills, job.tags || [], jobText);
        const matchedSkills = skills.filter(s => {
          const sl = s.toLowerCase();
          return (
            (job.tags || []).some((t: string) => t.toLowerCase() === sl) ||
            jobText.toLowerCase().includes(sl)
          );
        });
        const missingSkills = (job.tags || []).filter(
          (t: string) => !skills.some(s => s.toLowerCase() === t.toLowerCase())
        );

        return {
          job,
          match_score: matchScore,
          matched_skills: matchedSkills,
          missing_skills: missingSkills,
        };
      })
      .filter(m => m.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);

    res.json({
      extracted_skills: skills,
      categorized_skills: categorizedSkills,
      total_skills_found: skills.length,
      job_matches: matches,
      total_matches: matches.length,
      analysis_summary: {
        strongest_areas: Object.entries(categorizedSkills)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 3)
          .map(([category, skills]) => ({ category, skill_count: skills.length })),
        recommendation:
          skills.length < 5
            ? 'Consider adding more specific technical skills to your resume.'
            : skills.length < 10
            ? 'Good skill coverage. Consider highlighting more niche technologies.'
            : 'Excellent skill diversity. Focus on showcasing depth in your top skills.',
      },
    });
  } catch (err) {
    console.error('POST /api/ai/analyze-resume error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/job-tips
 * Given a job ID, generate application tips.
 */
router.post('/ai/job-tips', async (req: Request, res: Response): Promise<void> => {
  try {
    const { job_id, user_skills } = req.body;

    if (!job_id) {
      res.status(400).json({ error: 'job_id is required' });
      return;
    }

    // Fetch the job
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (error || !job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const jobTags: string[] = job.tags || [];
    const jobText = `${job.title} ${job.description}`.toLowerCase();

    // Determine what to highlight
    const userSkillList: string[] = user_skills
      ? extractSkillsFromText(
          Array.isArray(user_skills) ? user_skills.join(' ') : user_skills
        )
      : [];

    const relevantSkills = userSkillList.filter(s =>
      jobTags.some(t => t.toLowerCase().includes(s.toLowerCase())) ||
      jobText.includes(s.toLowerCase())
    );

    const missingSkills = jobTags.filter(
      t => !userSkillList.some(s => s.toLowerCase() === t.toLowerCase())
    );

    // Generate tips based on job analysis
    const tips: string[] = [];

    // Experience level tips
    switch (job.experience_level) {
      case 'intern':
        tips.push('Emphasize your eagerness to learn and any academic projects or personal projects you have built.');
        tips.push('Mention any coursework, bootcamps, or certifications related to web development.');
        break;
      case 'junior':
        tips.push('Highlight personal projects, open-source contributions, or bootcamp projects that demonstrate your skills.');
        tips.push('Show willingness to learn and grow with the team.');
        break;
      case 'mid':
        tips.push('Showcase 2-4 significant projects where you made architectural decisions or led features.');
        tips.push('Demonstrate ability to work independently while being a strong team collaborator.');
        break;
      case 'senior':
        tips.push('Emphasize leadership experience, mentoring, and architectural decision-making.');
        tips.push('Share examples of how you improved team processes, performance, or code quality.');
        break;
      case 'lead':
        tips.push('Focus on team leadership, strategic technical decisions, and cross-team collaboration.');
        tips.push('Highlight experience with roadmap planning, stakeholder management, and scaling teams.');
        break;
    }

    // Tech-specific tips
    if (jobTags.includes('react')) {
      tips.push('Be prepared to discuss React hooks, component patterns, state management, and performance optimization.');
    }
    if (jobTags.includes('typescript')) {
      tips.push('Demonstrate strong TypeScript knowledge: generics, utility types, type guards, and strict mode usage.');
    }
    if (jobTags.includes('next.js')) {
      tips.push('Understand Next.js features: SSR, SSG, ISR, API routes, middleware, and the App Router.');
    }
    if (jobTags.includes('testing-library') || jobTags.includes('jest') || jobTags.includes('cypress')) {
      tips.push('Prepare examples of your testing approach: unit tests, integration tests, and end-to-end tests.');
    }

    // Work type tips
    if (job.type === 'remote') {
      tips.push('Emphasize your remote work experience, self-discipline, and async communication skills.');
    } else if (job.type === 'hybrid') {
      tips.push('Show flexibility and willingness to work both in-office and remotely.');
    }

    // Interview prep
    const interviewPrep: string[] = [
      'Review the company website and recent news to show genuine interest.',
      `Research ${job.company} on LinkedIn and Glassdoor for culture insights.`,
    ];

    if (jobText.includes('react')) {
      interviewPrep.push('Practice React coding challenges: build a small app with hooks, context, and API integration.');
      interviewPrep.push('Review common React interview questions: virtual DOM, reconciliation, fiber architecture.');
    }
    if (jobText.includes('javascript') || jobText.includes('typescript')) {
      interviewPrep.push('Brush up on JavaScript fundamentals: closures, prototypes, event loop, promises, async/await.');
    }
    if (jobText.includes('css') || jobText.includes('tailwind')) {
      interviewPrep.push('Be ready for CSS challenges: flexbox, grid, responsive design, animations.');
    }
    interviewPrep.push('Prepare 2-3 STAR-method stories about your past projects and challenges.');
    interviewPrep.push('Have thoughtful questions ready about the team, tech stack, and growth opportunities.');

    res.json({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        type: job.type,
        experience_level: job.experience_level,
      },
      skills_to_highlight: relevantSkills,
      skills_to_learn: missingSkills,
      application_tips: tips,
      interview_prep: interviewPrep,
      key_technologies: jobTags,
    });
  } catch (err) {
    console.error('POST /api/ai/job-tips error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/cover-letter
 * Generate a cover letter template for a specific job.
 */
router.post('/ai/cover-letter', async (req: Request, res: Response): Promise<void> => {
  try {
    const { job_id, user_name, user_skills, user_experience, user_highlights } = req.body;

    if (!job_id) {
      res.status(400).json({ error: 'job_id is required' });
      return;
    }

    // Fetch the job
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (error || !job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const name = user_name || '[Your Name]';
    const jobTags: string[] = job.tags || [];

    // Parse user skills
    const userSkillList: string[] = user_skills
      ? extractSkillsFromText(
          Array.isArray(user_skills) ? user_skills.join(' ') : user_skills
        )
      : [];

    const matchedSkills = userSkillList.filter(s =>
      jobTags.some(t => t.toLowerCase().includes(s.toLowerCase()))
    );

    const experience = user_experience || '[X years of experience in frontend development]';
    const highlights = user_highlights || [];

    // Build the cover letter
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const skillsPhrase =
      matchedSkills.length > 0
        ? matchedSkills.slice(0, 5).join(', ')
        : jobTags.slice(0, 5).join(', ');

    const highlightBullets =
      Array.isArray(highlights) && highlights.length > 0
        ? highlights
            .map((h: string) => `  - ${h}`)
            .join('\n')
        : `  - [Describe a relevant project or achievement]\n  - [Mention a specific result or impact]\n  - [Highlight a relevant technical challenge you solved]`;

    let workTypePhrase = '';
    if (job.type === 'remote') {
      workTypePhrase = 'I am experienced in remote work environments and excel at asynchronous communication and self-management. ';
    } else if (job.type === 'hybrid') {
      workTypePhrase = 'I am comfortable with hybrid work arrangements and value both in-office collaboration and focused remote work. ';
    }

    const coverLetter = `${today}

Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the ${job.title} position at ${job.company}. With ${experience}, I am confident that my skills and passion for building exceptional user experiences make me an excellent fit for this role.

Throughout my career, I have developed deep expertise in ${skillsPhrase}, which aligns directly with the requirements for this position. ${workTypePhrase}Here are some highlights of my relevant experience:

${highlightBullets}

I am particularly drawn to ${job.company} because of the opportunity to work on challenging frontend projects that make a real impact. I thrive in environments where I can combine technical excellence with creative problem-solving.

${matchedSkills.length > 3
  ? `My proficiency in ${matchedSkills.slice(0, 3).join(', ')}, and ${matchedSkills.slice(3).join(', ')} positions me well to contribute to your team from day one.`
  : `I am eager to bring my skills in ${skillsPhrase} to your team and contribute to its success from day one.`
}

I would welcome the opportunity to discuss how my background and skills can contribute to ${job.company}'s goals. Thank you for considering my application.

Best regards,
${name}`;

    res.json({
      cover_letter: coverLetter,
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
      },
      matched_skills: matchedSkills,
      tips: [
        'Customize the bracketed sections with your specific details.',
        'Research the company to add a specific reason for your interest.',
        'Quantify your achievements where possible (e.g., "improved load time by 40%").',
        'Keep the final version to one page.',
        'Proofread carefully before sending.',
      ],
    });
  } catch (err) {
    console.error('POST /api/ai/cover-letter error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
