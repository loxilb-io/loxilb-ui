import tsconfigPaths from 'vite-tsconfig-paths';
import {defineConfig} from 'vitest/config';

// Vitest runs standalone next to the CRA build (react-scripts owns the app
// bundle until the H7 Vite migration). tsconfigPaths resolves the
// baseUrl-style absolute imports ('common', 'types/...', 'api', ...).
export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		environment: 'jsdom',
		// jsdom needs an http(s) origin for localStorage to exist
		environmentOptions: {jsdom: {url: 'http://localhost/'}},
		setupFiles: ['./vitest.setup.ts'],
		include: ['src/**/*.test.{ts,tsx}'],
		// generated API types are build artifacts — no tests live there
		exclude: ['node_modules', 'build', 'src/api/gen'],
	},
});
