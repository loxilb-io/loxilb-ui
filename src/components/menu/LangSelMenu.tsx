//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Menu, MenuItem, Typography} from '@mui/material';
import {get_local_storage, save_local_storage} from 'common';
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
		save_local_storage('language', langCode);
		document.documentElement.lang = langCode;
		handleClose();

		navigate(0);
	};

	useEffect(() => {
		const saved_lang = get_local_storage('language');

		if (saved_lang && support_lang.some(lang => lang.code === saved_lang)) i18n.changeLanguage(saved_lang);
		else i18n.changeLanguage('en');
		document.documentElement.lang = i18n.language;
	}, [i18n]);

	return (
		<Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose} disableEnforceFocus disableAutoFocusItem>
			<Box id="name-box" padding="8px 16px 16px 16px" borderBottom={1} borderColor="grey.300" position="sticky" top={0}>
				<Typography variant="body1">{t('Select a language')}</Typography>
			</Box>

			<Box
				sx={{
					maxHeight: 'calc(500px - 60px)',
					overflow: 'auto',
					'& .MuiMenuItem-root:hover': {backgroundColor: 'action.hover'},
					'& .MuiMenuItem-root': {padding: '8px'},
				}}
				paddingTop="8px"
			>
				{support_lang.map((item, index) => (
					<MenuItem
						key={index}
						onClick={() => handleLanguageChange(item.code)}
						sx={{
							cursor: 'pointer',
							backgroundColor: i18n.language === item.code ? 'action.selected' : 'transparent',
						}}
					>
						<Box display="flex" gap="12px" alignItems="center" marginLeft="10px">
							<Typography variant="body2">{item.name}</Typography>
						</Box>
					</MenuItem>
				))}
			</Box>
		</Menu>
	);
}
