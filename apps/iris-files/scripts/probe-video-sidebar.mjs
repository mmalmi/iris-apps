import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const distDir = path.resolve(import.meta.dirname, '..', 'dist-video');
const screenshotPath = path.resolve(import.meta.dirname, '..', 'test-results', 'video-sidebar-probe.png');
const targetArg = process.argv[2] ?? '';
const routeArg = process.argv[3];
const originOverride = /^https?:\/\//.test(targetArg) ? targetArg.replace(/\/$/, '') : null;
const route = (originOverride ? routeArg : targetArg)
  ?? '#/npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk/videos%2FMine%20Bombers%20in-game%20music';

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

function contentTypeFor(filePath) {
  return MIME_TYPES.get(path.extname(filePath)) ?? 'application/octet-stream';
}

function safeJoin(rootDir, requestPath) {
  const normalized = requestPath === '/' ? '/index.html' : requestPath;
  const fullPath = path.resolve(rootDir, `.${normalized}`);
  if (!fullPath.startsWith(rootDir + path.sep) && fullPath !== path.join(rootDir, 'index.html')) {
    throw new Error(`Refusing to serve path outside root: ${requestPath}`);
  }
  return fullPath;
}

async function startServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      const filePath = safeJoin(rootDir, decodeURIComponent(requestUrl.pathname));
      const body = await readFile(filePath);
      res.writeHead(200, {
        'content-type': contentTypeFor(filePath),
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : 'not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine probe server address');
  }

  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
  };
}

const localServer = originOverride ? null : await startServer(distDir);
const origin = originOverride ?? localServer?.origin;
if (!origin) {
  throw new Error('Missing probe origin');
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1792, height: 1210 } });
const consoleErrors = [];
const responseErrors = [];

page.on('console', (message) => {
  if (message.type() === 'error') {
    consoleErrors.push(message.text());
  }
});
page.on('response', (response) => {
  if (response.status() >= 400) {
    responseErrors.push(`${response.status()} ${response.request().resourceType()} ${response.url()}`);
  }
});

try {
  await page.goto(`${origin}/index.html${route}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(20000);

  const stats = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('a.flex.gap-2.group.no-underline')).filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.right > window.innerWidth * 0.6;
    });

    const visible = cards.slice(0, 10).map((card) => {
      const img = card.querySelector('img');
      const placeholder = card.querySelector('[data-testid="media-placeholder"]');
      return {
        title: card.textContent?.trim() ?? '',
        hasImg: !!img,
        loaded: !!img && !!img.currentSrc && img.complete && img.naturalWidth > 0,
        hasPlaceholder: !!placeholder,
      };
    });

    return {
      count: visible.length,
      loaded: visible.filter((item) => item.loaded).length,
      placeholders: visible.filter((item) => item.hasPlaceholder).length,
      broken: visible.filter((item) => item.hasImg && !item.loaded && !item.hasPlaceholder).length,
      visible,
    };
  });

  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log(JSON.stringify({
    origin,
    route,
    stats,
    consoleErrors,
    responseErrors,
    screenshotPath,
  }, null, 2));
} finally {
  await browser.close();
  if (localServer) {
    await new Promise((resolve) => localServer.server.close(resolve));
  }
}
