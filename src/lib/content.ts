import { getCollection, type CollectionEntry } from 'astro:content';

export const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(d);

export const fmtRange = (start: Date, end?: Date) => {
  if (!end || +end === +start) return fmtDate(start);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  return sameMonth
    ? `${start.getUTCDate()}–${fmtDate(end)}`
    : `${fmtDate(start, { day: 'numeric', month: 'long' })} – ${fmtDate(end)}`;
};

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export async function getNews() {
  const all = await getCollection('news', ({ data }) => !data.draft);
  return all.sort((a, b) => +b.data.date - +a.data.date);
}

// "Upcoming" is decided at build time: rebuild the site regularly (see README) so past events move down.
export async function getEvents() {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const all = await getCollection('events');
  const isPast = (e: CollectionEntry<'events'>) => +(e.data.end ?? e.data.start) < +now;
  return {
    upcoming: all.filter((e) => !isPast(e)).sort((a, b) => +a.data.start - +b.data.start),
    past: all.filter(isPast).sort((a, b) => +b.data.start - +a.data.start),
  };
}

export async function getAllTags() {
  const [news, events] = await Promise.all([getNews(), getCollection('events')]);
  const map = new Map<string, string>();
  for (const e of [...news, ...events]) for (const t of e.data.tags) map.set(slugify(t), t);
  return map;
}
