//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {is_logged_in} from 'common';
import {atom} from 'recoil';
import {IPopupState} from 'types/global';
import {ILicenseStatusResponse} from 'types/license';
import {ISetupState, ISetupWizardState} from 'types/setup';

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

// Setup & Onboarding Atoms
export const setup_state_atom = atom<ISetupState>({
	key: 'setup_state',
	default: {
		isFirstTime: false,
		currentStep: 0,
		completedSteps: [],
		adminConfigured: false,
		passwordPolicyEnforced: false,
		loxilbConnected: false,
		setupCompleted: false,
	},
});

export const setup_wizard_state_atom = atom<ISetupWizardState>({
	key: 'setup_wizard_state',
	default: {
		currentStep: 0,
		totalSteps: 6,
		canGoNext: false,
		canGoPrevious: false,
		isComplete: false,
		steps: [
			{id: 0, title: 'Welcome', description: 'Welcome to loxilb-ui', component: 'WelcomeStep', required: true, canSkip: false, order: 0},
			{id: 1, title: 'Admin Setup', description: 'Configure admin account', component: 'AdminSetupStep', required: true, canSkip: false, order: 1},
			{id: 2, title: 'Security', description: 'Security configuration', component: 'SecurityStep', required: true, canSkip: false, order: 2},
			{id: 3, title: 'LoxiLB Connection', description: 'Configure loxilb connection', component: 'LoxilbConnectionStep', required: false, canSkip: true, order: 3},
			{id: 4, title: 'Initial Config', description: 'Basic configuration', component: 'InitialConfigStep', required: false, canSkip: true, order: 4},
			{id: 5, title: 'Completion', description: 'Setup completion', component: 'CompletionStep', required: true, canSkip: false, order: 5},
		],
	},
});

export const setup_loading_atom = atom<boolean>({
	key: 'setup_loading',
	default: false,
});
