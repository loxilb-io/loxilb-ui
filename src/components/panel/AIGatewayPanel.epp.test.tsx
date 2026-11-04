//---------------------------------------------------------
// Endpoint Picker read-back on the LB rule's AI Gateway tab.
//
// Pins: a rule whose only AI setting is a picker is not reported as having no
// AI features, omitted values read as what the gateway resolves them to, and a
// rule without a picker shows no block even if the inert fields are present.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IServiceArguments} from 'types/load_balancer';
import AIGatewayPanel from './AIGatewayPanel';

vi.mock('components/panel/KvExactStatusPanel', () => ({default: () => null}));

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp', mode: 4, ...over} as IServiceArguments;
}

function valueOf(label: string): string | null | undefined {
	return screen.getByText(label, {exact: true}).closest('.MuiStack-root')?.querySelector('.MuiTypography-body2')?.textContent;
}

afterEach(cleanup);

describe('AIGatewayPanel Endpoint Picker read-back', () => {
	it('shows a picker on a rule with no other AI setting', () => {
		render(<AIGatewayPanel serviceArguments={args({eppEndpoint: 'picker.example:9002', eppFailureMode: 'FailOpen', eppTimeoutMs: 1500, eppPlaintext: true})} />);

		expect(screen.queryByText('No AI Gateway features are configured for this rule.')).toBeNull();
		expect(valueOf('EPP Endpoint')).toBe('picker.example:9002');
		expect(valueOf('EPP Failure Mode')).toBe('FailOpen');
		expect(valueOf('EPP Decision Timeout (ms)')).toBe('1500');
		expect(valueOf('EPP Connection')).toBe('Plaintext');
	});

	it('reads omitted values as what the gateway resolves them to', () => {
		render(<AIGatewayPanel serviceArguments={args({eppEndpoint: 'picker.example:9002'})} />);

		expect(valueOf('EPP Failure Mode')).toBe('FailClose');
		expect(valueOf('EPP Decision Timeout (ms)')).toBe('3000');
		expect(valueOf('EPP Connection')).toBe('TLS (certificate not verified)');
	});

	it('shows no block when no picker is declared, even with the inert fields set', () => {
		render(<AIGatewayPanel serviceArguments={args({sse_mode: true, eppFailureMode: 'FailOpen', eppTimeoutMs: 1500})} />);

		expect(screen.queryByText('Endpoint Picker (EPP)')).toBeNull();
		expect(screen.queryByText('EPP Failure Mode')).toBeNull();
	});
});
