//---------------------------------------------------------
// JWKS keyset health panel — what an operator is TOLD (J3)
//---------------------------------------------------------
// The derivation is pinned in observability/jwtAuth.test.ts. This file pins
// the half that derivation cannot: the words. The panel's reason for existing
// is that a JWKS outage has two correct answers and only one is a failure, so
// a rendering that painted the recoverable one as failure would be wrong even
// with a perfectly correct state machine behind it.
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IJWKSHealth, JWKSHealthReport} from 'observability/jwtAuth';
import JWKSHealthPanel from './JWKSHealthPanel';

const health = (over: Partial<IJWKSHealth>): IJWKSHealth => ({
	profile: 'realm-a',
	label: 'realm-a',
	kind: 'healthy',
	admitting: true,
	keys: 2,
	lastSuccess: {kind: 'ok', ageSec: 30},
	refreshSuccess: {kind: 'ok', perSecond: 0.01, intervalMs: 10_000},
	refreshFailure: {kind: 'ok', perSecond: 0, intervalMs: 10_000},
	...over,
} as IJWKSHealth);

const ok = (...rows: IJWKSHealth[]): JWKSHealthReport => ({kind: 'ok', byProfile: rows});

// Vocabulary that asserts the profile is broken RIGHT NOW. None of it may
// appear on a state where the gateway is still admitting traffic.
//
// ⚠️ Deliberately present-tense, and "outage" is deliberately NOT in it: the
// last-known-good copy ends "…before the gateway's staleness cutoff turns this
// into an outage", which is the warning's whole point — it names what has not
// happened yet. Matching the bare word would have forced that sentence out and
// left the operator without the one thing they can act on.
const PRESENT_FAILURE_WORDS = /failing closed|refused|503|never fetched|keys expired/i;

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('the two correct answers to a JWKS outage', () => {
	it('⭐ does not describe a fetched-then-gone keyset as a failure', () => {
		// The gateway is serving every request on the last-known-good keyset.
		// Saying "failing"/"503" here would send an operator to fix an
		// inference plane that is working — an IdP restart reaches this state
		// routinely.
		render(<JWKSHealthPanel report={ok(health({kind: 'last-known-good', lastSuccess: {kind: 'ok', ageSec: 900}, refreshFailure: {kind: 'ok', perSecond: 0.2, intervalMs: 10_000}}))} hasProfiles />);

		expect(screen.getByText(/Admitting on last-known-good keys/)).toBeTruthy();
		expect(screen.getByText(/Admission is unaffected/)).toBeTruthy();
		expect(screen.queryByText(PRESENT_FAILURE_WORDS)).toBeNull();
		// …and it still says what is at stake, in the future tense.
		expect(screen.getByText(/before the gateway’s staleness cutoff turns this into an outage/)).toBeTruthy();
	});

	it('names the never-fetched case as the 503 outage it is', () => {
		render(<JWKSHealthPanel report={ok(health({kind: 'never-fetched', admitting: false, keys: 0, lastSuccess: {kind: 'never'}}))} hasProfiles />);

		expect(screen.getByText(/Failing closed — never fetched/)).toBeTruthy();
		expect(screen.getByText(/refused with 503/)).toBeTruthy();
		// Absent, not zero: a "0" here would read as an epoch timestamp.
		expect(screen.getByText('Never')).toBeTruthy();
	});

	it('tells the expired case apart from the never-fetched one', () => {
		// Both are 503; they need different fixes, so they must not share copy.
		render(<JWKSHealthPanel report={ok(health({kind: 'stale-cutoff', admitting: false, lastSuccess: {kind: 'ok', ageSec: 86_400}}))} hasProfiles />);

		expect(screen.getByText(/Failing closed — keys expired/)).toBeTruthy();
		expect(screen.getByText(/staleness cutoff/)).toBeTruthy();
		expect(screen.getByText('1d ago')).toBeTruthy();
	});
});

describe('states that are not health verdicts', () => {
	it('renders an unreported profile neutrally, never as broken', () => {
		render(<JWKSHealthPanel report={ok(health({kind: 'not-reported', admitting: false, keys: undefined, lastSuccess: {kind: 'never'}}))} hasProfiles />);

		expect(screen.getByText('Not reported')).toBeTruthy();
		expect(screen.queryByText(PRESENT_FAILURE_WORDS)).toBeNull();
		// No series is not a key count of zero.
		expect(screen.getByText('N/A')).toBeTruthy();
	});

	it('refuses to show health for two profiles that share a metric label', () => {
		render(<JWKSHealthPanel report={ok(health({profile: 'realm a', label: 'realm_a', kind: 'ambiguous-label', admitting: false}))} hasProfiles />);

		expect(screen.getByText('Cannot attribute')).toBeTruthy();
		expect(screen.getByText(/realm_a/)).toBeTruthy();
		expect(screen.queryByText(PRESENT_FAILURE_WORDS)).toBeNull();
	});

	it('⭐ reports an absent exposition as a precondition, not an error', () => {
		// These families are conditional-with-proven-writer. Until a profile's
		// key lifecycle runs there is nothing to export, and saying "error"
		// would blame a profile for a state that is simply not yet reached.
		render(<JWKSHealthPanel report={{kind: 'not-exported'}} hasProfiles />);

		expect(screen.getByText(/exports no JWKS keyset health/)).toBeTruthy();
		expect(screen.getByText(/still enforced as configured/)).toBeTruthy();
		expect(screen.queryByText(PRESENT_FAILURE_WORDS)).toBeNull();
	});

	it('says the panel is waiting on configuration when no profile exists yet', () => {
		render(<JWKSHealthPanel report={{kind: 'not-exported'}} hasProfiles={false} />);
		expect(screen.getByText(/appears here once a JWT auth profile is configured/)).toBeTruthy();
	});

	it('⭐ does not let a failed scrape read as a profile fault', () => {
		render(<JWKSHealthPanel report={{kind: 'unavailable'}} hasProfiles />);

		expect(screen.getByText(/the metrics scrape did not answer/)).toBeTruthy();
		expect(screen.getByText(/says nothing about whether they are working/)).toBeTruthy();
		expect(screen.queryByText(PRESENT_FAILURE_WORDS)).toBeNull();
	});
});

describe('clock skew', () => {
	it('says the clocks disagree instead of printing a negative or future age', () => {
		render(<JWKSHealthPanel report={ok(health({lastSuccess: {kind: 'clock-skew', aheadSec: 3600}}))} hasProfiles />);

		expect(screen.getByText('Clock skew')).toBeTruthy();
		// Still admitting: a skewed clock is not a keyset failure.
		expect(screen.getByText('Admitting')).toBeTruthy();
	});
});

describe('the table itself', () => {
	it('renders one row per configured profile, in the order given', () => {
		render(
			<JWKSHealthPanel
				report={ok(health({profile: 'alpha'}), health({profile: 'beta', kind: 'never-fetched', admitting: false, lastSuccess: {kind: 'never'}}))}
				hasProfiles
			/>,
		);
		const rows = screen.getAllByRole('row').slice(1) as HTMLTableRowElement[]; // drop the header
		expect(rows.map(r => r.cells[0].textContent)).toEqual(['alpha', 'beta']);
	});

	it('renders a degenerate refresh rate in the shared vocabulary, never as 0/s', () => {
		render(<JWKSHealthPanel report={ok(health({refreshSuccess: {kind: 'insufficient-samples'}, refreshFailure: {kind: 'gap'}}))} hasProfiles />);
		expect(screen.getByText('Warming up…')).toBeTruthy();
		expect(screen.getByText('Gap in samples')).toBeTruthy();
	});
});
