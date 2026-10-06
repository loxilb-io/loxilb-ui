//---------------------------------------------------------
// Half-close and sockmap read-back on the rule detail.
//
// The gateway resolves the half-close mode from the rule, the process default
// and a process-wide block, and reports the result with its source. The mode
// alone would not say why a rule is not holding, so the detail shows both —
// and the gateway's own reason when its default could not reach the rule.
// The sockmap mode is the declared one. Neither gets a row unless reported.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IServiceArguments} from 'types/load_balancer';
import SettingsPanel, {halfCloseReadBack, sockMapReadBack} from './SettingPanel';

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.10', inactiveTimeOut: 0, port: 8000, protocol: 'tcp', mode: 4, ...over};
}

// SingleTextBox is a caption over a value, not a labelled control.
const valueOf = (label: string) => screen.queryByText(label)?.closest('.MuiStack-root')?.querySelector('.MuiTypography-body2')?.textContent;

const PD_REASON = 'not available on a P/D (pd_disagg_mode) service yet';

afterEach(cleanup);

describe('half-close read-back', () => {
	it('names the mode in force and who decided it', () => {
		expect(halfCloseReadBack({mode: 'hold', source: 'rule'})).toBe('Hold (set on the rule)');
		expect(halfCloseReadBack({mode: 'off', source: 'rule'})).toBe('Off (set on the rule)');
		expect(halfCloseReadBack({mode: 'hold', source: 'default'})).toBe('Hold (gateway default)');
		expect(halfCloseReadBack({mode: 'off', source: 'default'})).toBe('Off (gateway default)');
		expect(halfCloseReadBack({mode: 'off', source: 'blocked'})).toBe('Off (holds are blocked on this gateway)');
	});

	it("gives the gateway's reason when its default does not reach the rule", () => {
		expect(halfCloseReadBack({mode: 'off', source: 'default', not_applied: PD_REASON})).toBe(`Off (gateway default not applied: ${PD_REASON})`);
	});

	it('passes through a mode or source it does not know instead of guessing', () => {
		expect(halfCloseReadBack({mode: 'hold+parked' as 'hold', source: 'rule'})).toBe('hold+parked (set on the rule)');
		expect(halfCloseReadBack({mode: 'hold', source: 'operator' as 'rule'})).toBe('Hold (operator)');
		expect(halfCloseReadBack({mode: 'hold'})).toBe('Hold');
	});

	it('is nothing when the gateway reported nothing', () => {
		expect(halfCloseReadBack(undefined)).toBeUndefined();
		expect(halfCloseReadBack({})).toBeUndefined();
	});

	it('shows on a fullproxy rule', () => {
		render(<SettingsPanel serviceArguments={args({half_close_effective: {mode: 'off', source: 'default', not_applied: PD_REASON}})} />);
		expect(valueOf('Half-Close')).toBe(`Off (gateway default not applied: ${PD_REASON})`);
	});

	it('has no row when not reported, and none off fullproxy', () => {
		render(<SettingsPanel serviceArguments={args()} />);
		expect(screen.queryByText('Half-Close')).toBeNull();
		cleanup();

		render(<SettingsPanel serviceArguments={args({mode: 0, half_close_effective: {mode: 'hold', source: 'default'}})} />);
		expect(screen.queryByText('Half-Close')).toBeNull();
	});
});

describe('sockmap mode read-back', () => {
	it('names each declared mode', () => {
		expect(sockMapReadBack('off')).toBe('Off');
		expect(sockMapReadBack('both')).toBe('Both directions');
		expect(sockMapReadBack('request')).toBe('Request only (client to backend)');
		expect(sockMapReadBack('response')).toBe('Response only (backend to client)');
	});

	it('shows an unknown mode as sent, and nothing when absent', () => {
		expect(sockMapReadBack('duplex' as 'both')).toBe('duplex');
		expect(sockMapReadBack(undefined)).toBeUndefined();
	});

	it('shows on a fullproxy rule, an explicit off included', () => {
		render(<SettingsPanel serviceArguments={args({sockMapMode: 'off'})} />);
		expect(valueOf('Sockmap Mode')).toBe('Off');
		cleanup();

		render(<SettingsPanel serviceArguments={args({sockMapMode: 'response'})} />);
		expect(valueOf('Sockmap Mode')).toBe('Response only (backend to client)');
	});

	it('has no row when not reported, and none off fullproxy', () => {
		render(<SettingsPanel serviceArguments={args()} />);
		expect(screen.queryByText('Sockmap Mode')).toBeNull();
		cleanup();

		render(<SettingsPanel serviceArguments={args({mode: 0, sockMapMode: 'both'})} />);
		expect(screen.queryByText('Sockmap Mode')).toBeNull();
	});
});
