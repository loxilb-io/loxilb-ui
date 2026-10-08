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

// A fixed instant: the panel formats it, the test formats the same number.
const READ_AT = 1_780_000_000_000;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The value under a label: SingleTextBox renders the label, then its value. */
function valueOf(label: string): string | null | undefined {
	return screen.getByText(label, {exact: true}).closest('.MuiStack-root')?.querySelector('.MuiTypography-body2')?.textContent;
}

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

	it('warns about unverified runtime state when declared settings have no pool readback', () => {
		render(<AIGatewayPanel serviceArguments={args({fc_mode: 'enforce', fc_max_outstanding: 1})} />);
		expect(screen.getByRole('alert').textContent).toContain('Whether these settings are in force is not known.');
		expect(screen.queryByText('Executing Now')).toBeNull();
	});

	it('does not warn when declared settings have runtime readback', () => {
		render(<AIGatewayPanel serviceArguments={args({fc_mode: 'observe', fc_effective: healthy})} />);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('renders no admission section on a rule the gateway keeps no admission pool for', () => {
		render(<AIGatewayPanel serviceArguments={args({sse_mode: false, api_key_auth: 'disabled', model_name: 'm'})} />);
		expect(screen.queryByText('Admission Control')).toBeNull();
	});

	// The gateway's JSON drops a zero, so this is what an unlimited ceiling, a
	// pool with no queue and an idle pool actually look like on the wire.
	it('reads a base member the gateway left out as zero: unlimited, no queue, nothing executing', () => {
		const {max_outstanding, queue_depth, queue_wait_ms, inflight, queued, ...rest} = healthy;
		render(<AIGatewayPanel serviceArguments={args({fc_effective: rest})} />);
		expect(screen.getByText('Unlimited (rule)')).toBeTruthy();
		expect(screen.getByText('None (over the ceiling is refused) (environment)')).toBeTruthy();
		expect(valueOf('Executing Now')).toBe('0');
		expect(valueOf('Waiting Now')).toBe('0');
		// Not the blank a missing value renders as.
		expect(valueOf('Ceiling in Force')).toBe('Unlimited (rule)');
	});

	it('always shows what the pool holds now, queued or not', () => {
		render(<AIGatewayPanel serviceArguments={args({fc_effective: healthy})} />);
		expect(valueOf('Executing Now')).toBe('3');
		expect(valueOf('Waiting Now')).toBe('0');
	});

	it('shows the endpoint ceiling that applies: the normal role, or prefill and decode on a P/D rule', () => {
		const effective: IFcEffective = {...healthy, ep_max_inflight: 4, prefill_max_inflight: 2, source: {...healthy.source, ep_max_inflight: 'env', prefill_max_inflight: 'rule', decode_max_inflight: 'default'}};
		const {unmount} = render(<AIGatewayPanel serviceArguments={args({fc_effective: effective})} />);
		expect(valueOf('Endpoint Ceiling')).toBe('4 (environment)');
		expect(screen.queryByText('Prefill Endpoint Ceiling')).toBeNull();
		unmount();

		render(<AIGatewayPanel serviceArguments={args({pd_disagg_mode: true, fc_effective: effective})} />);
		expect(valueOf('Prefill Endpoint Ceiling')).toBe('2 (rule)');
		// Left out by the gateway: zero, which on a ceiling is "unlimited".
		expect(valueOf('Decode Endpoint Ceiling')).toBe('Unlimited (default)');
		expect(screen.queryByText('Endpoint Ceiling')).toBeNull();
	});

	it('says when the counts were read, and that they move; nothing when the read time is unknown', () => {
		render(<AIGatewayPanel serviceArguments={args({fc_effective: healthy})} readAtMs={READ_AT} />);
		expect(screen.getByText(new RegExp(`as read at ${escapeRegExp(new Date(READ_AT).toLocaleTimeString())} and move with traffic`))).toBeTruthy();
		expect(screen.queryByRole('alert')).toBeNull();
		cleanup();

		render(<AIGatewayPanel serviceArguments={args({fc_effective: healthy})} />);
		expect(screen.queryByText(/move with traffic/)).toBeNull();
	});
});
