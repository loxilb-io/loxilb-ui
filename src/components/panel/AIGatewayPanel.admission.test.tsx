//---------------------------------------------------------
// Admission read-back on the LB rule's AI Gateway tab.
//
// Pins: what is in force and who set it (rule / environment / default), the
// two states an operator must act on (a held adaptive ceiling, requests
// queued), "not reported" rather than "off" when the gateway gives no state,
// and no section at all on a rule without an admission pool. Compactness is
// part of the contract: a healthy pool adds no alert.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IFcEffective, IServiceArguments} from 'types/load_balancer';
import AIGatewayPanel from './AIGatewayPanel';

// The KV-exact status section below it reads a query; not this file's subject.
vi.mock('components/panel/KvExactStatusPanel', () => ({default: () => null}));

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp', mode: 4, sse_mode: true, ...over} as IServiceArguments;
}

const healthy: IFcEffective = {
	mode: 'observe',
	max_outstanding: 64,
	effective_max_outstanding: 64,
	queue_depth: 8,
	queue_wait_ms: 2000,
	inflight: 3,
	queued: 0,
	adaptive: 'off',
	adapt_state: 'off',
	tenant_max_share_pct: 0,
	source: {mode: 'rule', max_outstanding: 'rule', queue_depth: 'env'},
};

afterEach(cleanup);

describe('AIGatewayPanel admission read-back', () => {
	it('shows the values in force with their source, and no alert for a healthy pool', () => {
		render(<AIGatewayPanel serviceArguments={args({fc_effective: healthy})} />);
		expect(screen.getByText('observe (rule)')).toBeTruthy();
		expect(screen.getByText('64 (rule)')).toBeTruthy();
		expect(screen.getByText('8 / 2000 ms (environment)')).toBeTruthy();
		expect(screen.queryByRole('alert')).toBeNull();
		// A share of 0 is "no share": not a row.
		expect(screen.queryByText('Tenant Max Share (%)')).toBeNull();
	});

	it('reads the ceiling in force from effective_max_outstanding only when adaptive is on', () => {
		render(<AIGatewayPanel serviceArguments={args({fc_effective: {...healthy, adaptive: 'on', effective_max_outstanding: 40, adapt_state: 'open'}})} />);
		expect(screen.getByText('40 (rule)')).toBeTruthy();
	});

	it('warns when the adaptive ceiling is held below the declared one, naming why', () => {
		render(<AIGatewayPanel serviceArguments={args({fc_effective: {...healthy, adaptive: 'on', adapt_state: 'tightened', adapt_reason: 'ttft', effective_max_outstanding: 40}})} />);
		expect(screen.getByRole('alert').textContent).toContain('tightened at 40 of 64 (reason: ttft)');
	});

	it('says how many requests are queued, only when some are', () => {
		render(<AIGatewayPanel serviceArguments={args({fc_effective: {...healthy, queued: 5}})} />);
		expect(screen.getByRole('alert').textContent).toContain('5 requests are waiting for capacity.');
	});

	it('says "not reported" — never "off" — when an AI rule carries no fc_effective', () => {
		render(<AIGatewayPanel serviceArguments={args()} />);
		expect(screen.getByText('Not reported by this gateway.')).toBeTruthy();
	});

	it('renders no admission section on a rule the gateway keeps no admission pool for', () => {
		render(<AIGatewayPanel serviceArguments={args({sse_mode: false, api_key_auth: 'disabled', model_name: 'm'})} />);
		expect(screen.queryByText('Admission Control')).toBeNull();
	});

	it('shows 0 as "Unlimited" and a zero queue depth as refusal, not as a number', () => {
		render(<AIGatewayPanel serviceArguments={args({fc_effective: {...healthy, max_outstanding: 0, queue_depth: 0}})} />);
		expect(screen.getByText('Unlimited (rule)')).toBeTruthy();
		expect(screen.getByText('None (over the ceiling is refused) (environment)')).toBeTruthy();
	});
});
