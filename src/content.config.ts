import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

// The CMS config in public/admin/config.yml mirrors these schemas field by field.
// If you change a field here, change it there too, or the CMS will save files that fail the build.

// News posts: one Markdown file per post in src/content/news/
const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      summary: z.string(),
      // Featured image: stored in src/assets/news/ so Astro optimises it at build time
      image: image(),
      imageAlt: z.string().min(1, 'Describe the image for people who cannot see it'),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    }),
});

// Events: start/end dates decide whether an event is listed as upcoming or past
const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    format: z.enum(['In person', 'Online', 'Hybrid']),
    location: z.string(),
    organiser: z.string().optional(),
    summary: z.string(),
    url: z.url().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

// Patient stories: fictional sample content only, never real patient data
const stories = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/stories' }),
  schema: z.object({
    title: z.string(),
    person: z.string(),
    condition: z.string(),
    country: z.string(),
    quote: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    // Must stay true: the site labels every story as fictional
    fictional: z.literal(true),
  }),
});

// Static institutional pages under /about/
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    eyebrow: z.string().default('About FEDERG'),
    intro: z.string(),
    order: z.number().default(99),
  }),
});

// Member associations: one YAML file per association. Public organisation data only.
const members = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/members' }),
  schema: z.object({
    name: z.string(),
    country: z.string(),
    focus: z.string(),
    url: z.url(),
  }),
});

const board = defineCollection({
  loader: file('./src/content/board.yaml'),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    bio: z.string(),
  }),
});

const newsletters = defineCollection({
  loader: file('./src/content/newsletters.yaml'),
  schema: z.object({
    type: z.enum(['representations', 'members-activities']),
    title: z.string(),
    issue: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    pdf: z.url(),
  }),
});

const links = defineCollection({
  loader: file('./src/content/links.yaml'),
  schema: z.object({
    name: z.string(),
    category: z.string(),
    description: z.string(),
    url: z.url(),
  }),
});

export const collections = { news, events, stories, pages, members, board, newsletters, links };
