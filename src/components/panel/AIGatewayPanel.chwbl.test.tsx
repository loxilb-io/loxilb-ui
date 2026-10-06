//---------------------------------------------------------
// CHWBL ring tuning read-back on the LB rule's AI Gateway tab.
//
// The gateway reports the resolved values for a fullproxy rule under sel 8/10.
// Pins: they are shown as reported, the cache_salt requirement reads as a
// state rather than a raw boolean, and nothing is shown where the gateway
// reported nothing or the rule builds no ring.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IServiceArguments} from 'types/load_balancer';
import AIGatewayPanel from './AIGatewayPanel';

// The KV-exact status section below it reads a query; not this file's subject.
vi.mock('components/panel/KvExactStatusPanel', () => ({default: () => null}));

const LABELS = ['CHWBL Mean Load Factor (%)', 'CHWBL Replication', 'Require cache_salt'];

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp', mode: 4, sel: 8, chwbl_prefix_hash_level: 1, ...over} as IServiceArguments;
}

const RESOLVED = {chwbl_mean_load_factor: 175, chwbl_replication: 256, chwbl_enable_cache_salt: false};

/** The value rendered under a caption: SingleTextBox is caption + value, not a labelled control. */
function valueOf(label: string): string | null | undefined {
	return screen.queryByText(label)?.parentElement?.nextElementSibling?.textContent;
}
const shown = () => LABELS.filter(label => screen.queryByText(label) !== null);

afterEach(cleanup);

describe('AIGatewayPanel CHWBL ring read-back', () => {
	it('shows the resolved ring tuning of a chwbl rule', () => {
		render(<AIGatewayPanel serviceArguments={args(RESOLVED)} />);
		expect(valueOf('CHWBL Mean Load Factor (%)')).toBe('175');
		expect(valueOf('CHWBL Replication')).toBe('256');
		expect(valueOf('Require cache_salt')).toBe('Not required');
	});

	it('reads an enforced cache_salt requirement as Required', () => {
		render(<AIGatewayPanel serviceArguments={args({...RESOLVED, sel: 10, chwbl_enable_cache_salt: true})} />);
		expect(valueOf('Require cache_salt')).toBe('Required');
	});

	it('shows no row for a value the gateway did not report', () => {
		render(<AIGatewayPanel serviceArguments={args()} />);
		expect(shown()).toEqual([]);
		cleanup();

		render(<AIGatewayPanel serviceArguments={args({chwbl_replication: 64})} />);
		expect(shown()).toEqual(['CHWBL Replication']);
	});

	it('shows no ring tuning on a rule that builds no ring', () => {
		render(<AIGatewayPanel serviceArguments={args({...RESOLVED, sel: 0})} />);
		expect(shown()).toEqual([]);
		cleanup();

		render(<AIGatewayPanel serviceArguments={args({...RESOLVED, mode: 0})} />);
		expect(shown()).toEqual([]);
	});
});
