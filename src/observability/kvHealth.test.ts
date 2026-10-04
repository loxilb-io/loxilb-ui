import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {kvAttestation, kvSubscribers} from './kvHealth';
import {parseExposition} from './parser';

const T1 = 1_700_000_000_000;

function snapshotOf(text: string, failure?: IMetricsSnapshot['failure']): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs: T1, available: true, failure, families: parsed.families, diagnostics: parsed.diagnostics};
}

const FAILED: IMetricsSnapshot['failure'] = {status: 'unavailable', code: 'metrics.scrape', localeKey: 'status.unavailable', retryable: true};

describe('kvAttestation', () => {
	it('is unavailable without a snapshot or on a failed scrape', () => {
		expect(kvAttestation(undefined).kind).toBe('unavailable');
		expect(kvAttestation(snapshotOf('loxilb_ai_kv_attest_state{rule="a",state="READY"} 1', FAILED)).kind).toBe('unavailable');
	});

	it('says no controller runs when the ladder family is absent', () => {
		// ⚠️ Not "0 rules, 0 faults": absence here means no strict rule, or a
		// contract not yet installed, and the scrape cannot tell which.
		expect(kvAttestation(snapshotOf('loxilb_pd_sessions_active 0')).kind).toBe('not-running');
	});

	it('counts rules at any ladder position, not only READY', () => {
		const r = kvAttestation(
			snapshotOf(
				[
					'loxilb_ai_kv_attest_state{rule="a",state="READY"} 1',
					'loxilb_ai_kv_attest_state{rule="b",state="PROFILE_VALIDATED"} 1',
					'loxilb_ai_kv_attest_state{rule="c",state="DEGRADED"} 1',
				].join('\n'),
			),
		);
		expect(r).toMatchObject({kind: 'ok', rules: 3});
	});

	it('counts a rule once even if a scrape catches two state series for it', () => {
		// The setter deletes the old state's series before setting the new one;
		// counting series rather than rules would double-count across that gap.
		const r = kvAttestation(
			snapshotOf(['loxilb_ai_kv_attest_state{rule="a",state="READY"} 1', 'loxilb_ai_kv_attest_state{rule="a",state="DEGRADED"} 1'].join('\n')),
		);
		expect(r).toMatchObject({kind: 'ok', rules: 1});
	});

	it('⭐ reads an absent fault family as unreported, never as zero faults', () => {
		const r = kvAttestation(snapshotOf('loxilb_ai_kv_attest_state{rule="a",state="READY"} 1'));
		expect(r).toMatchObject({kind: 'ok', rules: 1, faulted: undefined});
	});

	it('counts only raised fault gauges, so a true zero is zero', () => {
		const text = (a: number, b: number) =>
			[
				'loxilb_ai_kv_attest_state{rule="a",state="READY"} 1',
				'loxilb_ai_kv_attest_state{rule="b",state="READY"} 1',
				`loxilb_ai_kv_enforcement_fault{rule="a"} ${a}`,
				`loxilb_ai_kv_enforcement_fault{rule="b"} ${b}`,
			].join('\n');
		expect(kvAttestation(snapshotOf(text(1, 0)))).toMatchObject({faulted: 1});
		expect(kvAttestation(snapshotOf(text(0, 0)))).toMatchObject({faulted: 0});
	});

	it('sums probe failures over reasons as a lifetime total, and leaves them undefined with no child', () => {
		// A lazy CounterVec{reason}: a clean ladder creates no child. A rate
		// over that could only say "warming up", forever.
		const base = 'loxilb_ai_kv_attest_state{rule="a",state="READY"} 1';
		expect(kvAttestation(snapshotOf(base))).toMatchObject({probeFailures: undefined});
		const r = kvAttestation(
			snapshotOf([base, 'loxilb_ai_kv_attest_probe_fail_total{reason="x"} 2', 'loxilb_ai_kv_attest_probe_fail_total{reason="y"} 3'].join('\n')),
		);
		expect(r).toMatchObject({probeFailures: 5});
	});
});

describe('kvSubscribers', () => {
	it('is unavailable without a snapshot or on a failed scrape, and none with no subscriber series', () => {
		expect(kvSubscribers(undefined).kind).toBe('unavailable');
		expect(kvSubscribers(snapshotOf('loxilb_kv_inventory_fresh{service="1",ep="0"} 1', FAILED)).kind).toBe('unavailable');
		expect(kvSubscribers(snapshotOf('loxilb_pd_sessions_active 0')).kind).toBe('none');
	});

	it('counts fresh subscribers and lists only the ones that are not', () => {
		const r = kvSubscribers(
			snapshotOf(
				[
					'loxilb_kv_inventory_fresh{service="1",ep="0"} 1',
					'loxilb_kv_inventory_fresh{service="1",ep="1"} 0',
					'loxilb_kv_subscriber_last_event_timestamp_seconds{service="1",ep="1"} 1700000000',
				].join('\n'),
			),
		);
		expect(r).toMatchObject({kind: 'ok', total: 2, fresh: 1});
		expect(r.kind === 'ok' && r.notFresh).toEqual([{service: '1', epIdx: '1', lastEventSec: 1700000000, fresh: 0}]);
	});

	it('⭐ counts a subscriber that stamped an event but reports no freshness as NOT fresh', () => {
		// A missing flag is unproven. Counting it fresh would put it in the
		// healthy total with nothing measured.
		const r = kvSubscribers(snapshotOf('loxilb_kv_subscriber_last_event_timestamp_seconds{service="1",ep="4"} 1700000000'));
		expect(r).toMatchObject({kind: 'ok', total: 1, fresh: 0});
		expect(r.kind === 'ok' && r.notFresh[0].fresh).toBeUndefined();
	});

	it('⭐ includes a subscriber that runs but never delivered an event', () => {
		// The last-event stamp appears only once a publisher delivers, so
		// reading that family alone would drop this endpoint from the count.
		const r = kvSubscribers(snapshotOf('loxilb_kv_inventory_fresh{service="1",ep="7"} 0'));
		expect(r).toMatchObject({kind: 'ok', total: 1, fresh: 0});
		expect(r.kind === 'ok' && r.notFresh[0]).toEqual({service: '1', epIdx: '7', lastEventSec: undefined, fresh: 0});
	});

	it('does not merge the same ep_idx across services', () => {
		const r = kvSubscribers(snapshotOf(['loxilb_kv_inventory_fresh{service="1",ep="0"} 1', 'loxilb_kv_inventory_fresh{service="2",ep="0"} 0'].join('\n')));
		expect(r).toMatchObject({kind: 'ok', total: 2, fresh: 1});
	});

	it('orders the stale list by service, then numeric ep_idx', () => {
		const r = kvSubscribers(
			snapshotOf(
				[
					'loxilb_kv_inventory_fresh{service="1",ep="10"} 0',
					'loxilb_kv_inventory_fresh{service="1",ep="2"} 0',
					'loxilb_kv_inventory_fresh{service="0",ep="5"} 0',
				].join('\n'),
			),
		);
		expect(r.kind === 'ok' && r.notFresh.map(n => `${n.service}/${n.epIdx}`)).toEqual(['0/5', '1/2', '1/10']);
	});
});
