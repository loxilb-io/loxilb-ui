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
		enableYes: (enable?: boolean) => set_props(prev => ({...prev, disable_yes: enable !== undefined ? !enable : false})),
	};
}
