/**
 * Multi-device review of the published site: every page in the sitemap at four screen sizes.
 *
 *   npm run revision                                  (federg-conjunta.pages.dev)
 *   REVIEW_BASE=http://localhost:4321 npm run revision (any other copy of the site)
 *
 * For each page and size it records: HTTP status, horizontal scroll, broken images, images
 * without alt, number of h1, empty links, console errors, text under 12 px and card grids
 * whose last row is incomplete. It saves full-page screenshots of a few representative pages
 * (and the open menu) in capturas/revision-dispositivos/, plus resultados.json.
 * Reduced motion is emulated so screenshots are not taken in the middle of an animation.
 * Uses the browser in CHROME_PATH; on Windows it falls back to Edge.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const BASE = (process.env.REVIEW_BASE ?? 'https://federg-conjunta.pages.dev').replace(/\/$/, '');
const OUT = 'capturas/revision-dispositivos';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browserPath = process.env.CHROME_PATH ?? (existsSync(EDGE) ? EDGE : null);
if (!browserPath) {
  console.error('Set CHROME_PATH to a Chrome or Edge executable.');
  process.exit(1);
}

const DEVICES = [
  { id: 'movil-375', width: 375, height: 812, mobile: true },
  { id: 'tablet-768', width: 768, height: 1024, mobile: true },
  { id: 'tablet-1024', width: 1024, height: 768, mobile: true },
  { id: 'escritorio-1440', width: 1440, height: 900, mobile: false },
];

// Pages that also get a full-page screenshot in every size
const SHOTS = {
  '/': 'home',
  '/about/members/': 'about_members',
  '/news/': 'news',
  '/news/strategic-plan-2026-2029/': 'news_strategic-plan-2026-2029',
  '/events/': 'events',
  '/events/world-kidney-day-2027/': 'events_world-kidney-day-2027',
  '/patient-stories/marta-planning-around-dialysis/': 'patient-stories_marta-planning-around-dialysis',
  '/contact/': 'contact',
  '/search/': 'search',
  '/pagina-inexistente/': 'pagina-inexistente',
};

const sitemap = await (await fetch(`${BASE}/sitemap-0.xml`)).text();
const fromSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const pages = [...new Set([...fromSitemap, ...Object.keys(SHOTS)])];

// Runs inside the page: everything we measure
function measure() {
  const d = document.documentElement;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  // Grids (or wrapping flex rows) of 3+ items whose last row is shorter than the others
  const looseRows = [];
  for (const g of document.querySelectorAll('main *')) {
    const s = getComputedStyle(g);
    if (!(s.display === 'grid' || (s.display === 'flex' && s.flexWrap === 'wrap'))) continue;
    const kids = [...g.children].filter((k) => k.getBoundingClientRect().width > 0 && getComputedStyle(k).position !== 'absolute');
    if (kids.length < 3) continue;
    const tops = kids.map((k) => Math.round(k.getBoundingClientRect().top));
    const perRow = [...new Set(tops)].map((t) => tops.filter((x) => x === t).length);
    const cols = Math.max(...perRow);
    if (perRow.length > 1 && cols > 1 && perRow.at(-1) < cols && perRow.slice(0, -1).every((n) => n === cols)) {
      looseRows.push(`${g.tagName.toLowerCase()}.${String(g.className).trim().split(/\s+/).join('.')} ${perRow.join('+')}`);
    }
  }

  return {
    overflowX: d.scrollWidth - d.clientWidth,
    brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
    imagesWithoutAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
    h1: document.querySelectorAll('h1').length,
    emptyLinks: document.querySelectorAll('a[href="#"]').length,
    smallText: [...document.querySelectorAll('body *')]
      .filter((el) => hasOwnText(el) && visible(el) && parseFloat(getComputedStyle(el).fontSize) < 12)
      .map((el) => el.textContent.trim().slice(0, 40)),
    looseRows,
  };
}

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
const results = [];

try {
  for (const device of DEVICES) {
    await mkdir(`${OUT}/${device.id}`, { recursive: true });
    const page = await browser.newPage();
    await page.setViewport({ width: device.width, height: device.height, isMobile: device.mobile, hasTouch: device.mobile });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    let consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    for (const path of pages) {
      consoleErrors = [];
      const response = await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 45000 });
      // Scroll to the bottom so lazy images and scroll reveals load
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      results.push({ device: device.id, path, status: response?.status(), consoleErrors, ...(await page.evaluate(measure)) });
      if (SHOTS[path]) {
        await page.screenshot({ path: `${OUT}/${device.id}/${SHOTS[path]}.jpg`, type: 'jpeg', quality: 62, fullPage: true });
      }
    }

    // Open the first menu button on the home page (the burger on mobile, a dropdown on larger screens)
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button[aria-expanded], button[aria-controls]')]
        .find((b) => b.getBoundingClientRect().width > 0);
      button?.click();
    });
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: `${OUT}/${device.id}/menu-abierto.jpg`, type: 'jpeg', quality: 62 });
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile(`${OUT}/resultados.json`, `${JSON.stringify(results, null, 2)}\n`);

// Summary per device
const summary = DEVICES.map(({ id }) => {
  const rows = results.filter((r) => r.device === id);
  return {
    device: id,
    pages: rows.length,
    'not 200': rows.filter((r) => r.status !== 200).map((r) => `${r.path} (${r.status})`).join(', ') || 0,
    'h-scroll': rows.filter((r) => r.overflowX > 0).length,
    'broken img': rows.reduce((n, r) => n + r.brokenImages.length, 0),
    'no alt': rows.reduce((n, r) => n + r.imagesWithoutAlt, 0),
    'h1 != 1': rows.filter((r) => r.h1 !== 1).length,
    'href="#"': rows.reduce((n, r) => n + r.emptyLinks, 0),
    'js errors': rows.filter((r) => r.consoleErrors.length).map((r) => r.path).join(', ') || 0,
    '<12px text': rows.filter((r) => r.smallText.length).map((r) => r.path).join(', ') || 0,
  };
});
console.table(summary);
console.log(`Screenshots and resultados.json in ${OUT}/`);
