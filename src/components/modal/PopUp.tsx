//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Modal, Stack, Typography} from '@mui/material';
import {is_open_popup_atom} from 'atoms';
import {useRecoilState} from 'recoil';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function PopUp() {
	const [props, set_props] = useRecoilState(is_open_popup_atom);

	const style = {
		position: 'absolute',
		top: '50%',
		left: '50%',
		transform: 'translate(-50%, -50%)',
		width: '500px',
		maxWidth: '90%',
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
				<Stack spacing={2}>
					{props.title && (
						<Typography variant="h6" component="h2">
							{props.title}
						</Typography>
					)}

					{typeof props.contents === 'string' ? <Typography variant="body1">{props.contents}</Typography> : props.contents}

					<Box display="flex" justifyContent="flex-end" gap="8px" paddingTop="20px">
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
				</Stack>
			</Box>
		</Modal>
	);
}
