import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import {fileURLToPath} from 'node:url';
const hooks = fileURLToPath(new URL('./process/hooks.ts', import.meta.url));
export default defineConfig({
	plugins: [react(), tsconfigPaths()],
	resolve: {alias: [
		{find: /^hooks\/instanceHook$/, replacement: hooks},
		{find: /^hooks\/query\/statusHook$/, replacement: hooks},
		{find: /^hooks\/query\/oamHooks$/, replacement: hooks},
	]},
	define: {'process.env.REACT_APP_PUBLIC_URL': '""'},
});
