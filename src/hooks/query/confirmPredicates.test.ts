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
import {apiKeyCreateDiff} from './confirmPredicates';
import {IServiceConfiguration} from 'types/load_balancer';
import {IEndpointItem} from 'types/endpoint';
import {
	endpointAppeared,
	endpointsGone,
	jwtProfileApplied,
	jwtProfileGone,
	lbRuleAppeared,
	lbRulesGone,
	rateLimitDefaultsApplied,
	rateLimitDefaultsGone,
	tenantRateLimitApplied,
	userRateLimitApplied,
} from 'hooks/query/confirmPredicates';

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

describe('tenant quota is confirmed by value, on the tenant\'s own read', () => {
	const sent = {tenant_id: 'acme', rps: 50, tokens_per_min: 60000, burst_pct: 0, model_limits: [{model: 'gpt-large', tokens_per_min: 9000}]};

	it('an existing entry still holding the old numbers does not confirm an update', () => {
		const stale = {tenant_id: 'acme', rps: 10, tokens_per_min: 60000, model_limits: [{model: 'gpt-large', tokens_per_min: 9000}]};
		expect(tenantRateLimitApplied(sent)(stale)).toBe(false);
	});

	it('an existing entry still holding the old model quota does not confirm an update', () => {
		const stale = {tenant_id: 'acme', rps: 50, tokens_per_min: 60000, model_limits: [{model: 'gpt-large', tokens_per_min: 100}]};
		expect(tenantRateLimitApplied(sent)(stale)).toBe(false);
	});

	it('confirms when the zero it sent reads back absent and the model list is in another order', () => {
		const both = {...sent, model_limits: [{model: 'gpt-large', tokens_per_min: 9000}, {model: 'gpt-small', tokens_per_min: 500}]};
		const served = {tenant_id: 'acme', rps: 50, tokens_per_min: 60000, model_limits: [{model: 'gpt-small', tokens_per_min: 500}, {model: 'gpt-large', tokens_per_min: 9000}]};
		expect(tenantRateLimitApplied(both)(served)).toBe(true);
	});

	it('a model the write did not name is left out of the comparison, because the upsert leaves it alone', () => {
		const served = {tenant_id: 'acme', rps: 50, tokens_per_min: 60000, model_limits: [{model: 'gpt-large', tokens_per_min: 9000}, {model: 'untouched', tokens_per_min: 1}]};
		expect(tenantRateLimitApplied(sent)(served)).toBe(true);
	});

	it('a removal sent as a zero quota confirms only once that model is gone', () => {
		const removal = {tenant_id: 'acme', rps: 50, tokens_per_min: 60000, model_limits: [{model: 'gpt-large', tokens_per_min: 0}]};
		const stillThere = {tenant_id: 'acme', rps: 50, tokens_per_min: 60000, model_limits: [{model: 'gpt-large', tokens_per_min: 9000}]};
		const gone = {tenant_id: 'acme', rps: 50, tokens_per_min: 60000, model_limits: null};
		expect(tenantRateLimitApplied(removal)(stillThere)).toBe(false);
		expect(tenantRateLimitApplied(removal)(gone)).toBe(true);
	});

	it('a burst percentage that did not change is not confirmed', () => {
		const served = {tenant_id: 'acme', rps: 50, tokens_per_min: 60000, burst_pct: 150, model_limits: [{model: 'gpt-large', tokens_per_min: 9000}]};
		expect(tenantRateLimitApplied(sent)(served)).toBe(false);
	});

	it('a missing entry (the read answered 404) never confirms', () => {
		expect(tenantRateLimitApplied(sent)(null)).toBe(false);
	});

	it('compares the identifier the connector sends, which is trimmed', () => {
		const served = {tenant_id: 'acme', rps: 50, tokens_per_min: 60000, model_limits: [{model: 'gpt-large', tokens_per_min: 9000}]};
		expect(tenantRateLimitApplied({...sent, tenant_id: ' acme '})(served)).toBe(true);
	});
});

describe('user quota is confirmed by value, on the user\'s own read', () => {
	const sent = {tenant_id: 'acme', user_id: 'alice', rps: 5, burst_size: 0, tokens_per_min: 0, model_limits: [{model: 'gpt-large', tokens_per_min: 700}]};
	const landed = {tenant_id: 'acme', user_id: 'alice', rps: 5, model_limits: [{model: 'gpt-large', tokens_per_min: 700}]};

	it('confirms a landed write whose zero fields read back absent', () => {
		expect(userRateLimitApplied(sent)(landed)).toBe(true);
	});

	it('an existing entry still holding the old numbers does not confirm an update', () => {
		expect(userRateLimitApplied(sent)({...landed, rps: 1})).toBe(false);
		expect(userRateLimitApplied(sent)({...landed, tokens_per_min: 4000})).toBe(false);
	});

	it('a model row that should have been replaced away does not confirm', () => {
		// The model set is replaced as a whole, so a survivor means the replace has not landed.
		const survivor = {...landed, model_limits: [{model: 'gpt-large', tokens_per_min: 700}, {model: 'old-model', tokens_per_min: 10}]};
		expect(userRateLimitApplied(sent)(survivor)).toBe(false);
	});

	it('clearing every model row confirms on null as well as on an empty list', () => {
		const cleared = {...sent, model_limits: []};
		expect(userRateLimitApplied(cleared)({tenant_id: 'acme', user_id: 'alice', rps: 5, model_limits: null})).toBe(true);
		expect(userRateLimitApplied(cleared)({tenant_id: 'acme', user_id: 'alice', rps: 5, model_limits: []})).toBe(true);
		expect(userRateLimitApplied(cleared)(landed)).toBe(false);
	});

	it('another user, or the same user under another tenant, never confirms', () => {
		expect(userRateLimitApplied(sent)({...landed, user_id: 'bob'})).toBe(false);
		expect(userRateLimitApplied(sent)({...landed, tenant_id: 'other'})).toBe(false);
		expect(userRateLimitApplied(sent)(null)).toBe(false);
	});
});

describe('JWT profile is confirmed by value', () => {
	const sent = {name: 'keycloak', issuer: 'https://idp.example/realms/a', audiences: ['api', 'web'], model_authz: 'allow-all' as const, default_tenant: '', forward_identity: true};

	it('an existing profile still holding the old issuer does not confirm a replace', () => {
		expect(jwtProfileApplied(sent)([{...sent, issuer: 'https://idp.example/realms/OLD'}])).toBe(false);
	});

	it.each([
		['audiences', {audiences: ['api']}],
		['algs', {algs: ['RS512']}],
		['leeway_sec', {leeway_sec: 120}],
		['tenant_claim', {tenant_claim: 'org'}],
		['models_claim', {models_claim: 'models'}],
		['model_authz', {model_authz: 'claims-required' as const}],
		['default_tenant', {default_tenant: 'fallback'}],
		['forward_identity', {forward_identity: false}],
		['authorization_passthrough', {authorization_passthrough: true}],
	])('a stale %s does not confirm', (_field, stale) => {
		expect(jwtProfileApplied(sent)([{...sent, ...stale}])).toBe(false);
	});

	it('a field left to its default confirms whether the gateway answers nothing, zero, null or the default itself', () => {
		const zeros = {...sent, leeway_sec: 0, refresh_sec: 0, algs: null as unknown as string[], jwks_url: '', tenant_claim: ''};
		const spelled = {...sent, leeway_sec: 30, refresh_sec: 3600, algs: ['ES256', 'RS256'], tenant_claim: 'tenant_id', user_claim: 'sub', forward_identity: true, authorization_passthrough: false};
		expect(jwtProfileApplied(sent)([zeros])).toBe(true);
		expect(jwtProfileApplied(sent)([spelled])).toBe(true);
	});

	it('an audience list in another order confirms; an emptied one does not', () => {
		expect(jwtProfileApplied(sent)([{...sent, audiences: ['web', 'api']}])).toBe(true);
		// Empty audiences SKIPS the audience check: never equal to a non-empty list.
		expect(jwtProfileApplied(sent)([{...sent, audiences: null as unknown as string[]}])).toBe(false);
		expect(jwtProfileApplied({...sent, audiences: []})([{...sent, audiences: null as unknown as string[]}])).toBe(true);
	});

	it('another profile with the same configuration does not confirm this name', () => {
		expect(jwtProfileApplied(sent)([{...sent, name: 'keycloak-2'}])).toBe(false);
	});

	it('a delete is confirmed by the exact name being absent, not by a similar one', () => {
		expect(jwtProfileGone('keycloak')([{name: 'keycloak-2'}, {name: 'Keycloak'}])).toBe(true);
		expect(jwtProfileGone('keycloak')([{name: 'keycloak'}])).toBe(false);
	});
});

describe('a new API key is compared with its own read, field by field', () => {
	const asked = {
		tenant_id: 'tenant-a',
		name: 'ci',
		allowed_models: ['llama-70b', 'qwen'],
		rate_limit_rps: 10,
		burst_size: 20,
		tokens_per_min: 1000,
		expires_at: '2027-01-01T00:00:00.000Z',
		enabled: true,
	};
	const served = {key_id: 'k1', ...asked, created_at: '2026-10-08T00:00:00Z'};

	it('finds no difference when every field reads back as sent', () => {
		expect(apiKeyCreateDiff(asked, served)).toEqual([]);
	});

	it('names each field that reads back differently, and only those', () => {
		expect(apiKeyCreateDiff(asked, {...served, tenant_id: 'tenant-b'})).toEqual(['tenant_id']);
		expect(apiKeyCreateDiff(asked, {...served, name: 'other'})).toEqual(['name']);
		expect(apiKeyCreateDiff(asked, {...served, allowed_models: ['llama-70b']})).toEqual(['allowed_models']);
		expect(apiKeyCreateDiff(asked, {...served, rate_limit_rps: 0})).toEqual(['rate_limit_rps']);
		expect(apiKeyCreateDiff(asked, {...served, burst_size: undefined})).toEqual(['burst_size']);
		expect(apiKeyCreateDiff(asked, {...served, tokens_per_min: 999})).toEqual(['tokens_per_min']);
		expect(apiKeyCreateDiff(asked, {...served, expires_at: undefined})).toEqual(['expires_at']);
		expect(apiKeyCreateDiff(asked, {...served, enabled: false})).toEqual(['enabled']);
		expect(apiKeyCreateDiff(asked, {...served, name: '', enabled: false})).toEqual(['name', 'enabled']);
	});

	it('does not hold an omitted zero, name, model list or expiry against the gateway', () => {
		// The form leaves a zero limit, a blank name, no models and no expiry out
		// of the request, and the summary leaves the same things out of its answer.
		expect(apiKeyCreateDiff({tenant_id: 'tenant-a', enabled: true}, {tenant_id: 'tenant-a', enabled: true})).toEqual([]);
		expect(apiKeyCreateDiff({tenant_id: 'tenant-a', enabled: true}, {tenant_id: 'tenant-a', enabled: true, name: '', allowed_models: null, rate_limit_rps: 0, burst_size: 0, tokens_per_min: 0})).toEqual([]);
	});

	it('reads `enabled` left out of the request as enabled', () => {
		expect(apiKeyCreateDiff({tenant_id: 'tenant-a'}, {tenant_id: 'tenant-a', enabled: true})).toEqual([]);
		expect(apiKeyCreateDiff({tenant_id: 'tenant-a'}, {tenant_id: 'tenant-a', enabled: false})).toEqual(['enabled']);
		expect(apiKeyCreateDiff({tenant_id: 'tenant-a', enabled: false}, {tenant_id: 'tenant-a', enabled: false})).toEqual([]);
	});

	it('compares an expiry as a time, to the second, not as text', () => {
		expect(apiKeyCreateDiff(asked, {...served, expires_at: '2027-01-01T09:00:00+09:00'})).toEqual([]);
		expect(apiKeyCreateDiff({...asked, expires_at: '2027-01-01T00:00:00.400Z'}, {...served, expires_at: '2027-01-01T00:00:00Z'})).toEqual([]);
		expect(apiKeyCreateDiff(asked, {...served, expires_at: '2027-01-01T00:00:01Z'})).toEqual(['expires_at']);
	});

	it('reads the Unix epoch as no expiry, which is how the gateway stores it', () => {
		expect(apiKeyCreateDiff({...asked, expires_at: '1970-01-01T00:00:00.000Z'}, {...served, expires_at: undefined})).toEqual([]);
	});

	it('reports an expiry that is not a time as a difference', () => {
		expect(apiKeyCreateDiff(asked, {...served, expires_at: 'never'})).toEqual(['expires_at']);
	});

	it('keeps the spaces of a tenant ID, which the gateway stores as sent', () => {
		expect(apiKeyCreateDiff({tenant_id: ' tenant-a '}, {tenant_id: 'tenant-a', enabled: true})).toEqual(['tenant_id']);
	});
});
