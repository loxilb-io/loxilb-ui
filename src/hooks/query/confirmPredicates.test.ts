//---------------------------------------------------------
// confirm predicates must be identities, not near-misses.
// (npm test src/hooks/query/confirmPredicates.test.ts)
//
// These pin BOTH failure directions, which pull against each other:
//
//   too LOOSE  → a sibling row satisfies the predicate, so a write that never
//                landed is reported as confirmed (false success — the exact
// class exists to remove);
//   too TIGHT  → server canonicalization (omitted zeros, null for [], defaulted
//                optionals, re-ordering) makes a landed write look absent, so
//                it is reported as pending forever (false doubt, rule 6).
//
// The LB "peers" case is not hypothetical: the gateway legitimately serves
// rules that share VIP/port/protocol and differ only by host, path, range or
// model — which is why the codebase carries canonicalLBRuleIdentity at all.
// A first cut of these predicates keyed only on VIP+port+protocol and was
// caught by the full E2E run (lb.spec.ts D-full-key): deleting the model peer
// left the model-less peer matching, so "Deleted 1 item(s) successfully" never
// appeared and the operator was told "Submitted" about a completed delete.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {IServiceConfiguration} from 'types/load_balancer';
import {IEndpointItem} from 'types/endpoint';
import {endpointAppeared, endpointsGone, lbRuleAppeared, lbRulesGone, rateLimitDefaultsApplied, rateLimitDefaultsGone} from 'hooks/query/confirmPredicates';

const lb = (args: Record<string, unknown>): IServiceConfiguration =>
	({serviceArguments: {externalIP: '203.0.113.75', port: 8475, protocol: 'tcp', ...args}, endpoints: [], secondaryIPs: [], allowedSources: []}) as unknown as IServiceConfiguration;

const ep = (item: Record<string, unknown>): IEndpointItem => item as unknown as IEndpointItem;

describe('LB confirm predicates', () => {
	const plainPeer = lb({host: 'e2e-delete.example', path_prefix: '/v1/chat'});
	const modelPeer = lb({host: 'e2e-delete.example', path_prefix: '/v1/chat', model_name: 'e2e/model-a'});

	it('a deleted rule is gone even though its model-less peer still holds the VIP/port/protocol', () => {
		// The gateway list after deleting ONLY the model peer.
		expect(lbRulesGone([modelPeer])([plainPeer])).toBe(true);
	});

	it('a rule that is still listed is NOT reported gone', () => {
		expect(lbRulesGone([modelPeer])([plainPeer, modelPeer])).toBe(false);
	});

	it('a created rule is not confirmed by a peer that merely shares VIP/port/protocol', () => {
		// Nothing was created; only the pre-existing model-less peer is listed.
		expect(lbRuleAppeared(modelPeer)([plainPeer])).toBe(false);
	});

	it('a created rule IS confirmed once its own row is listed', () => {
		expect(lbRuleAppeared(modelPeer)([plainPeer, modelPeer])).toBe(true);
	});

	it('server canonicalization does not hide a landed rule (rule 6)', () => {
		// Client submitted portMax:0 and an empty name; the gateway echoes the
		// rule back with those omitted, protocol upper-cased, order reversed.
		const submitted = lb({name: '', portMax: 0, host: 'e2e.example'});
		const returned = lb({protocol: 'TCP', host: 'e2e.example'});
		expect(lbRuleAppeared(submitted)([lb({port: 9999}), returned])).toBe(true);
	});
});

describe('endpoint confirm predicates', () => {
	const a = ep({hostName: '203.0.113.10', name: 'ep-a', probePort: 80, probeType: 'ping'});
	const b = ep({hostName: '203.0.113.10', name: 'ep-b', probePort: 8080, probeType: 'http'});

	it('deleting one endpoint is confirmed even when a same-host sibling remains', () => {
		expect(endpointsGone([a])([b])).toBe(true);
	});

	it('a still-listed endpoint is not reported gone', () => {
		expect(endpointsGone([a])([a, b])).toBe(false);
	});

	it('a created endpoint is not confirmed by a different endpoint on the same host', () => {
		expect(endpointAppeared({hostName: '203.0.113.10', name: 'ep-c'})([a, b])).toBe(false);
	});

	it('a created endpoint IS confirmed by its own row', () => {
		expect(endpointAppeared({hostName: '203.0.113.10', name: 'ep-b'})([a, b])).toBe(true);
	});

	it('an endpoint submitted without a name confirms on host alone', () => {
		// The gateway assigns the name in that case, so it cannot be compared.
		expect(endpointAppeared({hostName: '203.0.113.10'})([b])).toBe(true);
	});
});

describe('rate-limit defaults predicates (Stage 4.2b)', () => {
	const asked = {
		scope: 'global',
		default_user_rps: 0,
		default_user_tpm: 5000,
		default_tenant_rps: 0,
		default_tenant_tpm: 0,
		vip_shared_rps: 0,
		vip_shared_tpm: 0,
	};

	it('confirms a landed write whose zero fields read back ABSENT', () => {
		// ⚠️⚠️ This is the whole point. Verified live: after posting a row with
		// one positive field, the GET carried `{default_user_tpm, scope,
		// updated_at}` and NOT the five zeros. A predicate comparing
		// `row.default_user_rps === 0` would never confirm any row, because a
		// row with all six positive is exactly the row the gateway refuses.
		expect(rateLimitDefaultsApplied(asked)([{scope: 'global', default_user_tpm: 5000}])).toBe(true);
	});

	it('does not confirm when the served value differs from the asked one', () => {
		expect(rateLimitDefaultsApplied(asked)([{scope: 'global', default_user_tpm: 4000}])).toBe(false);
		// A leftover limit the write meant to clear must read as NOT applied:
		// the POST replaces the row, so a surviving field means it did not land.
		expect(rateLimitDefaultsApplied(asked)([{scope: 'global', default_user_tpm: 5000, default_tenant_rps: 9}])).toBe(false);
	});

	it('never lets one scope confirm another, nor one service confirm another', () => {
		// The global row and a rule row are different rows; so are two rule rows.
		expect(rateLimitDefaultsApplied(asked)([{scope: 'rule', rule_ident: 'svc-1', default_user_tpm: 5000}])).toBe(false);
		const ruleAsked = {...asked, scope: 'rule', rule_ident: 'svc-1'};
		expect(rateLimitDefaultsApplied(ruleAsked)([{scope: 'rule', rule_ident: 'svc-2', default_user_tpm: 5000}])).toBe(false);
		expect(rateLimitDefaultsApplied(ruleAsked)([{scope: 'rule', rule_ident: 'svc-1', default_user_tpm: 5000}])).toBe(true);
	});

	it('treats absence as the confirmation of a delete, per scope and service', () => {
		expect(rateLimitDefaultsGone('global')([{scope: 'rule', rule_ident: 'svc-1'}])).toBe(true);
		expect(rateLimitDefaultsGone('global')([{scope: 'global'}])).toBe(false);
		// A surviving sibling service must not confirm this one's removal.
		expect(rateLimitDefaultsGone('rule', 'svc-1')([{scope: 'rule', rule_ident: 'svc-2'}])).toBe(true);
		expect(rateLimitDefaultsGone('rule', 'svc-1')([{scope: 'rule', rule_ident: 'svc-1'}])).toBe(false);
	});
});
