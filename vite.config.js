import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const release = JSON.parse(readFileSync(new URL('./public/version.json', import.meta.url), 'utf8'));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(release.version),
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(release.buildDate),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    cors: true,
  },
});
