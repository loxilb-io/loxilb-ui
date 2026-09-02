//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {is_open_popup_atom} from 'atoms';
import {useRecoilState} from 'recoil';
import {useTranslation} from 'react-i18next';
import {PopupCloseReason} from 'types/global';

//---------------------------------------------------------
// Hooks
//---------------------------------------------------------
export function usePopUp() {
	const [_, set_props] = useRecoilState(is_open_popup_atom);
	const {t} = useTranslation();

	return {
		openPopUp: (
			title: string,
			contents: any,
			yes?: string,
			no?: string,
			handle_yes?: (() => void | Promise<void>) | undefined,
			disable_yes?: boolean,
			opts?: {persistent?: boolean; handle_no?: (reason: PopupCloseReason) => void},
		) => {
			set_props({
				is_open: true,
				title,
				contents,
				yes: yes ?? t('Yes'),
				no: no,
				handle_yes: handle_yes ?? (() => {}),
				handle_no: opts?.handle_no ?? (() => {}),
				disable_yes: disable_yes,
				// persistent is reserved for the API-key reveal and forced-relogin
				// flows; everything else stays Escape/backdrop-dismissible.
				persistent: opts?.persistent ?? false,
				busy: false,
			});
		},
		// Idempotent: if disable_yes is already the requested value, return the
		// SAME atom object so Recoil skips the re-render. A form's onChange→
		// enableYes on every render would otherwise churn this atom and re-render
		// the whole popup subtree, feeding a render loop.
		enableYes: (enable?: boolean) =>
			set_props(prev => {
				const next = enable !== undefined ? !enable : false;
				return prev.disable_yes === next ? prev : {...prev, disable_yes: next};
			}),
	};
}
