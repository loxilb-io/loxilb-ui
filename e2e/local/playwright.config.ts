import {defineConfig} from '@playwright/test';
import path from 'node:path';

// No shared setup project, credentials, environment file or testbed endpoints.
export default defineConfig({
	testDir: '.', testMatch: '*.spec.ts', workers: 1, retries: 0,
	forbidOnly: !!process.env.CI,
	use: {baseURL: 'http://127.0.0.1:4179', viewport: {width: 1280, height: 900}},
	webServer: {
		command: 'node node_modules/vite/bin/vite.js --config e2e/local/vite.config.mjs --host 127.0.0.1 --port 4179 --strictPort',
		cwd: path.resolve(__dirname, '../..'),
		url: 'http://127.0.0.1:4179/e2e/local/process/', reuseExistingServer: false,
	},
});
