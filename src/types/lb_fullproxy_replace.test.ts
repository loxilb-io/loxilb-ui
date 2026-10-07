import {describe, expect, it} from 'vitest';
import {buildFullproxyReplaceBody, changedFullproxyIdentity, FULLPROXY_IN_PLACE_FIELDS, fullproxyReplaceableChanges, FullproxyChangeSet, planFullproxyReplace} from './lb_fullproxy_replace';
import {LB_FIELD_CONFIRMATION} from 'hooks/query/lbRuleApplied';
import {IServiceConfiguration} from './load_balancer';

const change = (over: Partial<FullproxyChangeSet> = {}): FullproxyChangeSet => ({
	changedArguments: [],
	endpointsChanged: false,
	secondaryChanged: false,
	allowedChanged: false,
	selectors: [0, 0],
	...over,
});

describe('what a fullproxy replace does to the listener', () => {
	it('is nothing when nothing changed', () => {
		expect(planFullproxyReplace(change())).toEqual({kind: 'none'});
	});

	it('applies in place when only the admission gate, half-close or backend TLS changed', () => {
		const plan = planFullproxyReplace(change({changedArguments: ['fc_max_outstanding', 'half_close_mode', 'backend_ca_cert_id', 'mtls_backend']}));
		expect(plan.kind).toBe('apply');
	});

	// The gateway takes the in-place road only when NOTHING else changed.
	it('re-creates the listener as soon as one other field rides along', () => {
		expect(planFullproxyReplace(change({changedArguments: ['fc_max_outstanding', 'max_stream_duration_sec']})).kind).toBe('recreate');
		expect(planFullproxyReplace(change({changedArguments: ['backend_protocol']})).kind).toBe('recreate');
		expect(planFullproxyReplace(change({changedArguments: ['api_key_auth', 'jwt_auth_profile']})).kind).toBe('recreate');
	});

	it('re-creates the listener for an endpoint or allowed-source change, even alongside an in-place field', () => {
		expect(planFullproxyReplace(change({endpointsChanged: true})).kind).toBe('recreate');
		expect(planFullproxyReplace(change({allowedChanged: true})).kind).toBe('recreate');
		expect(planFullproxyReplace(change({changedArguments: ['fc_mode'], endpointsChanged: true})).kind).toBe('recreate');
	});

	it('names every changed field, lists included', () => {
		expect(planFullproxyReplace(change({changedArguments: ['backend_protocol'], endpointsChanged: true, allowedChanged: true}))).toEqual({
			kind: 'recreate',
			fields: ['serviceArguments.backend_protocol', 'endpoints', 'allowedSources'],
		});
	});

	it('does not announce a re-creation for a consistent-hash rule, before or after the edit', () => {
		expect(planFullproxyReplace(change({endpointsChanged: true, selectors: [8, 8]})).kind).toBe('apply');
		expect(planFullproxyReplace(change({changedArguments: ['sel'], selectors: [0, 10]})).kind).toBe('apply');
	});

	describe('changes the gateway cannot make on an existing rule', () => {
		it('refuses a frontend mTLS change that travels alone', () => {
			expect(planFullproxyReplace(change({changedArguments: ['mtls_frontend']}))).toMatchObject({kind: 'refused', reason: 'mtls-frontend-only'});
		});

		// With another change the gateway stores it as a side effect.
		it('lets a frontend mTLS change through when something else re-creates the listener', () => {
			expect(planFullproxyReplace(change({changedArguments: ['mtls_frontend', 'backend_protocol']})).kind).toBe('recreate');
			expect(planFullproxyReplace(change({changedArguments: ['mtls_frontend'], endpointsChanged: true})).kind).toBe('recreate');
		});

		it('refuses a rename, with or without other changes', () => {
			expect(planFullproxyReplace(change({changedArguments: ['name']}))).toMatchObject({kind: 'refused', reason: 'rename'});
			expect(planFullproxyReplace(change({changedArguments: ['name', 'fc_mode'], endpointsChanged: true}))).toMatchObject({kind: 'refused', reason: 'rename'});
		});

		it('refuses a secondary IP change before anything else', () => {
			expect(planFullproxyReplace(change({changedArguments: ['name'], secondaryChanged: true}))).toMatchObject({kind: 'refused', reason: 'secondary-ips'});
		});
	});

	// A field renamed in the contract would silently stop matching and turn an
	// in-place change into an announced re-creation.
	it('lists only fields the gateway contract declares', () => {
		for (const field of FULLPROXY_IN_PLACE_FIELDS) expect(Object.keys(LB_FIELD_CONFIRMATION), field).toContain(field);
	});
});

describe('which fullproxy rule an edit names', () => {
	const original = {externalIP: '10.0.0.1', port: 8443, protocol: 'tcp', host: 'a.example', path_prefix: '/v1', path_match_mode: 'prefix', model_name: 'm1'} as const;

	it('is the same rule when nothing in the identity moved', () => {
		expect(changedFullproxyIdentity({...original}, original)).toEqual([]);
	});

	it('is another rule when the host, path, match mode or model changed', () => {
		expect(changedFullproxyIdentity({...original, host: 'b.example'}, original)).toEqual(['host']);
		expect(changedFullproxyIdentity({...original, path_prefix: '/v2'}, original)).toEqual(['path_prefix']);
		expect(changedFullproxyIdentity({...original, path_match_mode: 'exact'}, original)).toEqual(['path_match_mode']);
		expect(changedFullproxyIdentity({...original, model_name: 'm2'}, original)).toEqual(['model_name']);
	});

	// The form materialises these over a read-back that omits them.
	it('does not take a form default over an absent field for a change', () => {
		const bare = {externalIP: '10.0.0.1', port: 8443, protocol: 'tcp'} as const;
		expect(changedFullproxyIdentity({...bare, host: '', path_prefix: '', path_match_mode: 'disabled', model_name: '', portMax: 0, protocol: 'TCP'}, bare)).toEqual([]);
		expect(changedFullproxyIdentity({...bare, portMax: 8443}, bare)).toEqual([]);
	});

	it('takes a port range that reaches past the port for a change', () => {
		expect(changedFullproxyIdentity({externalIP: '10.0.0.1', port: 8443, portMax: 8450, protocol: 'tcp'}, {externalIP: '10.0.0.1', port: 8443, protocol: 'tcp'})).toEqual(['portMax']);
	});
});

describe('the body of a fullproxy replace', () => {
	const fresh = {
		serviceArguments: {
			id: 'abc',
			managed: true,
			name: 'svc',
			externalIP: '10.0.0.1',
			port: 8443,
			protocol: 'tcp',
			mode: 4,
			security: 1,
			egress: false,
			max_stream_duration_sec: 600,
			api_key_auth: 'required',
			fc_effective: {mode: 'enforce'},
			half_close_effective: {mode: 'off', source: 'default'},
			backend_tls_effective: {status: 'applied'},
		},
		endpoints: [{endpointIP: '10.0.1.1', targetPort: 8000, weight: 1, state: 'active', counter: '0:0', ep_role: 1}],
		secondaryIPs: null,
		allowedSources: [{prefix: '10.9.0.0/16'}],
	} as unknown as IServiceConfiguration;

	// The replace clears what it leaves out: a field the operator never
	// touched has to travel, at the value the gateway holds now.
	it('carries every stored field, with only the changed ones replaced', () => {
		const body = buildFullproxyReplaceBody(fresh, {argumentsPatch: {max_stream_duration_sec: 900} as any});
		expect(body.serviceArguments).toMatchObject({name: 'svc', api_key_auth: 'required', max_stream_duration_sec: 900, security: 1, egress: false});
		expect(body.allowedSources).toEqual([{prefix: '10.9.0.0/16'}]);
		expect(body.secondaryIPs).toEqual([]);
	});

	it('leaves out what the gateway derives or observes', () => {
		const args = buildFullproxyReplaceBody(fresh, {argumentsPatch: {}}).serviceArguments as unknown as Record<string, unknown>;
		for (const field of ['id', 'managed', 'fc_effective', 'half_close_effective', 'backend_tls_effective']) expect(args, field).not.toHaveProperty(field);
	});

	it('keeps the stored endpoints without their observed state when the operator left them alone', () => {
		expect(buildFullproxyReplaceBody(fresh, {argumentsPatch: {}}).endpoints).toEqual([{endpointIP: '10.0.1.1', targetPort: 8000, weight: 1, ep_role: 1}]);
	});

	it('sends the edited lists as edited', () => {
		const endpoints = [{endpointIP: '10.0.1.2', targetPort: 8000, weight: 3}] as any;
		const body = buildFullproxyReplaceBody(fresh, {argumentsPatch: {}, endpoints, allowedSources: []});
		expect(body.endpoints).toBe(endpoints);
		expect(body.allowedSources).toEqual([]);
	});
});

// On a replace the gateway keeps an admission value the body leaves out, so
// an omission cannot carry "the operator cleared this".
describe('a blanked admission field on a replace', () => {
	it('sends a selector returned to the gateway default as inherit', () => {
		expect(fullproxyReplaceableChanges({fc_mode: undefined, fc_adaptive: '', fc_expose_headers: undefined})).toEqual({
			fc_mode: 'inherit',
			fc_adaptive: 'inherit',
			fc_expose_headers: 'inherit',
		});
	});

	it('drops a blanked number: it is no change, and never becomes a 0', () => {
		const changes = fullproxyReplaceableChanges({fc_max_outstanding: undefined, fc_max_queue_depth: ''});
		expect(changes).toEqual({});
		expect(Object.keys(changes)).toEqual([]);
	});

	it('keeps every value the operator gave, an explicit 0 included', () => {
		expect(fullproxyReplaceableChanges({fc_max_outstanding: 0, fc_mode: 'off', fc_max_queue_depth: 8})).toEqual({fc_max_outstanding: 0, fc_mode: 'off', fc_max_queue_depth: 8});
	});

	it('leaves a blank on any other field as the form gave it', () => {
		const changes = fullproxyReplaceableChanges({host: '', model_name: undefined, half_close_mode: undefined});
		expect(Object.keys(changes).sort()).toEqual(['half_close_mode', 'host', 'model_name']);
		expect(changes.host).toBe('');
	});
});
