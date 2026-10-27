//---------------------------------------------------------
// Priority bands, default reservation and class source read-back.
//
// Pins: a member the gateway does not report is "–", an explicit 0 or false
// is shown; a configured value that the gate does not run says so; a fallback
// reason is an alert and an unknown token is shown as sent; an older gateway
// that reports none of these gets no section at all.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import {IFcEffective, IServiceArguments} from 'types/load_balancer';
import AdmissionBandsReadBack from './AdmissionBandsReadBack';
import AIGatewayPanel from './AIGatewayPanel';

vi.mock('components/panel/KvExactStatusPanel', () => ({default: () => null}));

afterEach(cleanup);

function valueOf(label: string): string | null | undefined {
	return screen.getByText(label, {exact: true}).closest('.MuiStack-root')?.querySelector('.MuiTypography-body2')?.textContent;
}

const legacy: IFcEffective = {mode: 'enforce', max_outstanding: 8, inflight: 1, queued: 0};

const bands: IFcEffective = {
	...legacy,
	wake_policy: 'weighted',
	wake_policy_effective: 'weighted',
	weights_in_use: true,
	shed_queue: 'off',
	shed_queue_effective: 'off',
	tenant_wake: 'rr',
	tenant_wake_effective: 'rr',
	band_fallback_reason: 'none',
	bands_configured: true,
	bands: {
		critical_reserve_pct: 10,
		critical_reserve_units: 1,
		critical: {inflight: 2, queued: 0, weight: 8, weight_pct: 67, min_share_pct: 0},
		standard: {inflight: 1, queued: 3, weight: 3, weight_pct: 25},
		sheddable: {weight: 1, weight_pct: 8},
	},
	source: {wake_policy: 'rule', shed_queue: 'env', tenant_wake: 'default'},
};

describe('priority bands', () => {
	it('shows the policy in force with its source and a row per band', () => {
		render(<AdmissionBandsReadBack effective={bands} />);
		expect(valueOf('Wake Policy')).toBe('weighted (rule)');
		expect(valueOf('Shed Queue')).toBe('off (environment)');
		expect(valueOf('In-band Order')).toBe('rr (default)');
		expect(valueOf('Weights in Use')).toBe('Yes');
		expect(valueOf('Critical Reserve')).toBe('10% (units: 1)');
		const table = screen.getByRole('table', {name: 'Priority band state'});
		const rows = within(table).getAllByRole('row');
		expect(rows.map(row => within(row).queryAllByRole('rowheader')[0]?.textContent).filter(Boolean)).toEqual(['Critical', 'Standard', 'Sheddable']);
		expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Band', 'Executing', 'Waiting', 'Wait (ms)', 'Queue share (%)', 'Floor (%)', 'Floor (units)', 'Weight', 'Weight (%)']);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('words the critical reserve so one unit and several both read correctly', () => {
		render(<AdmissionBandsReadBack effective={{...bands, bands: {...bands.bands, critical_reserve_units: 3}}} />);
		expect(valueOf('Critical Reserve')).toBe('10% (units: 3)');
	});

	it('keeps an explicit 0 and shows an unreported member as –', () => {
		render(<AdmissionBandsReadBack effective={bands} />);
		const critical = screen.getByRole('rowheader', {name: 'Critical'}).closest('tr')!;
		const cells = within(critical).getAllByRole('cell').map(cell => cell.textContent);
		// inflight 2, queued 0 (reported), wait_ms –, queue_pct –, min_share_pct 0, floor_units –, weight 8, weight_pct 67
		expect(cells).toEqual(['2', '0', '–', '–', '0', '–', '8', '67']);
		const sheddable = screen.getByRole('rowheader', {name: 'Sheddable'}).closest('tr')!;
		expect(within(sheddable).getAllByRole('cell')[0].textContent).toBe('–');
	});

	it('says when the gate runs something other than configured, and why', () => {
		render(<AdmissionBandsReadBack effective={{...bands, wake_policy_effective: 'strict', weights_in_use: false, band_fallback_reason: 'zero_weight'}} />);
		expect(valueOf('Wake Policy')).toBe('weighted (runs strict) (rule)');
		expect(screen.getByRole('alert').textContent).toContain('Weighted wake with a zero weight: runs strict.');
	});

	it('shows a reason this UI does not know as the gateway sent it', () => {
		render(<AdmissionBandsReadBack effective={{...bands, band_fallback_reason: 'something_newer' as IFcEffective['band_fallback_reason']}} />);
		expect(valueOf('Fallback Reason')).toBe('Unknown (something_newer)');
		expect(screen.getByRole('alert')).toBeTruthy();
	});

	it('renders nothing for a gateway that reports no band state', () => {
		const {container} = render(<AdmissionBandsReadBack effective={legacy} />);
		expect(container.textContent).toBe('');
	});
});

describe('default token reservation', () => {
	const reservation: IFcEffective = {
		...legacy,
		default_reservation: 'on',
		default_max_tokens: 512,
		reservation_clamped_burst: 0,
		reservation_clamped_budget: 4,
		reservation_held_claims: 2,
		reservation_epoch: 29_666_666,
		reservation_held: [{kind: 'tenant', bucket: 'tenant:acme', tokens: 900}, {kind: 'key', bucket: 'key:k1', tokens: 512}],
		source: {default_reservation: 'rule', default_max_tokens: 'default'},
	};

	it('shows the switch, the default and the per-service counters, 0 included', () => {
		render(<AdmissionBandsReadBack effective={reservation} />);
		expect(valueOf('Default Reservation')).toBe('on (rule)');
		expect(valueOf('Default Max Tokens')).toBe('512 (default)');
		expect(valueOf('Clamped (burst)')).toBe('0');
		expect(valueOf('Clamped (budget)')).toBe('4');
		expect(valueOf('Reading Minute')).toBe(new Date(29_666_666 * 60_000).toLocaleTimeString());
		const table = screen.getByRole('table', {name: 'Buckets holding reserved tokens'});
		expect(within(table).getAllByRole('rowheader').map(cell => cell.textContent)).toEqual(['Tenant', 'API key']);
	});

	it('flags a truncated bucket list and shows an unknown quota kind as sent', () => {
		render(<AdmissionBandsReadBack effective={{...reservation, reservation_held_truncated: true, reservation_held: [{kind: 'org' as never, bucket: 'org:x', tokens: 1}]}} />);
		expect(screen.getByRole('alert').textContent).toContain('Not every bucket holding a reservation is listed');
		expect(screen.getByRole('rowheader', {name: 'Unknown (org)'})).toBeTruthy();
	});
});

describe('class configuration source', () => {
	it('warns while the last-known-good file is served', () => {
		render(<AdmissionBandsReadBack effective={{...legacy, config_source: 'lkg', store_reachable: false}} />);
		expect(valueOf('Applied From')).toBe('Last-known-good file');
		expect(screen.getAllByRole('alert')).toHaveLength(1);
		expect(screen.getByRole('alert').textContent).toContain('last-known-good file');
	});

	it('keeps store reachability apart from where the configuration came from', () => {
		render(<AdmissionBandsReadBack effective={{...legacy, config_source: 'store', store_reachable: false, store_last_read: '2026-10-27T03:00:00Z'}} />);
		expect(valueOf('Applied From')).toBe('Key store');
		expect(valueOf('Key Store Reachable')).toBe('No');
		expect(screen.getByRole('alert').textContent).toContain('did not answer the latest read');
	});

	it('does not read nothing-read as a healthy store', () => {
		render(<AdmissionBandsReadBack effective={{...legacy, config_source: 'none'}} />);
		expect(valueOf('Applied From')).toBe('Nothing read');
		expect(valueOf('Key Store Reachable')).toBe('–');
	});
});

describe('mounted on the AI Gateway tab', () => {
	const ai = (fc: IFcEffective): IServiceArguments => ({name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp', mode: 4, sse_mode: true, fc_effective: fc} as IServiceArguments);

	it('appears below the admission block on an AI rule', () => {
		render(<AIGatewayPanel serviceArguments={ai(bands)} />);
		expect(screen.getByRole('heading', {name: 'Admission Control'})).toBeTruthy();
		expect(screen.getByRole('heading', {name: 'Priority Bands'})).toBeTruthy();
	});

	it('is absent where the gateway reports none of it', () => {
		render(<AIGatewayPanel serviceArguments={ai(legacy)} />);
		expect(screen.queryByRole('heading', {name: 'Priority Bands'})).toBeNull();
		expect(screen.queryByRole('heading', {name: 'Default Token Reservation'})).toBeNull();
	});
});
