import {describe, expect, it} from 'vitest';
import {lbServiceArgumentsPatch, selectLBEditStrategy} from './LBRulePage';
import {lbRuleRowId} from 'types/lb_identity';
import {IServiceConfiguration} from 'types/load_balancer';

describe('selectLBEditStrategy', () => {
	it('blocks same-key fullproxy edits instead of selecting the L4 merge PATCH route', () => {
		expect(
			selectLBEditStrategy({
				keyChanged: false,
				hasCompositeKey: true,
				mode: 4,
				canMergePatch: true,
			}),
		).toBe('block-fullproxy');
	});

	it('preserves merge PATCH for ordinary L4 edits when the capability is available', () => {
		expect(
			selectLBEditStrategy({
				keyChanged: false,
				hasCompositeKey: true,
				mode: 1,
				canMergePatch: true,
			}),
		).toBe('merge-patch');
	});

	it('preserves create-new-rule behavior for composite-key changes, including fullproxy', () => {
		expect(
			selectLBEditStrategy({
				keyChanged: true,
				hasCompositeKey: true,
				mode: 4,
				canMergePatch: true,
			}),
		).toBe('create');
	});
});

describe('lbServiceArgumentsPatch', () => {
	// A read-back from a newer gateway carries keys this UI does not model
	// (fc_effective with live counters, a future field). The form copies them
	// through unchanged, so they must not reach the PATCH body: the gateway's
	// restricted overlay would ignore them at best, and a widened patch is what
	// escalates an L4 edit on loxilb into delete + re-create.
	const readBack = {
		name: 'web',
		externalIP: '192.0.2.10',
		port: 80,
		protocol: 'tcp',
		inactiveTimeOut: 30,
		fc_effective: {mode: 'observe', inflight: 3, queued: 0, source: {max_outstanding: 'env'}},
		future_field: 'kept',
	};

	it('sends only the edited field when unknown read-back keys are carried through', () => {
		const edited = {...readBack, fc_effective: {...readBack.fc_effective}, inactiveTimeOut: 60};
		expect(lbServiceArgumentsPatch(edited, readBack)).toEqual({inactiveTimeOut: 60});
	});

	it('sends nothing when the form only echoes the read-back', () => {
		expect(lbServiceArgumentsPatch({...readBack}, readBack)).toEqual({});
	});

	it('never sends an immutable field, even when it differs', () => {
		expect(lbServiceArgumentsPatch({...readBack, mode: 4, security: 1, port: 81}, readBack)).toEqual({});
	});

	it('treats zero values and form defaults over an absent read-back field as no change', () => {
		const edited = {...readBack, probeTimeout: 1800, backend_protocol: 'http1', sel: 0, monitor: false, probetype: ''};
		expect(lbServiceArgumentsPatch(edited, readBack)).toEqual({});
	});

	it('treats the mTLS dropdown default over an absent read-back as no change, but not a real mode', () => {
		const disabled = {client_cert_mode: 'disabled', ca_pem: '', verify_depth: 0};
		expect(lbServiceArgumentsPatch({...readBack, mtls_frontend: disabled}, readBack)).toEqual({});
		const required = {client_cert_mode: 'required', ca_pem: 'PEM', verify_depth: 0};
		expect(lbServiceArgumentsPatch({...readBack, mtls_frontend: required}, readBack)).toEqual({mtls_frontend: required});
	});

	// A mode-4 edit that keeps the key is blocked, and the block message names
	// every changed field from this diff — so an fc_* change must appear in it,
	// and the read-back's fc_effective (live counters) must not.
	it('names an admission change on a fullproxy rule, and never the read-only fc_effective', () => {
		const ai = {...readBack, mode: 4, sse_mode: true, fc_mode: 'observe', fc_max_outstanding: 64};
		expect(lbServiceArgumentsPatch({...ai, fc_effective: {...readBack.fc_effective}, fc_max_outstanding: 32}, ai)).toEqual({fc_max_outstanding: 32});
		expect(selectLBEditStrategy({keyChanged: false, hasCompositeKey: true, mode: 4, canMergePatch: true})).toBe('block-fullproxy');
	});

	it('does not count a cleared admission field over an absent read-back as a change', () => {
		const ai = {...readBack, mode: 4, sse_mode: true};
		expect(lbServiceArgumentsPatch({...ai, fc_max_outstanding: undefined, fc_mode: undefined}, ai)).toEqual({});
	});

	it('sends a form default when the read-back holds a different value', () => {
		expect(lbServiceArgumentsPatch({...readBack, probeTimeout: 1800}, {...readBack, probeTimeout: 60})).toEqual({probeTimeout: 1800});
	});
});

describe('LB page selection identity', () => {
	const make = (model_name?: string): IServiceConfiguration => ({
		serviceArguments: {
			name: '',
			externalIP: '192.0.2.10',
			inactiveTimeOut: 0,
			port: 8000,
			protocol: 'tcp',
			...(model_name ? {model_name} : {}),
		},
		endpoints: [],
		secondaryIPs: [],
		allowedSources: [],
	});

	it('keeps model-less and model-keyed peers independently selectable', () => {
		const modelLess = make();
		const modelNamed = make('llama-3');
		const rows = [modelLess, modelNamed];

		const selected = rows.find(row => lbRuleRowId(row) === lbRuleRowId(modelNamed));
		expect(selected).toBe(modelNamed);
		expect(lbRuleRowId(modelLess)).not.toBe(lbRuleRowId(modelNamed));
	});
});
