import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

let projectRoot = '', outputDirectory = '';

export default defineConfig({
  plugins:[{name:'release-metadata',generateBundle(){this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({wave:12,milestone:'studio-core-pilot',revision:process.env.GOC_BUILD_REVISION||'local',builtAt:new Date().toISOString()})});}}, {
    name: 'reviewed-publishing-kit',
    apply: 'build',
    configResolved(config) {
      projectRoot = config.root;
      outputDirectory = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      execFileSync(process.execPath, [path.join(projectRoot, 'scripts/copy-publishing-kit.mjs'), '--out-dir', outputDirectory], {cwd: projectRoot, stdio: 'inherit'});
    },
  }],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.sovereign/**', '**/archive/**'] },
    watch: { ignored: ['**/.sovereign/**', '**/test-results/**', '**/archive/**'] },
    proxy: {
      '/api': { target: 'http://127.0.0.1:4176' },
    },
  },
  build: { target: 'es2022', sourcemap: true },
});
