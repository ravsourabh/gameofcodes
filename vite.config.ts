import { defineConfig } from 'vite';

export default defineConfig({
  plugins:[{name:'release-metadata',generateBundle(){this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({wave:6,revision:process.env.GOC_BUILD_REVISION||'local',builtAt:new Date().toISOString()})});}}],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.sovereign/**'] },
    watch: { ignored: ['**/.sovereign/**', '**/test-results/**'] },
    proxy: {
      '/api': { target: 'http://127.0.0.1:4176' },
    },
  },
  build: { target: 'es2022', sourcemap: true },
});
