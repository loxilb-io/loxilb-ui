//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Add, Edit} from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import MenuIcon from '@mui/icons-material/Menu';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import {Box, IconButton} from '@mui/material';
import {useTranslation} from 'react-i18next';

type ButtonType = 'delete' | 'modify' | 'delete_strong' | 'jump' | 'add' | 'edit' | 'menu';

// Icon-only buttons need an explicit accessible name (axe button-name).
const BUTTON_LABELS: Record<ButtonType, string> = {
	delete: 'Delete',
	modify: 'Settings',
	delete_strong: 'Delete permanently',
	jump: 'Open details',
	add: 'Add',
	edit: 'Edit',
	menu: 'Menu',
};

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SimpleButton(props: {type: ButtonType; onClick: () => void; disabled?: boolean}) {
	const {type, onClick, disabled} = props;
	const {t} = useTranslation();

	const handleClick = (e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation();
		onClick();
	};

	return (
		<Box display="flex" justifyContent="center">
			<IconButton size="small" aria-label={t(BUTTON_LABELS[type])} onClick={handleClick} disabled={disabled}>
				{type === 'delete' && <DeleteIcon fontSize="small" />}
				{type === 'modify' && <SettingsIcon fontSize="small" />}
				{type === 'delete_strong' && <DeleteForeverIcon fontSize="small" color="error" />}
				{type === 'jump' && <OpenInNewIcon fontSize="small" />}
				{type === 'add' && <Add fontSize="small" />}
				{type === 'edit' && <Edit fontSize="small" />}
				{type === 'menu' && <MenuIcon fontSize="small" />}
			</IconButton>
		</Box>
	);
}
