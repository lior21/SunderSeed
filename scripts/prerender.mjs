// Post-build step: prerender the React app into <div id="root"> so the
// shipped single-file HTML contains real, crawlable content.
//
// Runs after `vite build`, loads src/prerender.tsx through Vite's SSR module
// loader (so TSX, aliases and define() replacements all resolve exactly like
// the client build), then rewrites dist/index.html in place.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const indexPath = path.resolve(root, 'dist/index.html');
const headersPath = path.resolve(root, 'dist/_headers');
const faviconPath = path.resolve(root, 'public/favicon.svg');
const ROOT_MARKER = '<div id="root"></div>';

function inlineSvgFavicon(html) {
  if (!fs.existsSync(faviconPath)) return html;
  const faviconSvg = fs.readFileSync(faviconPath, 'utf8');
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(faviconSvg, 'utf8').toString('base64')}`;
  return html.replace(
    /(<link\s+rel="icon"\s+type="image\/svg\+xml"[^>]*\s+href=")[^"]*"/,
    `$1${dataUri}"`,
  );
}

function getInlineScriptHashes(html) {
  const hashes = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRe)) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    // Non-executable data blocks (e.g., application/ld+json) are ignored by script-src.
    const typeMatch = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const scriptType = typeMatch ? typeMatch[1].toLowerCase() : '';
    if (scriptType && scriptType !== 'text/javascript' && scriptType !== 'module') {
      continue;
    }
    // External scripts with src= are not inline scripts.
    if (/\bsrc\s*=/i.test(attrs) || body.length === 0) {
      continue;
    }
    const digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

function buildCspDirectives(scriptHashes, { includeFrameAncestors }) {
  const directives = [
    "default-src 'none'",
    `script-src ${scriptHashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "manifest-src 'self'",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ];
  if (includeFrameAncestors) {
    directives.push("frame-ancestors 'none'");
  }
  return directives.join('; ');
}

function injectMetaCsp(html, metaCsp) {
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${metaCsp}" />`;
  const charsetRe = /(<meta\s+charset=["'][^"']+["']\s*\/?>)/i;
  if (!charsetRe.test(html)) {
    throw new Error('could not find <meta charset="..."> in dist/index.html');
  }
  return html.replace(charsetRe, `$1\n    ${metaTag}`);
}

const vite = await createServer({
  root,
  configFile: path.resolve(root, 'vite.config.ts'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const mod = await vite.ssrLoadModule('/src/prerender.tsx');
  const markup = mod.prerender();

  if (typeof markup !== 'string' || markup.length === 0) {
    throw new Error('prerender() returned no markup');
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes(ROOT_MARKER)) {
    throw new Error(`could not find ${ROOT_MARKER} in dist/index.html`);
  }

  html = html.replace(ROOT_MARKER, `<div id="root">${markup}</div>`);
  html = inlineSvgFavicon(html);

  const scriptHashes = getInlineScriptHashes(html);
  if (scriptHashes.length === 0) {
    throw new Error('expected at least one inline script in dist/index.html');
  }

  const metaCsp = buildCspDirectives(scriptHashes, { includeFrameAncestors: false });
  const headerCsp = buildCspDirectives(scriptHashes, { includeFrameAncestors: true });

  html = injectMetaCsp(html, metaCsp);
  fs.writeFileSync(indexPath, html, 'utf8');

  const headersContent = [
    '/*',
    `  Content-Security-Policy: ${headerCsp}`,
    '  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Referrer-Policy: no-referrer',
    '  Cross-Origin-Opener-Policy: same-origin',
    '  Cross-Origin-Resource-Policy: same-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
    '',
  ].join('\n');
  fs.writeFileSync(headersPath, headersContent, 'utf8');

  console.log(`prerender: injected ${markup.length.toLocaleString()} chars into dist/index.html`);
  console.log(`csp: generated ${scriptHashes.length} inline script hash(es) and wrote dist/_headers`);
} finally {
  await vite.close();
}
