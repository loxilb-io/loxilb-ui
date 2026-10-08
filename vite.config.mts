import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import {readFileSync} from 'node:fs';

export default defineConfig(({mode}) => {
 const env = loadEnv(mode, process.cwd(), 'REACT_APP_');
 const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
 const publicUrl = env.REACT_APP_PUBLIC_URL ?? '/netlox';
 // Keep deployed public settings compatible. Never inline the server's full environment.
 const settings: Record<string, string | undefined> = {
  REACT_APP_API_URL: env.REACT_APP_API_URL ?? '/api/oam',
  REACT_APP_PUBLIC_URL: publicUrl,
  REACT_APP_VERSION: env.REACT_APP_VERSION ?? version,
  REACT_APP_ENV: env.REACT_APP_ENV,
  REACT_APP_REPATCH_INTERVAL: env.REACT_APP_REPATCH_INTERVAL,
 };
 return {
  plugins: [react(), tsconfigPaths()],
  base: `${publicUrl.replace(/\/$/, '')}/`,
  define: Object.fromEntries(Object.entries(settings).map(([key, value]) => [`process.env.${key}`, value === undefined ? 'undefined' : JSON.stringify(value)])),
  build: {
   outDir: 'build', sourcemap: false,
   rolldownOptions: {output: {
    entryFileNames: 'static/js/[name]-[hash].js',
    chunkFileNames: 'static/js/[name]-[hash].js',
    assetFileNames: 'static/assets/[name]-[hash][extname]',
   }},
  },
 };
});
