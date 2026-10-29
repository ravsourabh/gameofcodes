import basicSsl from '@vitejs/plugin-basic-ssl';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

for (const file of ['.env.local', '.env']) if (existsSync(file)) loadEnvFile(file);

// The coding-preview entry is retired; preserved source/data are historical.
if(process.argv.includes('--legacy'))throw new Error('The coding-preview entry is retired. Use the current application runtime.');
const production = process.argv.includes('--production');
const port=(name,fallback)=>{const value=Number(process.env[name]||fallback);if(!Number.isInteger(value)||value<1024||value>65535)throw new Error('Choose an available application port.');return value;};
const desktopPort=port('GOC_HTTP_PORT',5173),headsetPort=port('GOC_HTTPS_PORT',5443),apiPort=port('GOC_API_PORT',4176);
const service = await (await import('../server/session-server.mjs')).startSessionServer({port:apiPort});
const proxy = {
  '/api': { target: `http://127.0.0.1:${apiPort}` },
};
const retirementPlugin = { name: 'retired-routes', configureServer(server) {
  server.middlewares.use((req, res, next) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
    if (/(?:^|\/)\.sovereign(?:\/|$)/i.test(pathname)) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Private storage is available only through the session service.' })); }
    else if (pathname === '/preview') { res.writeHead(410, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'The application preview route is retired.' })); }
    else next();
  });
} };
const watch = { ignored: ['**/.sovereign/**', '**/test-results/**', '**/archive/**'] };
const fs = { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.sovereign/**', '**/archive/**'] };
let vite,headset,productionWeb;
if(production){
  try{productionWeb=await (await import('../server/studio-web.mjs')).startStudioWeb({apiPort,httpPort:desktopPort,httpsPort:headsetPort});}catch(error){await service.close();throw error;}
}else{
const {createServer}=await import('vite');
vite = await createServer({ configFile: false,
  plugins: [retirementPlugin],
  server: { host: '127.0.0.1', port: desktopPort, strictPort: true, proxy, watch, fs },
});
headset = await createServer({ configFile: false,
  cacheDir: 'node_modules/.vite-headset',
  plugins: [retirementPlugin, basicSsl({ name: 'sovereign-local', certDir: '.sovereign/certs' })],
  server: { host: '0.0.0.0', port: headsetPort, strictPort: true, proxy, watch, fs },
});
try { await vite.listen(); await headset.listen(); }
catch (error) { await Promise.all([vite.close(), headset.close(), service.close()]); throw error; }
}
console.log('\nGame of Codes:');
if(production)console.log(`  http://127.0.0.1:${desktopPort}/`);else vite.printUrls();
console.log('\nQuest VR (HTTPS, same Wi-Fi):');
if(production)console.log(`  https://localhost:${headsetPort}/`);else headset.printUrls();
console.log('Quest HTTPS uses a development certificate. See README.md for headset setup.');
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if(productionWeb)await productionWeb.close();else await Promise.all([vite.close(), headset.close()]);
  await service.close();
  process.exit(0);
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
