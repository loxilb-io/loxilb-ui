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
		// UI-P6-2 recurrence guard (ES-17): `parseInt(x) || 0` silently turns
		// garbage into 0 — which on rate-limit fields means UNLIMITED. Numeric
		// fields keep raw-string state and validate via
		// components/input/numericField instead.
		'no-restricted-syntax': [
			'error',
			{
				selector: "LogicalExpression[operator='||'][right.value=0][left.callee.name='parseInt']",
				message: 'parseInt(...) || 0 coerces garbage to 0. Keep raw-string state and validate with evaluateNumericField (UI-P6-2 / ES-17).',
			},
			// Three shapes, because the 49 C-2 sites used all three:
			// setTimeout(() => refetch(), 1000), setTimeout(() => qc.invalidateQueries(...), 1000)
			// and the bare-reference form setTimeout(refetchAll, 1000).
			{
				selector: "CallExpression[callee.name='setTimeout'] CallExpression[callee.name=/refetch|invalidate/i]",
				message: 'A timed blind refetch claims success before convergence and then looks exactly once. Reconcile instead: useReconcileReporter (UI-P6-3 / ES-02).',
			},
			{
				selector: "CallExpression[callee.name='setTimeout'] CallExpression[callee.property.name=/refetch|invalidate/i]",
				message: 'A timed blind refetch claims success before convergence and then looks exactly once. Reconcile instead: useReconcileReporter (UI-P6-3 / ES-02).',
			},
			{
				selector: "CallExpression[callee.name='setTimeout'] > Identifier[name=/refetch|invalidate/i]",
				message: 'A timed blind refetch claims success before convergence and then looks exactly once. Reconcile instead: useReconcileReporter (UI-P6-3 / ES-02).',
			},
		],
	},
	overrides: [
		{
			// Q-1 gate (owner: GS-cert campaign, 2026-09-01): the IPsec forms'
			// 7 sites convert with UI-P6-2's IPsec tranche once the certified
			// allowlist question is decided. Remove this exemption with that
			// conversion.
			files: ['src/components/input/IPsecTunnelInputForm.tsx', 'src/components/input/IPsecConfigForm.tsx'],
			rules: {'no-restricted-syntax': 'off'},
		},
		{
			// UI-P6-3 Tranche B (owner: GS-cert campaign, 2026-09-01): these 14
			// files hold the remaining 38 blind-refetch sites. Tranche A (the 5
			// certified-core pages, 11 sites) is converted; Tranche B is gated on
			// Q-1, the certified-allowlist question — pages ruled in convert with
			// the same recipe, pages ruled out get a deferral-log entry. Delete
			// each path from this list as its page converts; when the list is
			// empty, delete the override. The rule itself stays either way, so a
			// NEW blind refetch anywhere else is an error today.
			files: [
				'src/pages/ipsec/IPsecCertificatePage.tsx',
				'src/pages/ipsec/IPsecTunnelPage.tsx',
				'src/pages/network/BFDPage.tsx',
				'src/pages/network/DeviceNeighborPage.tsx',
				'src/pages/network/FDBPage.tsx',
				'src/pages/network/IPPage.tsx',
				'src/pages/network/RoutePage.tsx',
				'src/pages/network/VLANPage.tsx',
				'src/pages/traffic/FirewallPage.tsx',
				'src/pages/traffic/IPFilterPage.tsx',
				'src/pages/traffic/MirrorPage.tsx',
				'src/pages/traffic/QoSPage.tsx',
				'src/pages/traffic/SNICertificatesPage.tsx',
				'src/pages/traffic/SecurityRatePage.tsx',
			],
			rules: {'no-restricted-syntax': 'off'},
		},
	],
};
