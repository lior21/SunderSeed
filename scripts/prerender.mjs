// Post-build step: prerender the React app into <div id="root"> so the
// shipped single-file HTML contains real, crawlable content.
//
// Runs after `vite build`, loads src/prerender.tsx through Vite's SSR module
// loader (so TSX, aliases and define() replacements all resolve exactly like
// the client build), then rewrites dist/index.html in place.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const indexPath = path.resolve(root, 'dist/index.html');
const ROOT_MARKER = '<div id="root"></div>';

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

  const html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes(ROOT_MARKER)) {
    throw new Error(`could not find ${ROOT_MARKER} in dist/index.html`);
  }

  fs.writeFileSync(indexPath, html.replace(ROOT_MARKER, `<div id="root">${markup}</div>`), 'utf8');

  console.log(`prerender: injected ${markup.length.toLocaleString()} chars into dist/index.html`);
} finally {
  await vite.close();
}
