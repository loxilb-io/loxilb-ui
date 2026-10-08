import fs from 'node:fs';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';
import imports from 'eslint-plugin-import';
import localPolicy from './scripts/eslint-local-policy.cjs';

// Own the effective policy instead of retaining CRA's vulnerable lint tree.
// ESLint 9 is a compatibility bridge, not a maintained-version qualification:
// react/jsx-a11y/import still declare support only through 9, not 10.
const policy = JSON.parse(fs.readFileSync(new URL('./scripts/eslint-policy.json', import.meta.url), 'utf8'));

export default [
	{
		files: ['src/**/*.{ts,tsx}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {ecmaFeatures: {jsx: true}},
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {...globals.browser, ...globals.node, ...globals.jest},
		},
		plugins: {'@typescript-eslint': tsPlugin, react, 'react-hooks': hooks, 'jsx-a11y': a11y, import: imports},
		settings: {react: {version: 'detect'}},
		// Preserve every applicable existing severity and rule option. Avoid
		// silently substituting a new recommended preset with different gates.
		rules: {...policy.rules, ...localPolicy.rules},
	},
	...localPolicy.overrides,
];
