// Lint gate (npm run lint). Uses the toolchain react-scripts already ships:
// eslint-config-react-app (react, react-hooks, @typescript-eslint, a11y
// subset) plus the full jsx-a11y recommended set on top.
//
// NOTE: the presence of this file also activates CRA's build-time ESLint
// (eslint-webpack-plugin), so `npm run build` surfaces the same findings —
// and fails on them once CI=true. Keep `npm run lint` and the build in
// agreement: this one config is the single source of truth.
module.exports = {
	root: true,
	extends: ['react-app', 'plugin:jsx-a11y/recommended'],
	rules: {
		// The certification evidence procedure treats unexplained console
		// output as a failure. Survivors need a targeted
		// eslint-disable-next-line with a justification comment, and an entry
		// in the expected-console-message catalogue kept with the release
		// evidence.
		'no-console': 'error',
		// `_` is this codebase's deliberate throwaway name (destructuring
		// placeholders); rest-sibling destructuring is the idiom for omitting
		// keys from an object copy.
		'@typescript-eslint/no-unused-vars': ['warn', {varsIgnorePattern: '^_$', ignoreRestSiblings: true}],
	},
};
