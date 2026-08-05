//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import LanguageIcon_ from '@mui/icons-material/Language';
import {Box, Typography} from '@mui/material';
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
	const {i18n} = useTranslation();
	const [anchor_element_lang, set_anchor_element_lang] = useState<null | HTMLElement>(null);
	const [currentLang, setCurrentLang] = useState(i18n.language);

	const toggle_lang_sel = (event: any) => {
		if (anchor_element_lang) set_anchor_element_lang(null);
		else set_anchor_element_lang(event?.currentTarget);
	};

	useEffect(() => {
		document.documentElement.lang = i18n.language;
		setCurrentLang(i18n.language);
	}, [i18n]);

	const lang_name = support_lang.find(item => item.code === currentLang)?.name ?? 'English';

	return (
		<Box id="language" onClick={toggle_lang_sel} sx={{cursor: 'pointer'}} display="flex" alignItems="center" gap="4px">
			<LangSelMenu anchorEl={anchor_element_lang} handleClose={() => set_anchor_element_lang(null)} />
			<LanguageIcon_ sx={{color: 'white', fontSize: '18px'}} />
			<Typography variant="caption" color="white">
				{lang_name}
			</Typography>
			<ArrowDropDownIcon sx={{color: 'white'}} fontSize="small" />
		</Box>
	);
}
