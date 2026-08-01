//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {is_open_popup_atom} from 'atoms';
import {useRecoilState} from 'recoil';

//---------------------------------------------------------
// Hooks
//---------------------------------------------------------
export function usePopUp() {
	const [_, set_props] = useRecoilState(is_open_popup_atom);

	return {
		openPopUp: (title: string, contents: any, yes?: string, no?: string, handle_yes?: (() => void) | undefined, disable_yes?: boolean) => {
			set_props({
				is_open: true,
				title,
				contents,
				yes: yes ?? 'Yes',
				no: no,
				handle_yes: handle_yes ?? (() => {}),
				handle_no: () => {},
				disable_yes: disable_yes,
			});
		},
		// Idempotent: if disable_yes is already the requested value, return the
		// SAME atom object so Recoil skips the re-render. A form's onChange→
		// enableYes on every render would otherwise churn this atom and re-render
		// the whole popup subtree, feeding a render loop (F14).
		enableYes: (enable?: boolean) =>
			set_props(prev => {
				const next = enable !== undefined ? !enable : false;
				return prev.disable_yes === next ? prev : {...prev, disable_yes: next};
			}),
	};
}
