// Renders docs/branding/og-image.svg to public/og-image.png (1200x630)
// using a local Chromium-based browser in headless mode.
//
// Usage: npm run og:image
// Override browser discovery with CHROME_PATH=/path/to/chrome.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(root, 'docs/branding/og-image.svg');
const target = path.resolve(root, 'public/og-image.png');

const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean);

const browser = candidates.find(p => fs.existsSync(p));
if (!browser) {
  console.error('og-image: no Chromium-based browser found. Set CHROME_PATH and retry.');
  process.exit(1);
}

const profileDir = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'og-image-'));
const args = [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  `--user-data-dir=${profileDir}`,
  '--window-size=1200,630',
  '--force-device-scale-factor=1',
  `--screenshot=${target}`,
  pathToFileURL(source).href,
];

try {
  execFileSync(browser, args, { stdio: 'ignore' });
} finally {
  fs.rmSync(profileDir, { recursive: true, force: true });
}

const { size } = fs.statSync(target);
console.log(`og-image: wrote ${path.relative(root, target)} (${(size / 1024).toFixed(0)} KB)`);
