//---------------------------------------------------------
// Admission pressure panel — what an operator is TOLD (Stage 3.4)
//---------------------------------------------------------
// The derivation is pinned in observability/pdAdmission.test.ts. This file
// pins the half derivation cannot: the words.
//
// ⭐⭐ The property that matters most is that this panel REPLACED a row which
// lied by omission. "Admission shed" read the plain-shed counter alone, and
// that counter cannot move on a queueing gateway — so the page showed 0/s
// during an overload that was dropping traffic. The tests below therefore pin
// not only that a drop is reported, but that the structurally-zero counter is
// LABELLED as unreachable so nobody reads its zero as reassurance.
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {PdAdmissionReport} from 'observability/pdAdmission';
import PDAdmissionPanel from './PDAdmissionPanel';

const RATE = {kind: 'ok', perSecond: 0, intervalMs: 10_000} as const;

const ok = (over: Partial<Extract<PdAdmissionReport, {kind: 'ok'}>> = {}): PdAdmissionReport => ({
	kind: 'ok',
	mode: 'indeterminate',
	verdict: 'no-pressure',
	dropRate: RATE,
	queuedRate: RATE,
	shedRate: RATE,
	overflowRate: RATE,
	shedTotal: 0,
	overflowTotal: 0,
	queuedTotal: 0,
	dropTotal: 0,
	blindSpot: false,
	...over,
});

// Vocabulary that tells an operator something is WRONG and that they must go
// act on it.
//
// ⚠️ The word "dropped" is deliberately NOT in it, and that exclusion is the
// same trap the 3.2 panel hit with "falling through": every neutral sentence
// here has to describe the MECHANISM, and the mechanism is dropping. The
// shedding-mode note explains that requests are "dropped immediately with a
// retriable 429" as a plain statement of how the gateway is configured, not
// as a finding. The regex may only match the imperative to go fix something.
const FAULT_WORDS = /running out of capacity|add prefill endpoints|Upgrade the gateway|report it/i;

const alerts = () => screen.getAllByRole('alert').map(a => a.className).join(' ');

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('the two correct readings of a zero shed counter', () => {
	it('⭐ reports no fault on a gateway whose pool has never filled', () => {
		// The live testbed's actual state: all three counters exported at
		// zero. Nothing has queued or shed, so the pool has headroom.
		render(<PDAdmissionPanel report={ok()} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(screen.getByText(/has neither queued nor dropped a request/i)).toBeTruthy();
		// ⚠️ And it says the mode is unknowable rather than implying queueing
		// is off — the gate is env-only and no REST surface exposes it.
		expect(screen.getByText(/cannot be told from the metrics/i)).toBeTruthy();
	});

	it('⭐⭐ says the SAME zero is structural once queueing is proven armed', () => {
		// The sentence the old single-row page was missing entirely. The
		// plain-shed counter reads zero in both cases and means something
		// completely different in each.
		render(<PDAdmissionPanel report={ok({mode: 'queueing', verdict: 'absorbing', queuedTotal: 6})} />);
		expect(screen.getByText(/stays at zero by construction/i)).toBeTruthy();
		expect(screen.getByText(/not evidence that nothing was dropped/i)).toBeTruthy();
		// The unreachable valve is labelled, not coloured as a failure.
		expect(screen.getByText('Not reachable')).toBeTruthy();
	});
});

describe('the finding, and the things that are not it', () => {
	it('⭐⭐ reports a drop even though the plain shed counter reads zero', () => {
		// Queueing armed, overflow valve firing, plain shed pinned at 0 —
		// exactly the case the page used to render as "0/s".
		render(
			<PDAdmissionPanel
				report={ok({mode: 'queueing', verdict: 'dropping', dropTotal: 3, overflowTotal: 3, shedTotal: 0, queuedTotal: 6})}
			/>,
		);
		expect(alerts()).toMatch(/Warning/);
		expect(screen.getByText(FAULT_WORDS)).toBeTruthy();
		// ⚠️ Pins the i18next plural trap: `count` would resolve
		// `key_one`/`key_other`, miss the literal key and render raw
		// placeholders.
		expect(screen.getByText(/3 requests have been dropped/)).toBeTruthy();
		expect(screen.queryByText(/\{\{n\}\}/)).toBeNull();
	});

	it('⭐ treats parking as success, not as a fault', () => {
		// Hold-don't-drop: a parked request is still going to be served, so
		// absorbing a burst is the FIFO doing its job. Warning here would
		// alarm on backpressure working correctly.
		render(<PDAdmissionPanel report={ok({mode: 'queueing', verdict: 'absorbing', queuedTotal: 6, dropTotal: 0})} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(alerts()).toMatch(/Success/);
		expect(screen.getByText(/dropped none/i)).toBeTruthy();
	});

	it('⚠️⚠️ warns that a queueing gateway cannot export its only drop counter', () => {
		// The pre-overflow-family blind spot: drops are happening with nothing recording
		// them. A monitoring fault, and it outranks the mode explanation.
		render(<PDAdmissionPanel report={ok({mode: 'queueing', verdict: 'absorbing', queuedTotal: 6, overflowTotal: undefined, blindSpot: true})} />);
		expect(screen.getByText(/Upgrade the gateway/i)).toBeTruthy();
		expect(screen.getByText(/may be being dropped with no metric recording it/i)).toBeTruthy();
		// The mode explanation is replaced, not stacked beneath it.
		expect(screen.queryByText(/stays at zero by construction/i)).toBeNull();
		// The absent family renders as "None", never as the number zero.
		expect(screen.getByText('None')).toBeTruthy();
	});

	it('⚠️ reports a datapath-impossible split as a data-trust caveat', () => {
		// Both valves moving cannot happen: the depth is fixed per process.
		// So this is a metrics problem, and the copy must not send the
		// operator after a capacity problem.
		render(<PDAdmissionPanel report={ok({mode: 'contradictory', verdict: 'dropping', shedTotal: 2, overflowTotal: 3, dropTotal: 5})} />);
		expect(screen.getByText(/does not allow/i)).toBeTruthy();
		expect(screen.getByText(/the total is still the number of requests dropped/i)).toBeTruthy();
		// Neither valve is claimed unreachable when the mode is incoherent.
		expect(screen.queryByText('Not reachable')).toBeNull();
	});
});

describe('drops are one quantity, not a row to be hunted for', () => {
	it('shows a combined drop figure above the per-valve split', () => {
		// ⭐ A reader scanning only the split can land on the structurally
		// zero row and conclude nothing was dropped. The headline is the fix.
		render(<PDAdmissionPanel report={ok({mode: 'queueing', verdict: 'dropping', dropTotal: 3, overflowTotal: 3, dropRate: {kind: 'ok', perSecond: 0.3, intervalMs: 10_000}})} />);
		expect(screen.getByText(/Requests dropped/)).toBeTruthy();
		expect(screen.getByText(/across both valves, of which one is armed/i)).toBeTruthy();
	});

	it('says what these counters do NOT cover', () => {
		// A request that found no healthy prefill endpoint never reaches the
		// admission layer, so a zero here is not "nothing failed".
		render(<PDAdmissionPanel report={ok()} />);
		expect(screen.getByText(/fails earlier and is not counted here/i)).toBeTruthy();
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
	it('keeps the chips out of state_color()’s English substring matching', async () => {
		// ⚠️ state_color() defaults to 'error' for any string it does not
		// recognise and matches lowercase ENGLISH substrings, so routing these
		// through a DataTable state column would paint a ko operator a red
		// cell for a healthy gateway.
		await i18n.changeLanguage('ko');
		render(<PDAdmissionPanel report={ok()} />);
		expect(alerts()).toMatch(/Success/);
		expect(alerts()).not.toMatch(/Error/);
		await i18n.changeLanguage('en');
	});
});
