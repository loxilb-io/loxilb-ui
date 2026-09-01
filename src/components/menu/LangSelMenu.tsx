//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Menu, MenuItem, Typography} from '@mui/material';
import {get_local_storage, save_local_storage} from 'common';
import {PREFERENCE_KEYS} from 'preferences';
import {t} from 'i18next';
import {support_lang} from 'locales/i18n';
import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LangSelMenu(props: {anchorEl: HTMLElement | null; handleClose: () => void}) {
	const {anchorEl, handleClose} = props;

	const {i18n} = useTranslation();
	const navigate = useNavigate();

	const handleLanguageChange = (langCode: string) => {
		i18n.changeLanguage(langCode);
		save_local_storage(PREFERENCE_KEYS.language, langCode);
		document.documentElement.lang = langCode;
		handleClose();

		navigate(0);
	};

	useEffect(() => {
		const saved_lang = get_local_storage(PREFERENCE_KEYS.language);

		if (saved_lang && support_lang.some(lang => lang.code === saved_lang)) i18n.changeLanguage(saved_lang);
		else i18n.changeLanguage('en');
		document.documentElement.lang = i18n.language;
	}, [i18n]);

	// No disableEnforceFocus/disableAutoFocusItem on the Menu: MUI's default
	// focus management provides arrow-key navigation, Escape-close and focus
	// return — the props existed to mask the old non-focusable trigger.
	// The MenuItems must stay DIRECT children of the Menu: MenuList's
	// arrow-key traversal walks sibling elements, so wrapping the items in a
	// scroll Box (as this once did) silently breaks keyboard navigation.
	// Scrolling lives on the paper slot instead.
	return (
		<Menu
			anchorEl={anchorEl}
			open={!!anchorEl}
			onClose={handleClose}
			slotProps={{paper: {sx: {maxHeight: '500px'}}}}
			sx={{
				'& .MuiMenuItem-root:hover': {backgroundColor: 'action.hover'},
				'& .MuiMenuItem-root': {padding: '8px'},
			}}
		>
			<Box id="name-box" padding="8px 16px 16px 16px" borderBottom={1} borderColor="grey.300">
				<Typography variant="body1">{t('Select a language')}</Typography>
			</Box>

			{support_lang.map((item, index) => (
				<MenuItem
					key={index}
					onClick={() => handleLanguageChange(item.code)}
					selected={i18n.language === item.code}
					sx={{cursor: 'pointer'}}
				>
					<Box display="flex" gap="12px" alignItems="center" marginLeft="10px">
						<Typography variant="body2">{item.name}</Typography>
					</Box>
				</MenuItem>
			))}
		</Menu>
	);
}
