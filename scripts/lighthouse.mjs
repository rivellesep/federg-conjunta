/**
 * Compares the current FEDERG site with this redesign using Lighthouse, mobile and desktop,
 * under the same conditions: same machine, same Lighthouse version and Lighthouse's own presets.
 *
 *   npm run lighthouse                               (federg.org and federg-conjunta.pages.dev)
 *   npm run lighthouse -- https://federg.org/news/   (any URLs)
 *   LH_RUNS=5 npm run lighthouse                     (more runs per URL, default 3)
 *
 * Each URL is measured several times and the median run is kept, because a single run on a
 * live site varies with the network. Reports (HTML and JSON) and a summary table are saved in
 * lighthouse/. Uses Chrome, or the browser in CHROME_PATH; on Windows it falls back to Edge.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { computeMedianRun } from 'lighthouse/core/lib/median-run.js';
import lhPackage from 'lighthouse/package.json' with { type: 'json' };

const lhVersion = lhPackage.version;

const DEFAULT_URLS = ['https://federg.org/', 'https://federg-conjunta.pages.dev/'];
const urls = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS;
const RUNS = Number(process.env.LH_RUNS ?? 3);
const OUT = 'lighthouse';
const CATS = ['performance', 'accessibility', 'best-practices', 'seo'];
const METRICS = {
  FCP: 'first-contentful-paint',
  LCP: 'largest-contentful-paint',
  TBT: 'total-blocking-time',
  CLS: 'cumulative-layout-shift',
  SI: 'speed-index',
};

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
if (!process.env.CHROME_PATH && process.platform === 'win32' && existsSync(EDGE)) {
  process.env.CHROME_PATH = EDGE;
}

const slug = (url) => new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-') +
  (new URL(url).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '') || '');

await mkdir(OUT, { recursive: true });
const chrome = await launch({ chromeFlags: ['--headless=new'] });
const rows = [];

try {
  for (const formFactor of ['mobile', 'desktop']) {
    for (const url of urls) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const result = await lighthouse(
          url,
          { port: chrome.port, output: ['html', 'json'], logLevel: 'error' },
          formFactor === 'desktop' ? desktopConfig : undefined
        );
        runs.push(result);
        process.stdout.write(`${formFactor} ${url} run ${i + 1}/${RUNS}: ${Math.round(result.lhr.categories.performance.score * 100)}\n`);
      }
      const median = computeMedianRun(runs.map((r) => r.lhr));
      const { lhr, report } = runs.find((r) => r.lhr === median);

      const name = `${formFactor}-${slug(url)}`;
      await writeFile(`${OUT}/${name}.html`, report[0]);
      await writeFile(`${OUT}/${name}.json`, report[1]);

      const row = { form: formFactor, url };
      for (const c of CATS) row[c] = Math.round((lhr.categories[c]?.score ?? 0) * 100);
      for (const [label, id] of Object.entries(METRICS)) row[label] = lhr.audits[id].displayValue;
      row.weight = `${Math.round(lhr.audits['total-byte-weight'].numericValue / 1024)} KiB`;
      row.requests = lhr.audits['network-requests'].details?.items?.length ?? '';
      rows.push(row);
    }
  }
} finally {
  await chrome.kill();
}

console.table(rows);

const head = ['Dispositivo', 'URL', ...CATS, ...Object.keys(METRICS), 'Peso', 'Peticiones'];
const md = [
  `# Lighthouse: federg.org frente a federg-conjunta.pages.dev`,
  '',
  `Fecha: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Lighthouse ${lhVersion}, ` +
    `${RUNS} ejecuciones por URL y dispositivo, se guarda la mediana. Navegador: ${process.env.CHROME_PATH ?? 'Chrome'} sin interfaz.`,
  'Móvil: preset por defecto de Lighthouse (pantalla de móvil, red 4G lenta simulada, CPU 4 veces más lenta). Escritorio: preset de escritorio de Lighthouse.',
  '',
  `| ${head.join(' | ')} |`,
  `| ${head.map(() => '---').join(' | ')} |`,
  ...rows.map((r) => `| ${[r.form, r.url, ...CATS.map((c) => r[c]), ...Object.keys(METRICS).map((m) => r[m]), r.weight, r.requests].join(' | ')} |`),
  '',
];
await writeFile(`${OUT}/resumen.md`, md.join('\n'));
console.log(`\nInformes y resumen guardados en ${OUT}/`);
