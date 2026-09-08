import {describe, expect, it} from 'vitest';
import capabilityMap from '../api/gen/loxilb-capability-map.json';
import {
	allObservabilityEntries,
	applicableEntries,
	getObservabilityEntry,
	isEntryApplicable,
	ObservabilityEntryId,
} from './capabilityRegistry';
import {isGatewayScrapeFamily} from './metricManifest';

// Exercised against the REAL vendored manifest and generated capability map:
// every requirement an entry declares must be provable from a contract
// artifact, and the known off-scrape look-alike families must appear nowhere.

const GATEWAY_IDS: ObservabilityEntryId[] = [
	'dashboard.gwAiEvents',
	'dashboard.gwActiveStreams',
	'dashboard.gwWorkerFreshness',
	'dashboard.gwKvExactNonReady',
	'dashboard.gwPersistenceFailures',
	'page.aiTraffic',
	'page.workers',
	'page.pdKv',
	'page.security',
	'page.qos',
	'page.persistence',
];

describe('registry contract against the vendored artifacts', () => {
	it('references only gateway-scrape families (manifest-proven)', () => {
		for (const entry of allObservabilityEntries()) {
			for (const name of entry.metricFamilies) {
				expect(isGatewayScrapeFamily(name), `${entry.id} → ${name}`).toBe(true);
			}
		}
	});

	it('references only REST paths the capability map declares gateway-only', () => {
		// All three REST surfaces the registry uses are gateway additions; if a
		// re-vendor ever drops one from the spec, this pins the breakage here
		// rather than at runtime.
		const declared: string[] = capabilityMap.gatewayOnlyPaths;
		for (const entry of allObservabilityEntries()) {
			for (const p of entry.restPaths) {
				expect(declared, `${entry.id} → ${p}`).toContain(p);
			}
		}
	});

	it('never references the off-scrape look-alike families', () => {
		// loxilb_kv_fetch_* (standalone KV agent) and loxilb_pd_ctrl_*
		// (aictrl bridge) look gateway-relevant but are scraped elsewhere;
		// go_*/process_*/promhttp_* are dependency families outside the
		// contract. None may appear in any entry.
		const forbidden = /^(loxilb_kv_fetch_|loxilb_kv_evictions_|loxilb_kv_bytes_|loxilb_kv_agent_|loxilb_pd_ctrl_|go_|process_|promhttp_)/;
		for (const entry of allObservabilityEntries()) {
			for (const name of entry.metricFamilies) {
				expect(name, `${entry.id} must not register ${name}`).not.toMatch(forbidden);
			}
		}
	});

	it('pins the per-page family-set sizes from the verified data-source matrix', () => {
		const size = (id: ObservabilityEntryId) => getObservabilityEntry(id)!.metricFamilies.length;
		expect(size('dashboard.gwAiEvents')).toBe(4);
		expect(size('page.aiTraffic')).toBe(16);
		expect(size('page.pdKv')).toBe(47);
		expect(size('page.security')).toBe(27);
		expect(size('page.qos')).toBe(8);
		expect(size('page.persistence')).toBe(10);
		expect(size('page.haSync')).toBe(13);
	});
});

describe('deny-by-default applicability', () => {
	it('answers false for an id the registry does not know', () => {
		expect(isEntryApplicable('page.doesNotExist' as ObservabilityEntryId, 'inference-gateway')).toBe(false);
		expect(getObservabilityEntry('page.doesNotExist' as ObservabilityEntryId)).toBeUndefined();
	});

	it('denies everything when no instance flavor is available at all', () => {
		expect(applicableEntries(undefined)).toEqual([]);
		for (const entry of allObservabilityEntries()) {
			expect(isEntryApplicable(entry.id, undefined)).toBe(false);
		}
	});

	it('exposes only the common cards on plain loxilb (fail-narrow effective flavor)', () => {
		// The fail-narrow rule maps an unresolved flavor to 'loxilb', so this
		// is also the answer while the /version probe is in flight: zero
		// gateway-only surface.
		expect(applicableEntries('loxilb')).toEqual(['dashboard.commonCards']);
		for (const id of GATEWAY_IDS) {
			expect(isEntryApplicable(id, 'loxilb'), id).toBe(false);
		}
	});

	it('grants the gateway every non-topology entry', () => {
		const applicable = applicableEntries('inference-gateway');
		expect(applicable).toContain('dashboard.commonCards');
		for (const id of GATEWAY_IDS) expect(applicable, id).toContain(id);
		expect(applicable).not.toContain('page.haSync');
	});
});

describe('topology gating (unknown ⇒ non-applicable)', () => {
	it('hides HA Sync while no topology delivery contract exists', () => {
		// No ProductLock→UI delivery contract exists today, so callers cannot
		// supply a topology input — and absence must read as non-applicable,
		// never as "assume multi-node".
		expect(isEntryApplicable('page.haSync', 'inference-gateway')).toBe(false);
	});

	it('hides HA Sync for the evidenced single-gateway tuple', () => {
		expect(isEntryApplicable('page.haSync', 'inference-gateway', {gatewayCount: 1})).toBe(false);
	});

	it('shows HA Sync only with proven multi-gateway topology on the gateway flavor', () => {
		expect(isEntryApplicable('page.haSync', 'inference-gateway', {gatewayCount: 2})).toBe(true);
		expect(applicableEntries('inference-gateway', {gatewayCount: 2})).toContain('page.haSync');
		// Topology alone never overrides the flavor requirement.
		expect(isEntryApplicable('page.haSync', 'loxilb', {gatewayCount: 2})).toBe(false);
		expect(isEntryApplicable('page.haSync', undefined, {gatewayCount: 2})).toBe(false);
	});
});

describe('additive-unknown safety', () => {
	it('a manifest family no entry references has no effect on applicability', () => {
		// The registry is an explicit allowlist: families exist in the
		// manifest that no entry lists (e.g. loxilb_ai_keyed_services,
		// loxilb_ai_llamacpp_probe_warnings_total). Their presence must not
		// surface anywhere.
		const referenced = new Set(allObservabilityEntries().flatMap(e => [...e.metricFamilies]));
		expect(referenced.has('loxilb_ai_keyed_services')).toBe(false);
		expect(isGatewayScrapeFamily('loxilb_ai_keyed_services')).toBe(true);
		// … and being on the scrape without being referenced changes no answer:
		expect(applicableEntries('loxilb')).toEqual(['dashboard.commonCards']);
	});
});
