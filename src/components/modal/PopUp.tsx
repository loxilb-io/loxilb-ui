//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, CircularProgress, Dialog, Typography} from '@mui/material';
import {is_open_popup_atom} from 'atoms';
import {useRecoilState} from 'recoil';
import {useTranslation} from 'react-i18next';
import {useEffect} from 'react';
import {PopupCloseReason} from 'types/global';

//---------------------------------------------------------
// Constants
//---------------------------------------------------------
const TITLE_ID = 'app-dialog-title';
const BODY_ID = 'app-dialog-body';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function PopUp() {
	const [props, set_props] = useRecoilState(is_open_popup_atom);
	const {t, i18n} = useTranslation();

	// Force re-render when language changes to update popup content
	useEffect(() => {
		// This ensures the popup re-renders with new language
	}, [i18n.language]);

	// Flex column capped at 90vh so a form taller than the viewport scrolls
	// internally instead of pushing the title above / the action buttons below
	// the fold (they were unclickable at laptop heights — e.g. the IPsec tunnel
	// and LB dialogs at 1512×741). Title and footer stay fixed; body scrolls.
	const style = {
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
		set_props({is_open: false, title: '', contents: '', yes: '', no: '', handle_yes: () => {}, handle_no: () => {}, disable_yes: false, persistent: false, busy: false});
	};

	// Every non-Yes dismissal funnels through here so handle_no fires exactly
	// once with the reason, and busy/persistent gating lives in one place.
	const finish = (reason: PopupCloseReason) => {
		if (props.busy) return; // never dismissible mid-mutation
		if (props.persistent && reason !== 'yes' && reason !== 'no') return;
		const handle_no = props.handle_no;
		handleClose();
		if (reason !== 'yes') handle_no(reason);
	};

	// The dialog stays up (buttons disabled, Escape inert) until the action
	// settles — closing first let users re-open and re-submit a mutation that
	// was still running.
	const handleYes = async () => {
		if (props.busy) return;
		set_props(p => ({...p, busy: true}));
		try {
			await props.handle_yes();
		} catch (err) {
			// eslint-disable-next-line no-console -- deliberate operator-visible log on a failure/edge path; listed in the expected-console-message catalogue
			console.error('Dialog action failed:', err);
		} finally {
			// Only close if the atom still holds OUR busy dialog. A handle_yes
			// that opened a follow-up popup (openPopUp resets busy to false —
			// e.g. the one-time API-key reveal, Success confirmations) must not
			// have it torn down from under the user.
			set_props(p => (p.busy ? {is_open: false, title: '', contents: '', yes: '', no: '', handle_yes: () => {}, handle_no: () => {}, disable_yes: false, persistent: false, busy: false} : p));
		}
	};

	return (
		<Dialog
			open={props.is_open}
			onClose={(_, reason) => finish(reason === 'backdropClick' ? 'backdrop' : 'escape')}
			maxWidth={false}
			aria-labelledby={props.title ? TITLE_ID : undefined}
			aria-describedby={BODY_ID}
			slotProps={{paper: {sx: style}}}>
			{props.title && (
				<Typography id={TITLE_ID} variant="h6" component="h2" sx={{flexShrink: 0, mb: 2}}>
					{props.title}
				</Typography>
			)}

			{/* Scrollable body: minHeight:0 lets this flex child shrink below its
			    content height so overflow-y actually kicks in. */}
			<Box id={BODY_ID} sx={{flex: '1 1 auto', minHeight: 0, overflowY: 'auto'}}>
				{typeof props.contents === 'string' ? (
					<Typography variant="body1" sx={{whiteSpace: 'pre-wrap'}}>
						{props.contents}
					</Typography>
				) : (
					props.contents
				)}
			</Box>

			<Box display="flex" justifyContent="flex-end" gap="8px" paddingTop="20px" sx={{flexShrink: 0}}>
				{props.no && (
					<Box width="90px">
						{/* eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: WAI-ARIA dialogs move focus inside on open; the safe (Cancel) action takes it */}
						<Button fullWidth autoFocus variant="contained" color="primary" onClick={() => finish('no')} disabled={props.busy}>
							{props.no}
						</Button>
					</Box>
				)}

				{props.yes && (
					<Box width="90px">
						{/* eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: info dialogs have OK as the only action; focus lands there per the dialog pattern */}
						<Button fullWidth autoFocus={!props.no} variant="contained" color="secondary" onClick={handleYes} disabled={props.disable_yes || props.busy}>
							{props.busy ? <CircularProgress size={18} color="inherit" aria-label={t('Loading...')} /> : props.yes}
						</Button>
					</Box>
				)}
			</Box>
		</Dialog>
	);
}
