import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {absenceReading, explainAbsence, valueTrust} from './familyActivation';
import {getManifestFamily} from './metricManifest';
import {parseExposition} from './parser';

function snapshotOf(text: string, failure?: IMetricsSnapshot['failure']): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs: 1_700_000_000_000,
		available: true,
		failure,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

//---------------------------------------------------------
// Real families, chosen for what they prove
//---------------------------------------------------------
// Named rather than synthesised: the whole point of this module is that the
// VENDORED manifest answers these questions, so a fixture would test the
// fixture. Each is asserted to still have the shape it was picked for, so a
// re-vendor that changes it fails here instead of quietly weakening the test.
const EAGER_UNCONDITIONAL = 'loxilb_pd_admission_shed_total';
const EAGER_WITH_PRECONDITION = 'loxilb_ai_jwks_keys';
const LAZY_UNCONDITIONAL = 'loxilb_proxy_qos_bytes_passed_total';
// Eager and unconditional, but its writer has never been verified to fire.
const WRITER_MAPPED_EAGER = 'loxilb_active_conntrack_entries';
// ⭐ LAZY *and* carrying a precondition — 76 gateway-scrape families are this
// shape, and they are what makes the precondition-first ordering load-bearing
// for the majority rather than just for the 14 eager ones.
const LAZY_WITH_PRECONDITION = 'loxilb_ai_active_streams';

describe('the families these tests stand on still have the shape they were picked for', () => {
	it('holds an eager unconditional, an eager conditional, and a lazy one', () => {
		expect(getManifestFamily(EAGER_UNCONDITIONAL)?.activationKind).toBe('eager');
		expect(getManifestFamily(EAGER_UNCONDITIONAL)?.activationPrecondition).toBe('');

		// ⭐⭐ The whole reason absenceReading checks the precondition FIRST.
		expect(getManifestFamily(EAGER_WITH_PRECONDITION)?.activationKind).toBe('eager');
		expect(getManifestFamily(EAGER_WITH_PRECONDITION)?.activationPrecondition.trim().length).toBeGreaterThan(0);

		expect(getManifestFamily(LAZY_UNCONDITIONAL)?.activationKind).toBe('lazy');
		expect(getManifestFamily(LAZY_UNCONDITIONAL)?.activationPrecondition).toBe('');

		// Eager + unconditional + never verified: the case that proves the
		// absence reading and the trust reading are separate answers.
		expect(getManifestFamily(WRITER_MAPPED_EAGER)?.activationKind).toBe('eager');
		expect(getManifestFamily(WRITER_MAPPED_EAGER)?.activationPrecondition).toBe('');
		expect(getManifestFamily(WRITER_MAPPED_EAGER)?.implementationStatus).toBe('writer-mapped');

		expect(getManifestFamily(LAZY_WITH_PRECONDITION)?.activationKind).toBe('lazy');
		expect(getManifestFamily(LAZY_WITH_PRECONDITION)?.activationPrecondition.trim().length).toBeGreaterThan(0);
	});
});

describe('absenceReading — is absence expected?', () => {
	it('⭐⭐ reads an EAGER family with a precondition as conditional, not as a fault', () => {
		// The trap this ordering exists for. `loxilb_ai_jwks_keys` is
		// registered at init but emits one series per configured JWT profile,
		// so with no profile it is legitimately absent. Reading the activation
		// code first would call that an export defect — the exact false alarm
		// Stage 3.1 already paid for.
		const reading = absenceReading(EAGER_WITH_PRECONDITION);
		expect(reading.kind).toBe('conditional');
		if (reading.kind !== 'conditional') throw new Error('narrowing');
		// It carries the manifest's own operator-facing prose.
		expect(reading.precondition).toMatch(/JWT auth profile/i);
	});

	it('⭐⭐ reads an EAGER unconditional family as unexpected', () => {
		// Registered at init with nothing to wait for, and still missing: an
		// export or version gap, and the one reading that means something is
		// wrong rather than merely unused.
		expect(absenceReading(EAGER_UNCONDITIONAL)).toEqual({kind: 'unexpected'});
	});

	it('reads a lazy family as expected until used', () => {
		expect(absenceReading(LAZY_UNCONDITIONAL)).toEqual({kind: 'until-used'});
	});

	it('⭐⭐ prefers the precondition over "until used" for a LAZY conditional family', () => {
		// The ordering guard's majority case — 76 gateway-scrape families are
		// lazy AND carry a precondition. Both readings are benign, but only
		// `conditional` carries the manifest's operator-facing text saying
		// WHAT to configure; falling through to `until-used` would silently
		// throw that away and tell an operator to just wait.
		//
		// ⚠️ This test exists because a mutation that moved the precondition
		// check inside the `eager` arm passed the whole suite: the eager-only
		// tests could not tell the two orderings apart.
		const reading = absenceReading(LAZY_WITH_PRECONDITION);
		expect(reading.kind).toBe('conditional');
		if (reading.kind !== 'conditional') throw new Error('narrowing');
		expect(reading.precondition).toMatch(/streaming/i);
	});

	it('⚠️ denies a name the manifest does not list', () => {
		// Registry drift, not an explained absence — so it must not be
		// captioned as a benign "appears once used".
		expect(absenceReading('loxilb_not_a_real_family')).toEqual({kind: 'not-in-manifest'});
	});

	it('⚠️⚠️ does not excuse an UNVERIFIED eager family as expected-absent', () => {
		// ⭐ The orthogonality this module is built on, tested on a real
		// `writer-mapped` family that is eager and unconditional
		// (63 of them exist). Its writer has never been proven to fire — but
		// it is registered exactly as eagerly as a verified one, so its
		// ABSENCE is still an export gap. If implementation status leaked into
		// this reading, it would be captioned "unproven" and the gap hidden.
		const name = WRITER_MAPPED_EAGER;
		expect(getManifestFamily(name)?.implementationStatus).toBe('writer-mapped');
		expect(getManifestFamily(name)?.activationKind).toBe('eager');
		expect(absenceReading(name)).toEqual({kind: 'unexpected'});
		// And the trust reading DOES see it — the two are separate answers.
		expect(valueTrust(name)).toBe('unverified');
	});
});

describe('valueTrust — is a PRESENT value worth trusting?', () => {
	it('treats a proven writer as verified even when it is conditional', () => {
		// `conditional-with-proven-writer` HAS a proven writer; the condition
		// is already reported through absenceReading, so it must not discount
		// the value a second time.
		expect(getManifestFamily(EAGER_WITH_PRECONDITION)?.implementationStatus).toBe('conditional-with-proven-writer');
		expect(valueTrust(EAGER_WITH_PRECONDITION)).toBe('verified');
	});

	it('treats a runtime-verified family as verified', () => {
		expect(getManifestFamily(EAGER_UNCONDITIONAL)?.implementationStatus).toBe('verified-runtime');
		expect(valueTrust(EAGER_UNCONDITIONAL)).toBe('verified');
	});

	it('reports a writer that was never proven to fire as unverified', () => {
		expect(valueTrust(WRITER_MAPPED_EAGER)).toBe('unverified');
	});

	it('denies an unlisted family', () => {
		expect(valueTrust('loxilb_not_a_real_family')).toBe('unknown');
	});
});

describe('explainAbsence — summarising a panel', () => {
	it('says nothing when every family the panel needs is present', () => {
		// The panel's emptiness is then about samples or selectors, and a
		// contract explanation would misattribute it.
		const snapshot = snapshotOf(`${EAGER_UNCONDITIONAL} 0\n${LAZY_UNCONDITIONAL}{vip="1.1.1.1",port="80",proto="tcp",direction="upload"} 5`);
		expect(explainAbsence([EAGER_UNCONDITIONAL, LAZY_UNCONDITIONAL], snapshot)).toBeUndefined();
	});

	it('⚠️ says nothing on a failed scrape', () => {
		// A transport failure is already reported by the view state. Dressing
		// it up as a configuration precondition would send an operator after
		// the wrong thing.
		const failed = snapshotOf('', {
			status: 'unavailable',
			code: 'metrics.scrape',
			localeKey: 'status.unavailable',
			retryable: true,
		});
		expect(explainAbsence([EAGER_UNCONDITIONAL], failed)).toBeUndefined();
		expect(explainAbsence([EAGER_UNCONDITIONAL], undefined)).toBeUndefined();
	});

	it('⭐ lets the alarming reading win over a benign one', () => {
		// A panel whose lazy family is merely unused AND whose eager family is
		// missing must report the eager gap: burying it under "appears once
		// used" is how a real export defect stays invisible.
		const explanation = explainAbsence([LAZY_UNCONDITIONAL, EAGER_UNCONDITIONAL], snapshotOf(''));
		expect(explanation?.reading.kind).toBe('unexpected');
		expect(explanation?.absentFamilies).toEqual([LAZY_UNCONDITIONAL, EAGER_UNCONDITIONAL]);
		expect(explanation?.presentCount).toBe(0);
	});

	it('⭐ prefers a precondition to a bare until-used when nothing is alarming', () => {
		// Between two benign readings, the one carrying operator-facing text
		// is the more useful caption.
		const explanation = explainAbsence([LAZY_UNCONDITIONAL, EAGER_WITH_PRECONDITION], snapshotOf(''));
		expect(explanation?.reading.kind).toBe('conditional');
	});

	it('counts what IS present alongside what is missing', () => {
		const snapshot = snapshotOf(`${EAGER_UNCONDITIONAL} 0`);
		const explanation = explainAbsence([EAGER_UNCONDITIONAL, LAZY_UNCONDITIONAL], snapshot);
		expect(explanation?.absentFamilies).toEqual([LAZY_UNCONDITIONAL]);
		expect(explanation?.presentCount).toBe(1);
		expect(explanation?.reading.kind).toBe('until-used');
	});

	it('⚠️ treats a present-but-empty family as present, not absent', () => {
		// A declared family with zero samples is a different situation from a
		// family missing from the scrape, and only the second has a contract
		// explanation. Conflating them is what the QoS page's presence
		// classifier already keeps apart.
		const declaredEmpty = snapshotOf(`# HELP ${LAZY_UNCONDITIONAL} x\n# TYPE ${LAZY_UNCONDITIONAL} counter`);
		expect(explainAbsence([LAZY_UNCONDITIONAL], declaredEmpty)).toBeUndefined();
	});
});
