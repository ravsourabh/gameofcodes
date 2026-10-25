import { createServer } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { startPreviewServer } from '../server/preview.mjs';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

for (const file of ['.env.local', '.env']) if (existsSync(file)) loadEnvFile(file);

const production = process.argv.includes('--production');
const preview = await startPreviewServer();
const proxy = {
  '/preview': { target: 'http://127.0.0.1:4175', ws: true },
  '/api': { target: 'http://127.0.0.1:4175' },
};
const watch = { ignored: ['**/.sovereign/**', '**/test-results/**'] };
const vite = await createServer({ configFile: false, ...(production ? { root: 'dist' } : {}),
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy, watch },
});
const headset = await createServer({ configFile: false, ...(production ? { root: 'dist' } : {}),
  cacheDir: '.sovereign/vite-headset',
  plugins: [basicSsl({ name: 'sovereign-local', certDir: '.sovereign/certs' })],
  server: { host: '0.0.0.0', port: 5443, strictPort: true, proxy, watch },
});
try { await vite.listen(); await headset.listen(); }
catch (error) { await Promise.all([vite.close(), headset.close(), preview.close()]); throw error; }
console.log('\nDesktop preview (no certificate prompt):');
vite.printUrls();
console.log('\nQuest VR (HTTPS, same Wi-Fi):');
headset.printUrls();
console.log('Quest HTTPS uses a development certificate. See README.md for headset setup.');
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await Promise.all([vite.close(), headset.close()]);
  await preview.close();
  process.exit(0);
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
