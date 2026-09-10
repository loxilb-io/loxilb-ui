import {describe, expect, it} from 'vitest';
import envelope from '../api/gen/metric-manifest.json';
import {
	allManifestFamilies,
	getManifestFamily,
	isGatewayScrapeFamily,
	manifestEnvelope,
	normalizeManifestType,
} from './metricManifest';

// Exercised against the REAL vendored manifest (src/api/gen/
// metric-manifest.json) — these tests double as the contract check that a
// re-vendor keeps the shapes the observability gating relies on. Counts are
// pinned to the manifest generation this code was verified against; a
// re-vendor that changes them must re-verify the per-page family sets before
// bumping the numbers.

describe('vendored envelope', () => {
	it('carries UI-owned provenance the upstream artifact lacks', () => {
		expect(manifestEnvelope.schemaVersion).toBe(1);
		expect(manifestEnvelope.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
		expect(manifestEnvelope.vendoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('is internally consistent with the upstream contract block', () => {
		expect(envelope.manifest.contract.total).toBe(envelope.manifest.families.length);
		expect(allManifestFamilies()).toHaveLength(envelope.manifest.contract.total);
	});
});

describe('gateway scrape applicability (class + packaged)', () => {
	it('marks exactly the packaged default class as gateway-applicable', () => {
		const applicable = allManifestFamilies().filter(f => isGatewayScrapeFamily(f.name));
		expect(applicable).toHaveLength(176);
		for (const f of applicable) {
			expect(f.class).toBe('default');
			expect(f.packaged).toBe(true);
		}
	});

	it('denies unlisted family names (deny-by-default)', () => {
		expect(isGatewayScrapeFamily('loxilb_no_such_family_total')).toBe(false);
		// Dependency families are on the scrape but are not contract families.
		expect(isGatewayScrapeFamily('go_goroutines')).toBe(false);
		expect(isGatewayScrapeFamily('process_cpu_seconds_total')).toBe(false);
		expect(isGatewayScrapeFamily('promhttp_metric_handler_requests_total')).toBe(false);
	});

	it('denies every excluded-class family, including the gateway look-alikes', () => {
		// These names LOOK like gateway families but live on other scrape
		// targets: the standalone KV agent, its health probe, and the AI
		// controller bridge. They must never become gateway-applicable.
		const traps = [
			'loxilb_kv_fetch_total',
			'loxilb_kv_fetch_errors_total',
			'loxilb_kv_bytes_transferred_total',
			'loxilb_kv_evictions_total',
			'loxilb_kv_agent_up',
			'loxilb_pd_ctrl_alpha',
			'loxilb_pd_ctrl_applied_epoch',
			'loxilb_pd_ctrl_effective_weight',
			'loxilb_pd_ctrl_mode',
			'loxilb_pd_ctrl_nacks_total',
			'loxilb_pd_ctrl_override_events_total',
			'loxilb_pd_ctrl_snapshots_applied_total',
			'loxilb_pd_ctrl_state',
		];
		for (const name of traps) {
			expect(getManifestFamily(name), `${name} should exist in the manifest`).toBeDefined();
			expect(isGatewayScrapeFamily(name), `${name} must not be gateway-applicable`).toBe(false);
		}

		const excluded = ['standalone-controller', 'standalone-kv-agent', 'kv-agent-health', 'aictrl-bridge', 'dpu-doca'];
		for (const f of allManifestFamilies()) {
			if (excluded.includes(f.class)) {
				expect(isGatewayScrapeFamily(f.name), `${f.name} (class ${f.class})`).toBe(false);
			}
		}
	});
});

describe('desc normalization (definition mechanism vs runtime type)', () => {
	it('pins the 13 custom-collector families to 4 counters + 8 gauges + 1 histogram', () => {
		const desc = allManifestFamilies().filter(f => f.definitionMechanism === 'desc');
		expect(desc.map(f => f.name).sort()).toEqual([
			'loxilb_ai_token_quota_limit_tokens',
			'loxilb_ai_token_quota_model_limit_tokens',
			'loxilb_ai_token_quota_model_utilization',
			'loxilb_ai_token_quota_utilization',
			'loxilb_proxy_http_ttfb_seconds',
			'loxilb_proxy_qos_bytes_delayed_total',
			'loxilb_proxy_qos_bytes_passed_total',
			'loxilb_proxy_qos_cbs_bytes',
			'loxilb_proxy_qos_cir_bytes_per_second',
			'loxilb_proxy_qos_park_seconds_total',
			'loxilb_proxy_qos_parked_connections',
			'loxilb_proxy_qos_parks_total',
			'loxilb_proxy_qos_tokens_bytes',
		]);

		const byType = (t: string) => desc.filter(f => f.runtimeType === t).map(f => f.name).sort();
		expect(byType('counter')).toEqual([
			'loxilb_proxy_qos_bytes_delayed_total',
			'loxilb_proxy_qos_bytes_passed_total',
			'loxilb_proxy_qos_park_seconds_total',
			'loxilb_proxy_qos_parks_total',
		]);
		expect(byType('gauge')).toEqual([
			'loxilb_ai_token_quota_limit_tokens',
			'loxilb_ai_token_quota_model_limit_tokens',
			'loxilb_ai_token_quota_model_utilization',
			'loxilb_ai_token_quota_utilization',
			'loxilb_proxy_qos_cbs_bytes',
			'loxilb_proxy_qos_cir_bytes_per_second',
			'loxilb_proxy_qos_parked_connections',
			'loxilb_proxy_qos_tokens_bytes',
		]);
		expect(byType('histogram')).toEqual(['loxilb_proxy_http_ttfb_seconds']);
	});

	it('never leaks "desc" or any other extractor token into the runtime type union', () => {
		const runtime = ['counter', 'gauge', 'histogram', 'summary', 'untyped', 'unknown'];
		for (const f of allManifestFamilies()) {
			expect(runtime, `${f.name} runtimeType ${f.runtimeType}`).toContain(f.runtimeType);
			if (f.runtimeType !== 'unknown') expect(f.rawType).toBeUndefined();
		}
		// The current vendored generation has no unknown-typed family at all.
		expect(allManifestFamilies().filter(f => f.runtimeType === 'unknown')).toEqual([]);
	});

	// Gateway 27680379 began stating the mechanism upstream instead of
	// smuggling it through `type: "desc"`. These pin that the UI reads it, and
	// that the two vocabularies coexist — a manifest vendored from an older
	// gateway must keep loading identically.
	it('takes the mechanism from upstream when the manifest declares one', () => {
		expect(normalizeManifestType('loxilb_lb_rules', 'gauge', 'promauto')).toEqual({
			runtimeType: 'gauge', definitionMechanism: 'promauto',
		});
		expect(normalizeManifestType('loxilb_kv_agent_up', 'gauge', 'manual')).toEqual({
			runtimeType: 'gauge', definitionMechanism: 'manual',
		});
		// A declared desc family now carries a real type instead of the sentinel.
		expect(normalizeManifestType('loxilb_proxy_qos_parks_total', 'counter', 'desc')).toEqual({
			runtimeType: 'counter', definitionMechanism: 'desc',
		});
	});

	it('denies when upstream contradicts a pinned custom-collector type', () => {
		// The pins were derived from the collector sources independently. If
		// upstream ever disagrees, one of the two is wrong about the wire —
		// deny rather than pick a side and compute a wrong rate from it.
		expect(normalizeManifestType('loxilb_proxy_qos_parks_total', 'gauge', 'desc')).toEqual({
			runtimeType: 'unknown', rawType: 'gauge', definitionMechanism: 'desc',
		});
	});

	it('keeps an unrecognized mechanism from widening the vocabulary', () => {
		expect(normalizeManifestType('loxilb_x', 'counter', 'someNewMechanism')).toEqual({
			runtimeType: 'counter', definitionMechanism: 'direct',
		});
		// An unusable type is still denied no matter what the mechanism says.
		expect(normalizeManifestType('loxilb_x', 'info', 'promauto')).toEqual({
			runtimeType: 'unknown', rawType: 'info', definitionMechanism: 'promauto',
		});
	});

	it('degrades unrecognized future tokens to the unknown deny sentinel', () => {
		// A future desc family the UI has not pinned yet: mechanism recorded,
		// runtime type denied until explicitly contracted.
		expect(normalizeManifestType('loxilb_future_collector_thing', 'desc')).toEqual({
			runtimeType: 'unknown', rawType: 'desc', definitionMechanism: 'desc',
		});
		// A wholly new upstream token must not widen the union.
		expect(normalizeManifestType('loxilb_whatever', 'info')).toEqual({
			runtimeType: 'unknown', rawType: 'info', definitionMechanism: 'direct',
		});
		// Known runtime tokens pass through untouched.
		expect(normalizeManifestType('loxilb_x', 'counter')).toEqual({
			runtimeType: 'counter', definitionMechanism: 'direct',
		});
		expect(normalizeManifestType('loxilb_x', 'untyped')).toEqual({
			runtimeType: 'untyped', definitionMechanism: 'direct',
		});
	});
});
