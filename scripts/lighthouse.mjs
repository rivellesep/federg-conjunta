/**
 * Runs Lighthouse (mobile + desktop) against a running site and prints the scores.
 *
 *   npm run build && npm run preview          (in one terminal)
 *   npm run lighthouse                        (in another)
 *   npm run lighthouse -- https://federg.org/ (any URL, e.g. the current site)
 *
 * Uses Chrome, or any Chromium browser set in CHROME_PATH (e.g. Edge on Windows).
 * Full HTML reports are saved in lighthouse-reports/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const BASE = process.env.LH_BASE ?? 'http://localhost:4322';
const DEFAULT_PAGES = [
  '/',
  '/about/',
  '/news/',
  '/news/strategic-plan-2026-2029/',
  '/events/2027-03-11-world-kidney-day-workshop/',
  '/patient-stories/marta-planning-around-dialysis/',
  '/contact/',
  '/search/',
];
const targets = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PAGES).map((p) =>
  p.startsWith('http') ? p : BASE + p
);
const OUT = 'lighthouse-reports';
const CATS = ['performance', 'accessibility', 'best-practices', 'seo'];

await mkdir(OUT, { recursive: true });
const chrome = await launch({ chromeFlags: ['--headless=new'] });
const rows = [];
const problems = [];

try {
  for (const formFactor of ['mobile', 'desktop']) {
    for (const url of targets) {
      const result = await lighthouse(
        url,
        { port: chrome.port, output: 'html', logLevel: 'error' },
        formFactor === 'desktop' ? desktopConfig : undefined
      );
      const { lhr, report } = result;
      const row = { form: formFactor, page: url.replace(BASE, '') || '/' };
      for (const c of CATS) row[c] = Math.round((lhr.categories[c]?.score ?? 0) * 100);
      row.LCP = lhr.audits['largest-contentful-paint'].displayValue;
      row.CLS = lhr.audits['cumulative-layout-shift'].displayValue;
      rows.push(row);

      // Collect every audit that did not pass, to know what to fix
      for (const c of CATS) {
        for (const ref of lhr.categories[c].auditRefs) {
          const a = lhr.audits[ref.id];
          if (a.score !== null && a.score < 0.9 && ref.weight > 0) {
            problems.push(`${formFactor} ${row.page} [${c}] ${a.id}: ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`);
          }
        }
      }

      const name = `${formFactor}-${row.page.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}.html`;
      await writeFile(`${OUT}/${name}`, report);
    }
  }
} finally {
  await chrome.kill();
}

console.table(rows);
console.log(problems.length ? `\nAudits below 90:\n${[...new Set(problems)].join('\n')}` : '\nAll weighted audits pass.');
