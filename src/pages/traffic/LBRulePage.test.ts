import {describe, expect, it} from 'vitest';
import {selectLBEditStrategy} from './LBRulePage';
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
