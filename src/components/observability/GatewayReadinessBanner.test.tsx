//---------------------------------------------------------
// Gateway readiness banner — silent unless the gateway said so
//---------------------------------------------------------
// The banner sits above every dashboard card, so a false alarm is read
// first. What these pin:
//   - nothing on a healthy gateway, an unread read, or an older gateway;
//   - the gateway's own reasons, not a paraphrase;
//   - a verdict kept from before a failing refresh still shows, with its age.

import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import GatewayReadinessBanner from './GatewayReadinessBanner';

const state = vi.hoisted(() => ({
	diagnostics: undefined as unknown,
	error: null as unknown,
	calls: [] as Array<{instanceId: unknown; active: boolean}>,
}));

vi.mock('hooks/query/gatewayTelemetryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/gatewayTelemetryHooks')>();
	return {
		...mod,
		useDiagnostics: (instance: {id?: unknown} | null, active: boolean) => {
			state.calls.push({instanceId: instance?.id, active});
			return {data: state.diagnostics, isLoading: false, error: state.error, refetch: () => undefined};
		},
	};
});

const INSTANCE = {id: 5, name: 'gw'} as never;
const read = (data: Record<string, unknown>) => ({data, receivedAtMs: Date.now()});
const banner = () => screen.queryByTestId('gateway-readiness');

afterEach(() => {
	cleanup();
	state.diagnostics = undefined;
	state.error = null;
	state.calls = [];
});

describe('GatewayReadinessBanner', () => {
	it('renders nothing for a ready gateway in normal operation', () => {
		state.diagnostics = read({ready: true, ready_reasons: [], maintenance_state: 'active'});
		render(<GatewayReadinessBanner instance={INSTANCE} active />);
		expect(banner()).toBeNull();
	});

	it('renders nothing before the first read and for a gateway without the fields', () => {
		render(<GatewayReadinessBanner instance={INSTANCE} active />);
		expect(banner()).toBeNull();
		cleanup();
		state.diagnostics = read({version: '0.9.8'});
		render(<GatewayReadinessBanner instance={INSTANCE} active />);
		expect(banner()).toBeNull();
	});

	it('shows the gateway reasons as written when it is not ready', () => {
		state.diagnostics = read({
			ready: false,
			ready_reasons: ['boot config replay has not settled', 'dependency etcd: context deadline exceeded'],
			maintenance_state: 'active',
		});
		render(<GatewayReadinessBanner instance={INSTANCE} active />);
		const alerts = screen.getAllByRole('alert');
		expect(alerts).toHaveLength(1);
		expect(alerts[0].textContent).toContain('This gateway reports it is not ready: boot config replay has not settled; dependency etcd: context deadline exceeded');
		expect(alerts[0].textContent).not.toContain('maintenance');
	});

	it('says so when the gateway gave no reason, and counts what it does not list', () => {
		state.diagnostics = read({ready: false});
		render(<GatewayReadinessBanner instance={INSTANCE} active />);
		expect(screen.getByRole('alert').textContent).toContain('This gateway reports it is not ready and gave no reason.');
		cleanup();
		state.diagnostics = read({ready: false, ready_reasons: ['a', 'b', 'c', 'd', 'e']});
		render(<GatewayReadinessBanner instance={INSTANCE} active />);
		const text = screen.getByRole('alert').textContent ?? '';
		expect(text).toContain('not ready: a; b; c');
		expect(text).not.toContain('; d');
		expect(text).toContain('(2 more in the gateway diagnostics)');
	});

	it('shows maintenance on a gateway that is otherwise ready', () => {
		state.diagnostics = read({ready: true, maintenance_state: 'maintenance'});
		render(<GatewayReadinessBanner instance={INSTANCE} active />);
		const alerts = screen.getAllByRole('alert');
		expect(alerts).toHaveLength(1);
		expect(alerts[0].textContent).toContain('This gateway is in maintenance.');
		expect(alerts[0].textContent).not.toContain('not ready');
	});

	it('shows both lines when both hold', () => {
		state.diagnostics = read({ready: false, ready_reasons: ['boot snapshot restore failed; recover via POST /config/restore'], maintenance_state: 'maintenance'});
		render(<GatewayReadinessBanner instance={INSTANCE} active />);
		expect(screen.getAllByRole('alert')).toHaveLength(2);
	});

	it('⭐ keeps a verdict through a failing refresh and shows how old it is', () => {
		// react-query hands back the last answer together with the error.
		state.diagnostics = {data: {ready: false, ready_reasons: ['boot config replay has not settled']}, receivedAtMs: Date.now() - 10 * 60_000};
		state.error = new Error('502');
		render(<GatewayReadinessBanner instance={INSTANCE} active />);
		const text = screen.getByRole('alert').textContent ?? '';
		expect(text).toContain('not ready: boot config replay has not settled');
		expect(text).toMatch(/Stale — received \d+s ago/);
	});

	it('passes the flavor gate through to the read', () => {
		render(<GatewayReadinessBanner instance={INSTANCE} active={false} />);
		expect(state.calls[state.calls.length - 1]).toEqual({instanceId: 5, active: false});
	});
});
