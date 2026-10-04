//---------------------------------------------------------
// Admission pressure panel — what an operator is TOLD
//---------------------------------------------------------
// The derivation is pinned in observability/pdAdmission.test.ts. This file
// pins the half derivation cannot: the words.
//
// ⭐⭐ The property that matters most is that a drop is reported as ONE
// number across both valves. The plain-shed counter cannot move on a
// queueing gateway, so a page that read it alone showed nothing during an
// overload that was dropping traffic.
//
// The panel is compact: a verdict plus the two defect alerts. The per-valve
// table, its chips and the mode explanations are Grafana's now, and the
// tests below pin that they stay gone.
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {PdAdmissionReport} from 'observability/pdAdmission';
import PDAdmissionPanel from './PDAdmissionPanel';

const ok = (over: Partial<Extract<PdAdmissionReport, {kind: 'ok'}>> = {}): PdAdmissionReport => ({
	kind: 'ok',
	mode: 'indeterminate',
	verdict: 'no-pressure',
	shedTotal: 0,
	overflowTotal: 0,
	queuedTotal: 0,
	dropTotal: 0,
	blindSpot: false,
	...over,
});

// Vocabulary that tells an operator something is WRONG and that they must go
// act on it. "dropped" is deliberately not in it: the no-pressure and
// absorbing verdicts say "dropped none" as a statement of health.
const FAULT_WORDS = /running out of capacity|add prefill endpoints|Upgrade the gateway|report it/i;

const alerts = () => screen.getAllByRole('alert').map(a => a.className).join(' ');

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('the verdict', () => {
	it('⭐ reports no fault on a gateway whose pool has never filled', () => {
		// The live testbed's actual state: all three counters exported at zero.
		render(<PDAdmissionPanel report={ok()} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(screen.getByText(/has neither queued nor dropped a request/i)).toBeTruthy();
		expect(alerts()).toMatch(/Success/);
	});

	it('⭐⭐ reports a drop even though the plain shed counter reads zero', () => {
		// Queueing armed, overflow valve firing, plain shed pinned at 0.
		render(<PDAdmissionPanel report={ok({mode: 'queueing', verdict: 'dropping', dropTotal: 3, overflowTotal: 3, shedTotal: 0, queuedTotal: 6})} />);
		expect(alerts()).toMatch(/Warning/);
		expect(screen.getByText(FAULT_WORDS)).toBeTruthy();
		// ⚠️ Pins the i18next plural trap: `count` would resolve
		// `key_one`/`key_other`, miss the literal key and render raw
		// placeholders.
		expect(screen.getByText(/3 requests have been dropped/)).toBeTruthy();
		expect(screen.queryByText(/\{\{n\}\}/)).toBeNull();
	});

	it('⭐ treats parking as success, not as a fault', () => {
		// Hold-don't-drop: a parked request is still going to be served.
		render(<PDAdmissionPanel report={ok({mode: 'queueing', verdict: 'absorbing', queuedTotal: 6, dropTotal: 0})} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(alerts()).toMatch(/Success/);
		expect(screen.getByText(/dropped none/i)).toBeTruthy();
	});
});

describe('the defect alerts', () => {
	it('⚠️⚠️ warns that a queueing gateway cannot export its only drop counter', () => {
		// Drops are happening with nothing recording them — a monitoring fault.
		render(<PDAdmissionPanel report={ok({mode: 'queueing', verdict: 'absorbing', queuedTotal: 6, overflowTotal: undefined, blindSpot: true})} />);
		expect(screen.getByText(/Upgrade the gateway/i)).toBeTruthy();
		expect(screen.getByText(/may be being dropped with no metric recording it/i)).toBeTruthy();
	});

	it('⚠️ reports a datapath-impossible split as a data-trust caveat under the total', () => {
		// Both valves moving cannot happen: the depth is fixed per process. So
		// this is a metrics problem, and the drop total still stands.
		render(<PDAdmissionPanel report={ok({mode: 'contradictory', verdict: 'dropping', shedTotal: 2, overflowTotal: 3, dropTotal: 5})} />);
		expect(screen.getByText(/5 requests have been dropped/)).toBeTruthy();
		expect(screen.getByText(/does not allow/i)).toBeTruthy();
		expect(screen.getByText(/drop total above is still every request that was dropped/i)).toBeTruthy();
	});

	it('stays silent about the mode when nothing is wrong with the counters', () => {
		// Queueing, shedding and not-yet-exercised are normal: describing
		// them would be commentary on a table that is no longer here.
		for (const mode of ['queueing', 'shedding', 'indeterminate'] as const) {
			render(<PDAdmissionPanel report={ok({mode})} />);
			expect(screen.getAllByRole('alert')).toHaveLength(1);
			cleanup();
		}
	});
});

describe('compact: the breakdown lives in Grafana', () => {
	it('renders no per-valve table, chips or rate headline', () => {
		render(<PDAdmissionPanel report={ok({mode: 'contradictory', verdict: 'dropping', shedTotal: 2, overflowTotal: 3, dropTotal: 5})} />);
		expect(screen.queryByRole('table')).toBeNull();
		expect(screen.queryByText('Not reachable')).toBeNull();
		expect(screen.queryByText('Not exported')).toBeNull();
		expect(screen.queryByText(/Requests dropped/)).toBeNull();
		expect(screen.queryByText(/Queued \(held\)/)).toBeNull();
	});
});

describe('absent data', () => {
	it('separates a failed scrape from a statement about drops', () => {
		render(<PDAdmissionPanel report={{kind: 'unavailable'}} />);
		expect(screen.getByText(/says nothing about whether requests are being dropped/i)).toBeTruthy();
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
	});

	it('treats a build without the admission layer as a non-event', () => {
		render(<PDAdmissionPanel report={{kind: 'not-exported'}} />);
		expect(screen.getByText(/does not export the per-endpoint admission counters/i)).toBeTruthy();
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
	});
});

describe('translated builds', () => {
	it('keeps a healthy verdict green in ko', async () => {
		// Severity comes from the verdict, never from matching translated text.
		await i18n.changeLanguage('ko');
		render(<PDAdmissionPanel report={ok()} />);
		expect(alerts()).toMatch(/Success/);
		expect(alerts()).not.toMatch(/Error/);
		await i18n.changeLanguage('en');
	});
});
