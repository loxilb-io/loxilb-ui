//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Modal, Typography} from '@mui/material';
import {is_open_popup_atom} from 'atoms';
import {useRecoilState} from 'recoil';
import {useTranslation} from 'react-i18next';
import {useEffect} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function PopUp() {
	const [props, set_props] = useRecoilState(is_open_popup_atom);
	const {i18n} = useTranslation();

	// Force re-render when language changes to update popup content
	useEffect(() => {
		// This ensures the popup re-renders with new language
	}, [i18n.language]);

	// Flex column capped at 90vh so a form taller than the viewport scrolls
	// internally instead of pushing the title above / the action buttons below
	// the fold (they were unclickable at laptop heights — e.g. the IPsec tunnel
	// and LB dialogs at 1512×741). Title and footer stay fixed; body scrolls.
	const style = {
		position: 'absolute',
		top: '50%',
		left: '50%',
		transform: 'translate(-50%, -50%)',
		width: '500px',
		maxWidth: '90%',
		maxHeight: '90vh',
		display: 'flex',
		flexDirection: 'column',
		borderRadius: '4px',
		boxShadow: 24,
		padding: '16px 24px',
		bgcolor: 'background.paper',
	};

	const handleClose = () => {
		set_props({is_open: false, title: '', contents: '', yes: '', no: '', handle_yes: () => {}, handle_no: () => {}, disable_yes: false});
	};

	const handleYes = () => {
		handleClose();
		props.handle_yes();
	};

	const handleNo = () => {
		handleClose();
		props.handle_no();
	};

	return (
		<Modal open={props.is_open}>
			<Box sx={style}>
				{props.title && (
					<Typography variant="h6" component="h2" sx={{flexShrink: 0, mb: 2}}>
						{props.title}
					</Typography>
				)}

				{/* Scrollable body: minHeight:0 lets this flex child shrink below its
				    content height so overflow-y actually kicks in. */}
				<Box sx={{flex: '1 1 auto', minHeight: 0, overflowY: 'auto'}}>
					{typeof props.contents === 'string' ? (
						<Typography variant="body1" sx={{whiteSpace: 'pre-wrap'}}>
							{props.contents}
						</Typography>
					) : props.contents}
				</Box>

				<Box display="flex" justifyContent="flex-end" gap="8px" paddingTop="20px" sx={{flexShrink: 0}}>
					{props.no && (
						<Box width="90px">
							<Button fullWidth variant="contained" color="primary" onClick={handleNo}>
								{props.no}
							</Button>
						</Box>
					)}

					{props.yes && (
						<Box width="90px">
							<Button fullWidth variant="contained" color="secondary" onClick={handleYes} disabled={props.disable_yes}>
								{props.yes}
							</Button>
						</Box>
					)}
				</Box>
			</Box>
		</Modal>
	);
}
