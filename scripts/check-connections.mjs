import { fileURLToPath } from 'node:url';
import { createProviderBridge } from '../server/providers.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const bridge = createProviderBridge({ root });
try {
  if (process.argv[2] === '--check') await bridge.check(process.argv[3]);
  console.log(JSON.stringify(await bridge.status(), null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
