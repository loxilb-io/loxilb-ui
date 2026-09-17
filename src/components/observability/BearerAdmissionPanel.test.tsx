//---------------------------------------------------------
// Bearer admission panel — what an operator is TOLD (J3)
//---------------------------------------------------------
// The rates are pinned in observability/jwtAuth.test.ts. This pins the
// reading: the absent family must read as a precondition, the "-" tenant must
// not read as a missing label, and only the gateway's own fault may read as
// something to go and fix.
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import {BearerAdmission, IBearerReasonRate} from 'observability/jwtAuth';
import BearerAdmissionPanel from './BearerAdmissionPanel';

const rate = (perSecond: number) => ({kind: 'ok', perSecond, intervalMs: 10_000}) as const;

const reason = (over: Partial<IBearerReasonRate>): IBearerReasonRate => ({
	reason: 'invalid_token',
	reasonClass: 'credential',
	rate: rate(1),
	tenants: ['-'],
	...over,
});

const ok = (over: Partial<Extract<BearerAdmission, {kind: 'ok'}>> = {}): BearerAdmission => ({
	kind: 'ok',
	admitted: rate(10),
	denied: rate(2),
	gatewayFault: rate(0),
	byReason: [reason({})],
	...over,
});

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('the absent family', () => {
	it('⭐ reads as a precondition and never prints a rate', () => {
		// These series do not exist until a rule selects the bearer arm and a
		// request carrying an Authorization header reaches it. "0/s" here
		// would assert that bearer auth is configured and simply idle.
		render(<BearerAdmissionPanel admission={{kind: 'not-exported'}} />);

		expect(screen.getByText(/No bearer verdicts recorded/)).toBeTruthy();
		expect(screen.getByText(/once an LB rule selects the JWT arm/)).toBeTruthy();
		expect(screen.queryByText(/\/s$/)).toBeNull();
		// Not an error either — nothing has gone wrong.
		expect(screen.queryByText(/error|failed|unavailable/i)).toBeNull();
	});

	it('does not claim a precondition when the scrape itself failed', () => {
		// "No verdicts recorded" would be a statement about the gateway, and
		// a scrape that did not answer supports no statement about it at all.
		render(<BearerAdmissionPanel admission={{kind: 'unavailable'}} />);
		expect(screen.queryByText(/No bearer verdicts recorded/)).toBeNull();
		expect(screen.getByText('N/A')).toBeTruthy();
	});
});

describe('the summary lines', () => {
	it('gives the gateway-caused share its own line', () => {
		// A bad token is the system working; the gateway failing closed is
		// not. They must not share a single "denied" number.
		render(<BearerAdmissionPanel admission={ok({gatewayFault: rate(0.5)})} />);

		expect(screen.getByText('Admitted')).toBeTruthy();
		expect(screen.getByText('Denied')).toBeTruthy();
		expect(screen.getByText('Denied by gateway fault')).toBeTruthy();
		expect(screen.getByText('0.500/s')).toBeTruthy();
	});

	it('renders a degenerate rate in the shared vocabulary, never as 0/s', () => {
		render(<BearerAdmissionPanel admission={ok({admitted: {kind: 'insufficient-samples'}, denied: {kind: 'reset'}})} />);
		expect(screen.getByText('Warming up…')).toBeTruthy();
		expect(screen.getByText('Counter reset')).toBeTruthy();
	});
});

describe('the per-reason breakdown', () => {
	function rowFor(reasonName: string) {
		const cell = screen.getByText(reasonName);
		const row = cell.closest('tr');
		if (!row) throw new Error(`no row for ${reasonName}`);
		return within(row);
	}

	it('⭐ says a "-" tenant is unattributed, not missing', () => {
		// The stand-in is deliberate upstream: most refusals are reached
		// before a signature is verified, so no tenant can be trusted. A blank
		// cell would read as a scrape bug.
		render(<BearerAdmissionPanel admission={ok({byReason: [reason({tenants: ['-']})]})} />);
		expect(rowFor('invalid_token').getByText(/Unattributed \(denied before verification\)/)).toBeTruthy();
	});

	it('shows the real tenant on the one arm that has a verified one', () => {
		render(<BearerAdmissionPanel admission={ok({byReason: [reason({reason: 'model_not_allowed', reasonClass: 'authorization', tenants: ['acme']})]})} />);
		expect(rowFor('model_not_allowed').getByText('acme')).toBeTruthy();
	});

	it('drops the stand-in when a real tenant is also present, rather than listing "-"', () => {
		render(<BearerAdmissionPanel admission={ok({byReason: [reason({reason: 'model_not_allowed', reasonClass: 'authorization', tenants: ['-', 'acme']})]})} />);
		const row = rowFor('model_not_allowed');
		expect(row.getByText('acme')).toBeTruthy();
		expect(row.queryByText('-')).toBeNull();
	});

	it('⭐ shows an unrecognized reason as itself instead of guessing its class', () => {
		// Upstream records promoting bad_signature/unknown_kid/oversize onto
		// this label as an OPEN decision, so a novel value is expected.
		render(<BearerAdmissionPanel admission={ok({byReason: [reason({reason: 'bad_signature', reasonClass: 'unclassified'})]})} />);
		const row = rowFor('bad_signature');
		expect(row.getByText('Unrecognized reason')).toBeTruthy();
	});

	it('labels each class distinctly so a bad token never reads like a gateway fault', () => {
		render(
			<BearerAdmissionPanel
				admission={ok({
					byReason: [
						reason({reason: 'allowed', reasonClass: 'admitted'}),
						reason({reason: 'invalid_token', reasonClass: 'credential'}),
						reason({reason: 'model_not_allowed', reasonClass: 'authorization'}),
						reason({reason: 'policy_store_unavailable', reasonClass: 'gateway-fault'}),
					],
				})}
			/>,
		);
		expect(rowFor('invalid_token').getByText('Caller credential')).toBeTruthy();
		expect(rowFor('model_not_allowed').getByText('Not authorized')).toBeTruthy();
		expect(rowFor('policy_store_unavailable').getByText('Gateway fault')).toBeTruthy();
		// Each class has its own words; none of them is reused for another.
		const labels = ['Caller credential', 'Not authorized', 'Gateway fault'];
		for (const l of labels) expect(screen.getAllByText(l).length).toBe(1);
	});
});
