//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button} from '@mui/material';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ButtonMenu(props: {show_edit?: boolean; selected_rows: any[]; set_is_open_dialog: (value: boolean) => void}) {
	const {show_edit, selected_rows, set_is_open_dialog} = props;

	return (
		<Box id="button-menu" display="flex" gap="10px">
			<Button variant="contained" disabled={selected_rows.length !== 0} onClick={() => set_is_open_dialog(true)}>
				{t('ADD')}
			</Button>

			{show_edit === true && (
				<Button variant="contained" color="secondary" disabled={selected_rows.length === 1}>
					{t('EDIT')}
				</Button>
			)}

			<Button variant="contained" color="secondary" disabled={selected_rows.length === 0}>
				{t('DELETE')}
			</Button>
		</Box>
	);
}
