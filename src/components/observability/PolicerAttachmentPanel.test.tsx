//---------------------------------------------------------
// Policer attachment panel — what an operator is TOLD (Stage 3.3)
//---------------------------------------------------------
// The derivation is pinned in observability/policerAttachment.test.ts. This
// file pins the half derivation cannot: the words.
//
// ⭐⭐ The property that matters most here is a NEGATIVE one, and it is the
// correction this stage is built on. The gauge and REST `attached` are the
// same PolEntry.attached() predicate read at two different times, so a
// disagreement between them is bounded staleness and heals itself on the next
// tick. A panel that rendered it as a fault — which the stage brief's
// "the mismatch is the panel's whole value" framing would have produced —
// would fire on every healthy policer creation. So "Settling" must read as a
// caveat and never as an alarm.
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IPolicerAttachmentRow, PolicerAttachmentReport} from 'observability/policerAttachment';
import PolicerAttachmentPanel from './PolicerAttachmentPanel';

const row = (ident: string, over: Partial<IPolicerAttachmentRow> = {}): IPolicerAttachmentRow => ({
	ident,
	attached: true,
	corroboration: 'agreed',
	listedInRest: true,
	metricAttached: true,
	restAttached: true,
	...over,
});

const ok = (over: Partial<Extract<PolicerAttachmentReport, {kind: 'ok'}>> = {}): PolicerAttachmentReport => ({
	kind: 'ok',
	rows: [row('p-live')],
	verdict: 'all-attached',
	familyExported: true,
	configured: 1,
	pending: 0,
	attached: 1,
	conflicts: 0,
	unknown: 0,
	...over,
});

// Vocabulary that tells an operator something is WRONG and that they must go
// act on it. None of it may appear on a gateway behaving as configured.
//
// ⚠️ "not being exported at all" and "could not be established" are
// deliberately NOT in it. The incomplete state uses both to describe a
// MONITORING gap while explicitly denying a datapath fault ("the policers
// themselves may be shaping normally"), so matching them would force the
// neutral explanation out of the state that most needs explaining — the same
// trap the 3.2 panel test hit with "falling through".
const FAULT_WORDS = /check that|shaping nothing/i;

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('the two correct readings of an empty attachment gauge', () => {
	it('⭐ does not report a fault when no policer is configured', () => {
		// The collector emits nothing with an empty store, so an absent
		// family is the feature being unused. Warning here would alarm on
		// every gateway that does not do QoS.
		render(<PolicerAttachmentPanel report={ok({verdict: 'none-configured', rows: [], configured: 0, attached: 0, familyExported: false})} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(screen.getByText(/correctly empty/i)).toBeTruthy();
		// It still says how to start using the feature, which is the
		// actionable half of a non-finding.
		expect(screen.getByText(/Add a policy/i)).toBeTruthy();
	});

	it('⭐⭐ calls the SAME empty gauge a monitoring gap once REST lists policers', () => {
		// The identical absent family, the opposite meaning — decided entirely
		// by REST. This is the pair the panel exists to tell apart.
		render(<PolicerAttachmentPanel report={ok({verdict: 'incomplete', familyExported: false, configured: 2, rows: [row('p1', {attached: undefined, corroboration: 'unreported', metricAttached: undefined, restAttached: undefined})]})} />);
		expect(screen.getByText(/not being exported at all/i)).toBeTruthy();
		// ⚠️ And it must say what this is NOT: the policers may be fine.
		expect(screen.getByText(/may be shaping normally/i)).toBeTruthy();
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
	});
});

describe('the finding, and the things that are not it', () => {
	it('⭐⭐ reports a pending policer as a warning, with the counts interpolated', () => {
		render(<PolicerAttachmentPanel report={ok({verdict: 'pending-attachment', pending: 2, configured: 3, attached: 1, rows: [row('p-bad', {attached: false, metricAttached: false, restAttached: false})]})} />);
		expect(screen.getByRole('alert').className).toMatch(/Warning/);
		// The imperative belongs in the ALERT, not only on a row chip: an
		// operator scanning verdicts must see it without hovering a cell.
		expect(screen.getByRole('alert').textContent).toMatch(FAULT_WORDS);
		// ⚠️ Pins the i18next plural trap: `count` would have made i18next
		// resolve key_one/key_other, miss the literal key, and render the raw
		// key text with the placeholders intact.
		expect(screen.getByText(/2 of 3 policers/)).toBeTruthy();
		expect(screen.queryByText(/\{\{n\}\}/)).toBeNull();
	});

	it('⭐⭐ does NOT raise a fault when the two sources merely disagree', () => {
		// The heart of this stage's correction. Same predicate, two read
		// times — the state moved inside the last scrape, and it resolves
		// itself. An alarm here would fire on every policer creation.
		render(<PolicerAttachmentPanel report={ok({verdict: 'incomplete', conflicts: 1, unknown: 1, attached: 0, rows: [row('p1', {attached: undefined, corroboration: 'conflict', metricAttached: false, restAttached: true})]})} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(screen.getByRole('alert').className).not.toMatch(/Warning|Error/);
		// The row is labelled as in-flight, not as broken.
		expect(screen.getByText('Settling')).toBeTruthy();
		expect(screen.queryByText('Shaping nothing')).toBeNull();
	});

	it('does not render an unknown row as either shaping or not shaping', () => {
		render(<PolicerAttachmentPanel report={ok({verdict: 'incomplete', unknown: 1, attached: 0, rows: [row('p1', {attached: undefined, corroboration: 'unreported', metricAttached: undefined, restAttached: undefined})]})} />);
		expect(screen.getByText('Unknown')).toBeTruthy();
		expect(screen.queryByText('Shaping')).toBeNull();
		expect(screen.queryByText('Shaping nothing')).toBeNull();
	});

	it('withholds the verdict rather than guessing when the policy list is unavailable', () => {
		render(<PolicerAttachmentPanel report={ok({verdict: 'unknown-configuration', configured: undefined, rows: [row('p1', {attached: false, corroboration: 'metric-only', listedInRest: false, restAttached: undefined, metricAttached: false})]})} />);
		expect(screen.getByText(/policy list is unavailable/i)).toBeTruthy();
		// The rows the gauge DID report are still shown — the missing half is
		// the judgement, not the data.
		expect(screen.getByText('p1')).toBeTruthy();
		expect(screen.getByText('Shaping nothing')).toBeTruthy();
	});

	it('marks a series REST no longer lists as deleted, not as a fault', () => {
		render(<PolicerAttachmentPanel report={ok({rows: [row('p-gone', {corroboration: 'metric-only', listedInRest: false, restAttached: undefined})]})} />);
		expect(screen.getByText('Deleted')).toBeTruthy();
		expect(screen.getByText(/No longer configured/i)).toBeTruthy();
	});

	it('says nothing about corroboration when the two sources agree', () => {
		// A check that passes is not news. A chip on every healthy row would
		// train an operator to ignore the column that carries the caveats.
		render(<PolicerAttachmentPanel report={ok()} />);
		expect(screen.getByText('Shaping')).toBeTruthy();
		for (const noise of ['Settling', 'Metric only', 'Not in metrics', 'Not reported', 'Deleted']) {
			expect(screen.queryByText(noise), noise).toBeNull();
		}
	});
});

describe('no snapshot', () => {
	it('separates a failed scrape from a statement about rate limiting', () => {
		render(<PolicerAttachmentPanel report={{kind: 'unavailable'}} />);
		expect(screen.getByText(/says nothing about whether rate limiting is working/i)).toBeTruthy();
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
	});
});

describe('translated builds', () => {
	it('keeps the state chips out of state_color()’s English substring matching', async () => {
		// ⚠️ state_color() defaults to 'error' for any string it does not
		// recognise and matches lowercase ENGLISH substrings, so routing these
		// through a DataTable state column would paint a ko operator a red
		// cell for a healthy policer. The chips are built locally; this pins
		// that a translated build still renders the healthy row without an
		// error alert.
		await i18n.changeLanguage('ko');
		render(<PolicerAttachmentPanel report={ok()} />);
		expect(screen.getByRole('alert').className).toMatch(/Success/);
		await i18n.changeLanguage('en');
	});
});
