import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.resolve(root, 'public');

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
  console.error('generate-favicons: no Chromium-based browser found.');
  process.exit(1);
}

// Icon design: branded squircle tile with cyan-to-blue gradient and white SunderSeed crystal
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
  <defs>
    <linearGradient id="sunderGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="50%" stop-color="#0ea5e9" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#sunderGrad)" />
  <g transform="translate(256, 256) scale(6.2) translate(-31, -31.5)">
    <path d="M28 5 L18 22 L12 40 L16 52 L28 58 L38 56 L46 44 L50 28 L40 10 L34 6 Z" fill="#ffffff" />
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), iconSvg, 'utf-8');

const htmlPage = `<!DOCTYPE html>
<html>
<body>
<script>
async function run() {
  const svgText = ${JSON.stringify(iconSvg)};
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });

  const sizes = [16, 32, 48, 96, 180, 192, 512];
  for (const s of sizes) {
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, s, s);
    const dataUrl = c.toDataURL('image/png');
    await fetch('/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: s, data: dataUrl.split(',')[1] })
    });
  }
  await fetch('/done');
}
run();
</script>
</body>
</html>`;

const savedBuffers = {};

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlPage);
    return;
  }
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const { size, data } = JSON.parse(body);
      savedBuffers[size] = Buffer.from(data, 'base64');
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/done') {
    res.writeHead(200);
    res.end('done');
    finish();
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const tempProfile = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'ss-edge-'));
  
  const child = spawn(browser, [
    '--headless',
    '--disable-gpu',
    `--user-data-dir=${tempProfile}`,
    `http://127.0.0.1:${port}/`
  ]);

  global.childProcess = child;
  global.tempProfile = tempProfile;
});

function finish() {
  try {
    if (global.childProcess) {
      global.childProcess.kill();
    }
  } catch {}
  try {
    if (global.tempProfile) {
      fs.rmSync(global.tempProfile, { recursive: true, force: true });
    }
  } catch {}

  server.close(() => {
    // Write out PNG files
    fs.writeFileSync(path.join(publicDir, 'favicon-48x48.png'), savedBuffers[48]);
    fs.writeFileSync(path.join(publicDir, 'favicon-96x96.png'), savedBuffers[96]);
    fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), savedBuffers[180]);
    fs.writeFileSync(path.join(publicDir, 'favicon-192x192.png'), savedBuffers[192]);
    fs.writeFileSync(path.join(publicDir, 'favicon-512x512.png'), savedBuffers[512]);
    fs.writeFileSync(path.join(publicDir, 'favicon.png'), savedBuffers[96]);
    console.log('Saved all raster favicons to public/');

    // Build multi-res favicon.ico containing 16x16, 32x32, 48x48
    const icoSizes = [
      { size: 16, buf: savedBuffers[16] },
      { size: 32, buf: savedBuffers[32] },
      { size: 48, buf: savedBuffers[48] },
    ];

    const headerSize = 6;
    const dirEntrySize = 16;
    let offset = headerSize + dirEntrySize * icoSizes.length;

    const header = Buffer.alloc(headerSize);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type: 1 = ICO
    header.writeUInt16LE(icoSizes.length, 4);

    const entries = [];
    for (const item of icoSizes) {
      const entry = Buffer.alloc(dirEntrySize);
      entry.writeUInt8(item.size, 0);
      entry.writeUInt8(item.size, 1);
      entry.writeUInt8(0, 2);
      entry.writeUInt8(0, 3);
      entry.writeUInt16LE(1, 4);
      entry.writeUInt16LE(32, 6);
      entry.writeUInt32LE(item.buf.length, 8);
      entry.writeUInt32LE(offset, 12);
      entries.push(entry);
      offset += item.buf.length;
    }

    const icoBuffer = Buffer.concat([header, ...entries, ...icoSizes.map(i => i.buf)]);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
    console.log('Saved public/favicon.ico (16x16, 32x32, 48x48)');
    process.exit(0);
  });
}
