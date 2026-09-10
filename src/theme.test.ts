//---------------------------------------------------------
// Contrast pins for the design tokens in theme.ts.
//
// jsdom cannot run axe's color-contrast rule (no layout engine) and the
// route-level Playwright pass only sees the color combinations that
// happen to be on screen. This file checks the palette arithmetically
// instead, so a retuned hex fails here — in the unit lane, on every PR —
// rather than months later on whichever page first paints it as text.
//
// Ratios follow WCAG 2.1 SC 1.4.3 / 1.4.11. The formula is reimplemented
// from the spec rather than imported: it is six lines, and a token file
// should not gain a runtime dependency to be checked.
//---------------------------------------------------------
import {createTheme} from '@mui/material';
import {describe, expect, it} from 'vitest';
import {chart_color, theme_config} from './theme';

const AA_NORMAL_TEXT = 4.5; // < 24px, or < 19px bold
const AA_LARGE_TEXT = 3; // also the floor for icons/borders (SC 1.4.11)

function channel(value: number): number {
	const c = value / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
	// MUI hands back shorthand for the colors it derives itself (`#fff`),
	// while the tokens in theme.ts are written full-length.
	const raw = hex.replace('#', '');
	expect(raw, `${hex} must be a 3- or 6-digit hex`).toMatch(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
	const h = raw.length === 3 ? [...raw].map(c => c + c).join('') : raw;
	const [r, g, b] = [0, 2, 4].map(i => channel(parseInt(h.slice(i, i + 2), 16)));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

// Resolved exactly as App.tsx resolves it. Reading the raw `theme_config`
// would miss everything MUI derives — above all `contrastText`, which is
// computed from `main` and is what filled buttons and chips actually paint.
const palette = createTheme(theme_config).palette as any;

const BRAND_TOKENS = ['primary', 'secondary'];
const STATUS_TOKENS = ['success', 'warning', 'error', 'info'];

// Every surface the app paints text onto. `background.default` is the
// darker of the two, so a token that clears it clears paper as well —
// both are asserted anyway, because a future surface may be added.
const SURFACES: Record<string, string> = {
	'background.paper': palette.background.paper,
	'background.default': palette.background.default,
};

describe('palette contrast', () => {
	it('sanity-checks the ratio formula against the WCAG reference points', () => {
		expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
		expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
		// Order must not matter.
		expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
	});

	// These are used as body2/caption text: log levels in the grid, outlined
	// button and chip labels, inline form warnings. Normal-size threshold.
	describe.each(STATUS_TOKENS)('%s.main as normal-size text', token => {
		it.each(Object.entries(SURFACES))('clears AA on %s', (_name, surface) => {
			expect(contrastRatio(palette[token].main, surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
		});
	});

	describe.each(['primary', 'text'])('%s foreground as normal-size text', token => {
		const value = token === 'text' ? palette.text.secondary : palette.primary.main;
		it.each(Object.entries(SURFACES))('clears AA on %s', (_name, surface) => {
			expect(contrastRatio(value, surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
		});
	});

	// The brand orange is fixed by product decision and reaches only 3.18:1 on
	// paper — and 2.99:1 on the grayer app background, i.e. under even the
	// non-text floor. Both bounds are pinned deliberately: the first so nobody
	// assumes the token is safe for body text, the second so nobody paints an
	// orange icon or 1px rule straight onto `background.default`. A future
	// brand refresh that lifts the hex should delete these, not loosen them.
	it('pins where brand secondary.main may and may not be used', () => {
		expect(contrastRatio(palette.secondary.main, palette.background.paper)).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
		expect(contrastRatio(palette.secondary.main, palette.background.paper)).toBeLessThan(AA_NORMAL_TEXT);
		expect(contrastRatio(palette.secondary.main, palette.background.default)).toBeLessThan(AA_LARGE_TEXT);
	});

	// The escape hatch the theme's MuiButton variants (and any future caller)
	// use wherever the brand accent has to be normal-size text.
	it('offers secondary.dark as the normal-size-text escape hatch', () => {
		for (const surface of Object.values(SURFACES)) {
			expect(contrastRatio(palette.secondary.dark, surface)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
		}
	});

	// A label has to clear AA in every state, not just at rest, and axe never
	// hovers. MUI drives a contained button's hover toward `dark`; for the
	// brand token that would darken the fill under an already-dark label, so
	// theme.ts overrides it to `light`. Both ends are pinned here.
	it('keeps the brand label readable across the contained button hover', () => {
		const {contrastText, main, light, dark} = palette.secondary;
		expect(contrastRatio(contrastText, main)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
		expect(contrastRatio(contrastText, light)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
		// The reason the override exists. If this ever passes, the override in
		// theme.ts is dead weight and should go.
		expect(contrastRatio(contrastText, dark)).toBeLessThan(AA_NORMAL_TEXT);
	});

	// What filled buttons and filled chips actually paint. Checking the
	// resolved `contrastText` rather than assuming white is the point: MUI
	// derives it at a 3:1 threshold, which is below AA, so a token sitting in
	// the 3–4.5 band gets a label that passes MUI's check and fails WCAG's.
	describe.each([...BRAND_TOKENS, ...STATUS_TOKENS])('%s filled surface', token => {
		it('paints a label that clears AA on it', () => {
			const {main, contrastText} = palette[token];
			expect(contrastRatio(contrastText, main), `${token} ${contrastText} on ${main}`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
		});
	});

	// Non-text contrast: the focus ring is primary.light, and it has to be
	// visible on both surfaces (SC 1.4.11).
	it('keeps the focus ring visible on every surface', () => {
		for (const surface of Object.values(SURFACES)) {
			expect(contrastRatio(palette.primary.light, surface)).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
		}
	});

	// Chart series are fills and strokes, not text.
	it('keeps every chart series distinguishable from the card it is drawn on', () => {
		for (const color of chart_color) {
			expect(contrastRatio(color, palette.background.paper), color).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
		}
	});
});
