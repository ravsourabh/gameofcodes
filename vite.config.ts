import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/.sovereign/**', '**/test-results/**'] },
    proxy: {
      '/preview': { target: 'http://127.0.0.1:4175', ws: true },
      '/api': { target: 'http://127.0.0.1:4175' },
    },
  },
  build: { target: 'es2022', sourcemap: true },
});
