//---------------------------------------------------------
// Circuit-breaker read-back on the rule detail.
//
// GET reports the resolved state and omits the field when the breaker is off,
// so "absent" on a fullproxy rule is a positive "Disabled" — never blank, and
// never the P/D create default.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IServiceArguments} from 'types/load_balancer';
import SettingsPanel from './SettingPanel';

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.10', inactiveTimeOut: 0, port: 8000, protocol: 'tcp', mode: 4, ...over};
}

// SingleTextBox is a caption over a value, not a labelled control.
const breakerValue = () => screen.queryByText('Circuit Breaker')?.closest('.MuiStack-root')?.querySelector('.MuiTypography-body2')?.textContent;

afterEach(cleanup);

describe('circuit-breaker read-back', () => {
	it('reports Enabled only when the gateway returned it on', () => {
		render(<SettingsPanel serviceArguments={args({cb_enable: true})} />);
		expect(breakerValue()).toBe('Enabled');
	});

	it('reports Disabled for a P/D rule read back without the field', () => {
		render(<SettingsPanel serviceArguments={args({pd_disagg_mode: true})} />);
		expect(breakerValue()).toBe('Disabled');
	});

	it('is absent on a rule that is not fullproxy', () => {
		render(<SettingsPanel serviceArguments={args({mode: 0, cb_enable: true})} />);
		expect(screen.queryByText('Circuit Breaker')).toBeNull();
	});
});
