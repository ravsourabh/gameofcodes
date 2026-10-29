import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import { chromium } from '@playwright/test';
import { WIDTH, HEIGHT, isProjectId, parseInput, validPreviewOrigin } from './protocol.mjs';
import { createCourtService } from './court.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STORE = path.join(ROOT, '.sovereign', 'projects');
const browserPath = process.env.SOVEREIGN_BROWSER_PATH || [
  chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);

export async function startPreviewServer() {
  await mkdir(STORE, { recursive: true });
  let browser;
  let browserPromise;
  let shuttingDown = false;
  const rooms = new Map();
  const opening = new Map();
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

  const boardServer = http.createServer(async (req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname;
    const generated = name.match(/^\/projects\/([a-f0-9-]{36})\/([a-f0-9-]{36})\/(index\.html|app\.css|app\.js)$/i);
    if (generated && isProjectId(generated[1]) && isProjectId(generated[2])) {
      try {
        const body = await readFile(path.join(ROOT, '.sovereign', 'builds', generated[1], generated[2], generated[3]));
        res.writeHead(200, { 'Content-Type': mime[path.extname(generated[3])], 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'", 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }).end(body);
      } catch { res.writeHead(404).end('Application version unavailable'); }
      return;
    }
    const files = { '/': 'index.html', '/board.js': 'board.js', '/board.css': 'board.css' };
    if (!files[name]) { res.writeHead(404).end(); return; }
    try {
      const body = await readFile(path.join(ROOT, 'board', files[name]));
      res.writeHead(200, { 'Content-Type': mime[path.extname(name === '/' ? 'index.html' : name)],
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }).end(body);
    } catch { res.writeHead(500).end('Board asset unavailable'); }
  });
  await new Promise((resolve, reject) => { boardServer.once('error', reject); boardServer.listen(4174, '127.0.0.1', resolve); });

  async function getBrowser() {
    if (browser?.isConnected()) return browser;
    if (!browserPromise) browserPromise = chromium.launch({ executablePath: browserPath,
      headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage'] }).then(b => {
      browser = b;
      b.on('disconnected', () => { browser = undefined; browserPromise = undefined; });
      return b;
    }).catch(error => { browserPromise = undefined; throw error; });
    return browserPromise;
  }

  function broadcast(room, data) {
    const message = JSON.stringify(data);
    for (const ws of room.clients) if (ws.readyState === WebSocket.OPEN) ws.send(message);
  }

  async function save(room) {
    const state = await room.context.storageState();
    const tmp = path.join(STORE, `${room.id}.tmp`);
    await writeFile(tmp, JSON.stringify(state));
    await rename(tmp, path.join(STORE, `${room.id}.json`));
  }

  async function getRoom(id) {
    if (rooms.has(id)) return rooms.get(id);
    if (opening.has(id)) return opening.get(id);
    if (rooms.size + opening.size >= 4) {
      const idle = [...rooms.values()].filter(room => room.clients.size === 0).sort((a, b) => a.lastUsed - b.lastUsed)[0];
      if (idle) {
        rooms.delete(idle.id); clearInterval(idle.timer); await idle.queue;
        await save(idle); await idle.context.close();
      } else throw new Error('All four preview seats are occupied. Close an unused project and try again shortly.');
    }
    const promise = (async () => {
      const b = await getBrowser();
      let storageState;
      try { storageState = JSON.parse(await readFile(path.join(STORE, `${id}.json`), 'utf8')); } catch { /* A new project has no saved state. */ }
      const context = await b.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1,
        storageState, javaScriptEnabled: true, serviceWorkers: 'block' });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        const ownPath = url.pathname.startsWith(`/projects/${id}/`) || ['/', '/board.js', '/board.css', '/favicon.ico'].includes(url.pathname);
        return url.origin === 'http://127.0.0.1:4174' && ownPath ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const artifact = await court.currentArtifact(id);
      await page.goto(artifact ? `http://127.0.0.1:4174/projects/${id}/${artifact.version}/index.html` : 'http://127.0.0.1:4174/?keyboard=1', { waitUntil: 'networkidle' });
      const room = { id, context, page, clients: new Set(), queue: Promise.resolve(), frame: 0, busy: false, lastUsed: Date.now(), lastCapture: 0, dirtyUntil: Date.now() + 1000, timer: undefined };
      rooms.set(id, room);
      await save(room);
      room.timer = setInterval(async () => {
        if (room.busy || room.clients.size === 0 || shuttingDown) return;
        // The supplied app is mostly static. Keep idle sessions fresh without
        // continually rasterizing unchanged pages in every open project.
        if (Date.now() > room.dirtyUntil && Date.now() - room.lastCapture < 1800) return;
        room.busy = true;
        try {
          const image = await room.page.screenshot({ type: 'jpeg', quality: 82, timeout: 5000 });
          room.lastCapture = Date.now();
          room.frame++;
          broadcast(room, { type: 'frame', frame: room.frame, capturedAt: Date.now() });
          for (const ws of room.clients) if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 250_000) ws.send(image);
        } catch (error) { broadcast(room, { type: 'error', message: 'The preview paused. Reconnect to recover your saved project.' }); }
        finally { room.busy = false; }
      }, 125);
      return room;
    })();
    opening.set(id, promise);
    try { return await promise; } finally { opening.delete(id); }
  }

  const court = createCourtService({ root: ROOT, getRoom, saveRoom: save, broadcast });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (await court.handle(req, res, url)) return;
    if (url.pathname === '/api/health') {
      const priority = name => /wi-fi|wlan/i.test(name) ? 0 : /virtual|vethernet|wsl|docker|bridge/i.test(name) ? 2 : 1;
      const headsetUrls = Object.entries(networkInterfaces()).sort(([a], [b]) => priority(a) - priority(b)).flatMap(([, addresses]) => addresses || []).filter(address => address.family === 'IPv4' && !address.internal).map(address => `https://${address.address}:5443/`);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ status: 'ready', mode: 'local-preview', width: WIDTH, height: HEIGHT, desktopUrl: 'http://localhost:5173/', headsetUrls }));
    } else res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    const validOrigin = validPreviewOrigin(req.headers);
    if (url.pathname !== '/preview' || !validOrigin || !isProjectId(url.searchParams.get('project'))) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, url.searchParams.get('project')));
  });
  wss.on('connection', async (ws, id) => {
    ws.on('error', () => {});
    ws.send(JSON.stringify({ type: 'status', status: 'connecting', message: 'Opening your application…' }));
    let room;
    try {
      room = await getRoom(id);
      if (ws.readyState !== WebSocket.OPEN) return;
      room.clients.add(ws);
      room.lastUsed = Date.now();
      room.dirtyUntil = Date.now() + 1000;
      ws.send(JSON.stringify({ type: 'status', status: 'ready', width: WIDTH, height: HEIGHT, version: 'starter-1', message: 'Live browser · local preview service' }));
    } catch (error) {
      const hint = /executable|browser.*launch|browser.*closed/i.test(error.message) ? ' Install a browser with npx playwright install chromium if needed.' : '';
      ws.send(JSON.stringify({ type: 'error', message: `${error.message}${hint}` }));
      ws.close(1011, 'Preview unavailable'); return;
    }
    let pending = 0;
    ws.on('message', raw => {
      const input = parseInput(raw.toString());
      if (!input || pending >= 40) return;
      if (input.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
      pending++;
      room.queue = room.queue.then(async () => {
        room.lastUsed = Date.now();
        room.dirtyUntil = Date.now() + 1000;
        if (input.type === 'click') await room.page.mouse.click(input.x, input.y);
        if (input.type === 'text') await room.page.keyboard.insertText(input.text);
        if (input.type === 'key') await room.page.keyboard.press(input.key);
        if (input.type === 'reload') { await save(room); await room.page.reload({ waitUntil: 'domcontentloaded' }); }
        if (input.type === 'export') {
          const data = await room.page.evaluate(() => JSON.parse(localStorage.getItem('sovereign-board-v1') || '{}'));
          ws.send(JSON.stringify({ type: 'export', data }));
        }
        await save(room);
        const focus = await room.page.evaluate(() => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName));
        broadcast(room, { type: 'input', textFocused: focus, handledAt: Date.now() });
      }).catch(error => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message: 'That action did not finish. Your saved tasks are preserved; reconnect and try again.' })); })
        .finally(() => { pending--; });
    });
    ws.on('close', () => { room.clients.delete(ws); room.lastUsed = Date.now(); });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4175, '127.0.0.1', resolve); });

  const cleanup = setInterval(async () => {
    for (const [id, room] of rooms) {
      if (room.clients.size === 0 && Date.now() - room.lastUsed > 60_000) {
        clearInterval(room.timer);
        await room.queue;
        await save(room).catch(() => {});
        await room.context.close().catch(() => {});
        rooms.delete(id);
      }
    }
  }, 15_000);
  return { async close() {
    shuttingDown = true;
    clearInterval(cleanup);
    for (const ws of wss.clients) ws.close(1001, 'Server shutting down');
    for (const room of rooms.values()) {
      clearInterval(room.timer);
      await room.queue;
      await save(room).catch(() => {});
    }
    if (browser) await browser.close();
    wss.close();
    await Promise.all([new Promise(r => server.close(r)), new Promise(r => boardServer.close(r))]);
  } };
}
