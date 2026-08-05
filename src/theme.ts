import {ThemeOptions} from '@mui/material';

//---------------------------------------------------------
// Design tokens
//---------------------------------------------------------
// Font files are self-hosted npm packages, loaded once in index.tsx.
// Pretendard covers the `ko` locale glyphs Inter lacks; both are variable
// fonts so every weight ships in one file.
export const FONT_SANS = `'Inter Variable', 'Pretendard Variable', 'Roboto', 'Helvetica', 'Arial', sans-serif`;
// For IPs, MACs, CIDRs, IDs and counters — anywhere digit alignment matters.
export const FONT_MONO = `'JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Consolas', monospace`;

//---------------------------------------------------------
// Theme
//---------------------------------------------------------
export const theme_config: ThemeOptions = {
	shape: {
		borderRadius: 10,
	},

	palette: {
		mode: 'light',
		// The two brand hexes (navy/orange main) are fixed by product decision —
		// never tune them; the light/dark entries are hover/active derivatives.
		primary: {
			main: '#113351',
			light: '#164E77',
			dark: '#0B2032',
		},
		secondary: {
			main: '#D27B24',
			light: '#DD932C',
			dark: '#BF591D',
		},
		// Semantic status colors, AA-compliant as text on white.
		success: {main: '#1E8E3E'},
		warning: {main: '#B26A00'},
		error: {main: '#C62828'},
		info: {main: '#0E6BA8'},
		background: {
			default: '#F6F8FA',
			paper: '#FFFFFF',
		},
		divider: '#E4E9EF',
		text: {
			primary: '#1B2733',
			secondary: '#5A6B7D',
		},
	},

	typography: {
		fontFamily: FONT_SANS,
		h1: {
			fontWeight: 300,
		},
		h4: {
			fontWeight: 600,
			// Metric hero numbers must not jitter as digits change.
			fontVariantNumeric: 'tabular-nums',
		},
		h5: {
			fontWeight: 600,
		},
		h6: {
			fontWeight: 600,
		},
		subtitle1: {
			fontWeight: 600,
		},
		subtitle2: {
			fontWeight: 600,
		},
		body1: {
			lineHeight: '150%',
		},
		body2: {
			lineHeight: '150%',
		},
		button: {
			fontWeight: 600,
			textTransform: 'none',
		},
	},

	components: {
		MuiCssBaseline: {
			styleOverrides: {
				a: {textDecorationLine: 'none'},
				'code, kbd, pre, samp': {fontFamily: FONT_MONO},
			},
		},
		MuiButton: {
			styleOverrides: {
				root: {
					cursor: 'pointer',
					userSelect: 'none',
					minWidth: 0,
					borderRadius: 8,
				},
			},
			defaultProps: {
				disableElevation: true,
			},
		},
		MuiTab: {
			styleOverrides: {
				root: {
					textTransform: 'none',
					fontWeight: 500,
				},
			},
		},
		MuiPaper: {
			styleOverrides: {
				rounded: {borderRadius: 12},
			},
		},
		MuiChip: {
			styleOverrides: {
				root: {fontWeight: 500},
			},
		},
		MuiTooltip: {
			styleOverrides: {
				tooltip: {fontSize: '0.75rem'},
			},
		},
	},
};

// Categorical chart palette harmonized with the brand: steel navy leads
// (primary series), brand orange second, then muted green/violet/red that
// stay distinguishable next to each other on white cards.
export const chart_color = ['#1F5C8B', '#D27B24', '#2E8B6E', '#7A5FA5', '#B0455A'];
