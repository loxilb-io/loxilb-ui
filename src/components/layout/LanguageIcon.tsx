//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import LanguageIcon_ from '@mui/icons-material/Language';
import {Button, Typography} from '@mui/material';
import LangSelMenu from 'components/menu/LangSelMenu';
import {support_lang} from 'locales/i18n';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

//---------------------------------------------------------
// Components
//---------------------------------------------------------
// Text trigger, not a flag: flags identify countries, not languages
// (i18n antipattern), and the label doubles as the current-state readout.
export default function LanguageIcon() {
	const {t, i18n} = useTranslation();
	const [anchor_element_lang, set_anchor_element_lang] = useState<null | HTMLElement>(null);
	const [currentLang, setCurrentLang] = useState(i18n.language);

	const toggle_lang_sel = (event: React.MouseEvent<HTMLElement>) => {
		if (anchor_element_lang) set_anchor_element_lang(null);
		else set_anchor_element_lang(event.currentTarget);
	};

	useEffect(() => {
		document.documentElement.lang = i18n.language;
		setCurrentLang(i18n.language);
	}, [i18n]);

	const lang_name = support_lang.find(item => item.code === currentLang)?.name ?? 'English';

	return (
		<>
			<LangSelMenu anchorEl={anchor_element_lang} handleClose={() => set_anchor_element_lang(null)} />
			{/* A real button: focusable, Enter/Space-activatable, with menu
			    semantics for screen readers — the Box it replaces was none of
			    those, leaving keyboard users unable to change language. */}
			<Button
				id="language"
				onClick={toggle_lang_sel}
				aria-haspopup="menu"
				aria-expanded={Boolean(anchor_element_lang)}
				aria-label={t('Select a language')}
				startIcon={<LanguageIcon_ sx={{color: 'white', fontSize: '18px'}} />}
				endIcon={<ArrowDropDownIcon sx={{color: 'white'}} fontSize="small" />}
				sx={{color: 'white', textTransform: 'none', minWidth: 0, padding: '4px 8px'}}
			>
				<Typography variant="caption" color="white">
					{lang_name}
				</Typography>
			</Button>
		</>
	);
}
