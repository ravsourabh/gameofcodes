import { createServer } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

for (const file of ['.env.local', '.env']) if (existsSync(file)) loadEnvFile(file);

// The default app is independent of the retired browser/build service.
// Legacy regression fixtures explicitly opt into the old entry and service.
const legacy = process.argv.includes('--legacy');
const production = process.argv.includes('--production');
if (legacy && production) throw new Error('The legacy fixture is development-only.');
const service = legacy
  ? await (await import('../server/preview.mjs')).startPreviewServer()
  : await (await import('../server/session-server.mjs')).startSessionServer();
const proxy = legacy ? {
  '/preview': { target: 'http://127.0.0.1:4175', ws: true },
  '/api': { target: 'http://127.0.0.1:4175' },
} : {
  '/api': { target: 'http://127.0.0.1:4176' },
};
const entryPlugin = { name: 'legacy-entry-fixture', transformIndexHtml: html => legacy ? html.replace('/src/session-main.ts', '/src/court-main.ts') : html };
const retirementPlugin = { name: 'retired-routes', configureServer(server) {
  if (legacy) return;
  server.middlewares.use((req, res, next) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
    if (/(?:^|\/)\.sovereign(?:\/|$)/i.test(pathname)) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Private storage is available only through the session service.' })); }
    else if (pathname === '/preview') { res.writeHead(410, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'The application preview route is retired.' })); }
    else next();
  });
} };
const watch = { ignored: ['**/.sovereign/**', '**/test-results/**'] };
const fs = { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.sovereign/**'] };
const vite = await createServer({ configFile: false, ...(production ? { root: 'dist' } : {}),
  plugins: [entryPlugin, retirementPlugin],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy, watch, fs },
});
const headset = await createServer({ configFile: false, ...(production ? { root: 'dist' } : {}),
  cacheDir: 'node_modules/.vite-headset',
  plugins: [entryPlugin, retirementPlugin, basicSsl({ name: 'sovereign-local', certDir: '.sovereign/certs' })],
  server: { host: '0.0.0.0', port: 5443, strictPort: true, proxy, watch, fs },
});
try { await vite.listen(); await headset.listen(); }
catch (error) { await Promise.all([vite.close(), headset.close(), service.close()]); throw error; }
console.log(legacy ? '\nLegacy regression fixture:' : '\nGame of Codes session setup:');
vite.printUrls();
console.log('\nQuest VR (HTTPS, same Wi-Fi):');
headset.printUrls();
console.log('Quest HTTPS uses a development certificate. See README.md for headset setup.');
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await Promise.all([vite.close(), headset.close()]);
  await service.close();
  process.exit(0);
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
