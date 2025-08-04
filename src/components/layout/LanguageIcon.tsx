//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import {getFlagUrl} from 'common';
import LangSelMenu from 'components/menu/LangSelMenu';
import {support_lang} from 'locales/i18n';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

//---------------------------------------------------------
// Components
//---------------------------------------------------------
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

	return (
		<Box id="language" onClick={toggle_lang_sel} sx={{cursor: 'pointer'}} display="flex" alignItems="center">
			<LangSelMenu anchorEl={anchor_element_lang} handleClose={() => set_anchor_element_lang(null)} />
			<Box component="img" src={getFlagUrl(support_lang.find(item => item.code === currentLang)?.flag ?? 'en')} alt="flag" width="20px" height="20px" borderRadius="50%" />
		</Box>
	);
}
