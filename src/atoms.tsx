//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {is_logged_in} from 'common';
import {atom} from 'recoil';
import {IPopupState} from 'types/global';
import {ILicenseStatusResponse} from 'types/license';

//---------------------------------------------------------
// Atoms
//---------------------------------------------------------
export const is_logged_in_atom = atom({
	key: 'is_logged_in',
	default: is_logged_in(),
});

export const is_open_popup_atom = atom<IPopupState>({
	key: 'is_open_popup',
	default: {is_open: false, title: '', contents: '', yes: '', no: '', handle_yes: () => {}, handle_no: () => {}, disable_yes: false},
});

export const menu_states_atom = atom({
	key: 'menu_states',
	default: {},
});

export const license_status_atom = atom<ILicenseStatusResponse | null>({
	key: 'license_status',
	default: null,
});

export const feature_access_cache_atom = atom<Record<string, boolean>>({
	key: 'feature_access_cache',
	default: {},
});

export const license_loading_atom = atom<boolean>({
	key: 'license_loading',
	default: false,
});
