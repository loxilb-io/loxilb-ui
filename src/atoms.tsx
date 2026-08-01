//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {atom} from 'recoil';
import {IPopupState} from 'types/global';

//---------------------------------------------------------
// Atoms
//---------------------------------------------------------
export const is_open_popup_atom = atom<IPopupState>({
	key: 'is_open_popup',
	default: {is_open: false, title: '', contents: '', yes: '', no: '', handle_yes: () => {}, handle_no: () => {}, disable_yes: false},
});

export const menu_states_atom = atom({
	key: 'menu_states',
	default: {},
});
