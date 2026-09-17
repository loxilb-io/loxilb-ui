//---------------------------------------------------------
// P/D tier mix panel — what an operator is TOLD (Stage 3.2)
//---------------------------------------------------------
// The derivation is pinned in observability/pdTiers.test.ts. This file pins
// the half derivation cannot: the words. The panel's reason for existing is
// that an all-Tier-2 mix has two correct readings and only one is a finding,
// so a rendering that raised an alarm on the configured one would be wrong
// even with a perfectly correct verdict behind it.
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IPDTierGates, IPDTierRow, PDTier, PDTierMixReport, Tier0Reconciliation} from 'observability/pdTiers';
import PDTierMixPanel from './PDTierMixPanel';

const OPEN_ALL: IPDTierGates = {pdDisagg: true, cacheAware: true, kvExact: true};
const PD_ONLY: IPDTierGates = {pdDisagg: true, cacheAware: false, kvExact: false};
const NO_PD: IPDTierGates = {pdDisagg: false, cacheAware: false, kvExact: false};

const row = (tier: PDTier, over: Partial<IPDTierRow> = {}): IPDTierRow => ({
	tier,
	rate: {kind: 'ok', perSecond: 0, intervalMs: 10_000},
	share: {kind: 'ok', ratio: 0},
	total: 0,
	reachable: true,
	...over,
});

const ok = (over: Partial<Extract<PDTierMixReport, {kind: 'ok'}>> = {}): PDTierMixReport => ({
	kind: 'ok',
	tiers: [row('tier0'), row('tier1'), row('tier15'), row('tier2', {share: {kind: 'ok', ratio: 1}, total: 40})],
	totalRate: {kind: 'ok', perSecond: 4, intervalMs: 10_000},
	affinityShare: {kind: 'ok', ratio: 0},
	verdict: 'configured-no-reuse',
	byModel: [],
	reconciliation: {kind: 'agrees', selections: 0},
	...over,
});

// Vocabulary that tells an operator something is WRONG with their gateway.
// None of it may appear on a mix that is behaving exactly as configured.
//
// ⚠️ "falling through" is deliberately NOT in it, and writing this test is
// what found out why: the as-configured sentence uses that phrase to describe
// the MECHANISM ("selections falling through to min-load is the configured
// behaviour"), so matching it would have forced a neutral explanation out of
// the one state that most needs explaining. Same shape as the JWKS panel's
// "outage" exclusion — the regex may only match what asserts a PRESENT fault,
// which here is the imperative to go fix something.
const FAULT_WORDS = /cold cache|check that|unreliable|dropping increments/i;

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('the two correct readings of an all-Tier-2 mix', () => {
	it('⭐ does not report a fault when neither affinity gate is open', () => {
		// The datapath never attempts Tier-1 or Tier-1.5 here, so 0% affinity
		// is the configured behaviour. Warning about it would raise an alarm
		// on a correct gateway — the whole reason this panel reads REST.
		render(<PDTierMixPanel report={ok({verdict: 'as-configured'})} gates={PD_ONLY} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(screen.getByText(/configured behaviour/i)).toBeTruthy();
		// It still says what to do to get affinity, which is the actionable
		// half of a non-finding.
		expect(screen.getByText(/Cache-Aware Mode/i)).toBeTruthy();
	});

	it('⭐⭐ DOES report the same mix as a finding once an affinity gate is open', () => {
		// The identical numbers, the opposite verdict: the gateway is running
		// the affinity machinery and placing nothing with it.
		render(<PDTierMixPanel report={ok({verdict: 'configured-no-reuse'})} gates={OPEN_ALL} />);
		expect(screen.getByText(FAULT_WORDS)).toBeTruthy();
		expect(screen.getByRole('alert').className).toMatch(/Warning/);
	});

	it('does not print a share when nothing was selected', () => {
		// 0/0 asserts nothing; a "0%" here would claim affinity failed on an
		// idle gateway.
		render(<PDTierMixPanel report={ok({verdict: 'no-traffic', affinityShare: {kind: 'no-traffic'}})} gates={OPEN_ALL} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(screen.getByText(/No prefill selections/i)).toBeTruthy();
	});

	it('withholds the verdict rather than guessing when the rule list is unavailable', () => {
		render(<PDTierMixPanel report={ok({verdict: 'unknown-configuration'})} gates={undefined} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(screen.getByText(/rule list is unavailable/i)).toBeTruthy();
		// The mix itself is still shown — the missing half is the judgement.
		expect(screen.getByText(/Tier 2 — min load/)).toBeTruthy();
	});
});

describe('absent series are preconditions, not errors', () => {
	it('separates "no P/D rule" from "configured but idle"', () => {
		const {unmount} = render(<PDTierMixPanel report={{kind: 'not-exported'}} gates={NO_PD} />);
		expect(screen.getByText(/once a rule runs in P\/D disaggregation mode/i)).toBeTruthy();
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		unmount();

		// Same empty exposition, different sentence: here something IS
		// configured and only traffic is missing.
		render(<PDTierMixPanel report={{kind: 'not-exported'}} gates={OPEN_ALL} />);
		expect(screen.getByText(/no prefill selection has been recorded yet/i)).toBeTruthy();
	});

	it('says a failed scrape is not a routing verdict', () => {
		render(<PDTierMixPanel report={{kind: 'unavailable'}} gates={OPEN_ALL} />);
		expect(screen.getByText(/says nothing about whether P\/D routing is working/i)).toBeTruthy();
	});

	it('labels an unreachable tier instead of colouring it as an error', () => {
		render(<PDTierMixPanel report={ok({tiers: [row('tier1', {reachable: false, total: undefined})]})} gates={PD_ONLY} />);
		expect(screen.getByText('Not enabled')).toBeTruthy();
		// ⚠️ No series at all is not the number zero.
		expect(screen.getByText('None')).toBeTruthy();
	});
});

describe('the Tier-0 reconciliation note', () => {
	const withReconciliation = (reconciliation: Tier0Reconciliation) =>
		render(<PDTierMixPanel report={ok({verdict: 'reuse-working', affinityShare: {kind: 'ok', ratio: 0.5}, reconciliation})} gates={OPEN_ALL} />);

	it('stays silent when the check passes or cannot run', () => {
		// ⚠️ A passing check is not news, and "not comparable" is the expected
		// reading on any gateway that has taken no Tier-0 selection — saying
		// so would put a caveat on every idle gateway.
		const {unmount} = withReconciliation({kind: 'agrees', selections: 9});
		expect(screen.queryByText(/disagree/i)).toBeNull();
		unmount();

		withReconciliation({kind: 'not-comparable'});
		expect(screen.queryByText(/disagree/i)).toBeNull();
	});

	it('names both numbers and scopes the blame to the counters', () => {
		withReconciliation({kind: 'disagrees', tierSelections: 9, sessionHits: 7});
		const note = screen.getByText(/disagree/i);
		expect(note.textContent).toMatch(/\b9\b/);
		expect(note.textContent).toMatch(/\b7\b/);
		// ⚠️ This is a metrics-writer defect, not an incident: it must say so
		// rather than imply traffic is being mishandled.
		expect(note.textContent).toMatch(/Admission and routing are unaffected/i);
	});
});

describe('the model column', () => {
	it('never presents the overflow bucket or model-less traffic as a model name', () => {
		render(
			<PDTierMixPanel
				report={ok({
					byModel: [
						{model: 'other', total: 10, affinityShare: {kind: 'ok', ratio: 0.5}, fallbackRate: {kind: 'ok', perSecond: 1, intervalMs: 10_000}},
						{model: '', total: 4, affinityShare: {kind: 'no-traffic'}, fallbackRate: {kind: 'ok', perSecond: 0, intervalMs: 10_000}},
					],
				})}
				gates={OPEN_ALL}
			/>,
		);
		expect(screen.getByText(/overflow bucket/i)).toBeTruthy();
		expect(screen.getByText('No model declared')).toBeTruthy();
	});
});

describe('translated surfaces', () => {
	it('renders the configured-behaviour case in Korean without borrowing failure colour', async () => {
		// ⚠️ The chip and the alert severity are built in this panel rather
		// than routed through DataTable's `type: 'state'` column, whose
		// `state_color()` defaults to 'error' for any string it does not
		// recognise and matches lowercase ENGLISH substrings. Translated text
		// through that path paints ko/ja operators red for a healthy mix.
		await i18n.changeLanguage('ko');
		render(<PDTierMixPanel report={ok({verdict: 'as-configured'})} gates={PD_ONLY} />);
		const alert = screen.getByRole('alert');
		expect(alert.className).toMatch(/Info/);
		expect(alert.className).not.toMatch(/Error|Warning/);
		await i18n.changeLanguage('en');
	});
});
