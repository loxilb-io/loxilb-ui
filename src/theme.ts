import {ThemeOptions} from '@mui/material';

export const theme_config: ThemeOptions = {
	components: {
		MuiInputLabel: {
			styleOverrides: {
				root: {
					color: '#000000',
				},
			},
		},
		MuiButton: {
			styleOverrides: {
				root: {
					cursor: 'pointer',
					userSelect: 'none',
					minWidth: 0,
				},
			},
			defaultProps: {
				disableElevation: true,
			},
		},
		MuiTab: {
			styleOverrides: {
				root: {
					'&.MuiTab-root': {
						textTransform: 'capitalize',
						textColor: 'secondary',
						indicatorColor: 'secondary',
					},
				},
			},
		},
	},
	typography: {
		allVariants: {
			fontFamily: `"Roboto", sans-serif`,
		},
		h1: {
			fontWeight: 300,
		},
		h5: {
			fontWeight: 500,
		},
		h6: {
			fontWeight: 500,
		},
		subtitle2: {
			fontWeight: 500,
		},
		body1: {
			lineHeight: '140%',
		},
		body2: {
			lineHeight: '140%',
		},
		button: {
			fontWeight: 500,
		},
	},

	palette: {
		mode: 'light',
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
	},
};

export const chart_color = ['#6A89CC', '#82CA9D', '#FFC658', '#E85D04', '#9B59B6'];
