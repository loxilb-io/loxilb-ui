//---------------------------------------------------------
// KV-exact readiness for ONE model on the LB rule form.
//
// Asked with a model name, the gateway also says whether a tokenizer for that
// model can be loaded. What that answer may change on screen:
//
//   not-ready → a WARNING under Model Name, in the gateway's own words.
//   ready     → nothing.
//   unknown   → nothing.
//
// And what it must never do: speak about a name the operator has already
// typed past, or be asked once per keystroke (each new name is a fresh
// tokenizer probe on the gateway).
//---------------------------------------------------------
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render, screen} from '@testing-library/react';
import {CapabilityVerdict} from 'types/capability_status';
import {IServiceArguments} from 'types/load_balancer';
import AIGatewaySettingsForm, {MODEL_VERDICT_DEBOUNCE_MS} from './AIGatewaySettingsForm';

const UNKNOWN: CapabilityVerdict = {kind: 'unknown', why: 'unreadable'};
const READY: CapabilityVerdict = {kind: 'ready'};
const TOKENIZER_SENTENCE =
	'vllm kvExactMode tokenizer is required and must be loadable for model_name (stage /etc/loxilb/tokenizers/<model-slug>/tokenizer.json or bind a model profile before retry)';
const NO_TOKENIZER: CapabilityVerdict = {kind: 'not-ready', reasonCode: 'KV_EXACT_TOKENIZER_UNLOADABLE', reason: TOKENIZER_SENTENCE};
const SEED_SENTENCE = 'vllm kvExactMode requires non-empty Gateway LLB_KV_NONE_HASH_SEED matching engine PYTHONHASHSEED';
const NO_SEED: CapabilityVerdict = {kind: 'not-ready', reasonCode: 'KV_EXACT_SEED_UNSET', reason: SEED_SENTENCE};
const OUR_LINE = /would refuse a KV-exact rule for this model right now/;

const gateway = vi.hoisted(() => ({
	seed: {kind: 'ready'} as CapabilityVerdict,
	byModel: {} as Record<string, CapabilityVerdict>,
	/** Model names the form actually asked the gateway about, in order, without repeats of the same render. */
	asked: [] as string[],
}));

vi.mock('hooks/instanceHook', () => ({
	useInstanceFromURL: () => ({id: 1, name: 'gw'}),
}));

vi.mock('hooks/query/queryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/queryHooks')>();
	return {
		...mod,
		useModelProfiles: () => ({data: undefined, refetch: vi.fn()}),
		useJWTAuthProfiles: () => ({data: undefined, refetch: vi.fn()}),
	};
});

vi.mock('hooks/query/statusHook', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/statusHook')>();
	return {
		...mod,
		// Honours the real hook's contract: no instance means no read, so the
		// verdict is `unknown` whatever the gateway would have said.
		useCapabilityVerdict: (instance: unknown, _name: string, opts?: {modelName?: string}) => {
			if (instance === null) return {kind: 'unknown', why: 'unreadable'} as CapabilityVerdict;
			const model = opts?.modelName ?? '';
			if (!model) return gateway.seed;
			if (gateway.asked[gateway.asked.length - 1] !== model) gateway.asked.push(model);
			return gateway.byModel[model] ?? ({kind: 'unknown', why: 'unreadable'} as CapabilityVerdict);
		},
	};
});

vi.mock('hooks/query/flavorHook', () => ({
	useInstanceCapabilities: () => ({
		resolved: true,
		flavor: 'inference-gateway',
		hasField: () => true,
		hasFeature: () => true,
		allowedEnum: (_site: string, values: unknown[]) => values,
		resolution: {state: 'resolved'},
	}),
}));

/** A vllm rule on the single-role exact topology, unless overridden. */
function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {
		name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp',
		mode: 4, kvEngineType: 'vllm', pd_disagg_mode: false, kvExactMode: 3,
		...over,
	} as IServiceArguments;
}

function renderForm(value: IServiceArguments, isEdit = false) {
	const view = render(<AIGatewaySettingsForm value={value} onChange={vi.fn()} isEdit={isEdit} />);
	return {
		...view,
		/** The operator changed the form; no time has passed. */
		type: (next: IServiceArguments) => view.rerender(<AIGatewaySettingsForm value={next} onChange={vi.fn()} isEdit={isEdit} />),
	};
}

const settle = (ms = MODEL_VERDICT_DEBOUNCE_MS) => act(() => void vi.advanceTimersByTime(ms));

function warnings(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll('.MuiAlert-root'))
		.filter(el => OUR_LINE.test(el.textContent ?? ''))
		.map(el => /MuiAlert-(?:standard|filled|outlined)(\w+)/.exec(el.className)?.[1]?.toLowerCase() ?? 'unknown');
}

beforeEach(async () => {
	await i18n.changeLanguage('en');
	vi.useFakeTimers();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	gateway.seed = {kind: 'ready'};
	gateway.byModel = {};
	gateway.asked = [];
});

describe('a model the gateway has no tokenizer for', () => {
	it('is flagged as a warning carrying the gateway sentence', () => {
		gateway.byModel['org/missing'] = NO_TOKENIZER;
		const {container} = renderForm(args({model_name: 'org/missing'}));

		// Severity is the contract: `error` would read as a block, and the
		// gateway re-checks on submit.
		expect(warnings(container)).toEqual(['warning']);
		expect(screen.getByText(TOKENIZER_SENTENCE)).toBeTruthy();
	});

	it('is flagged on the P/D exact topology and on an edit alike', () => {
		gateway.byModel['org/missing'] = NO_TOKENIZER;
		const {container} = renderForm(args({model_name: 'org/missing', pd_disagg_mode: true, kvExactMode: 1}), true);
		expect(warnings(container)).toEqual(['warning']);
	});

	it('asks with the trimmed name', () => {
		renderForm(args({model_name: '  org/missing  '}));
		expect(gateway.asked).toEqual(['org/missing']);
	});

	it('says the reason is missing when the gateway sent none', () => {
		gateway.byModel['org/missing'] = {kind: 'not-ready', reasonCode: 'KV_EXACT_TOKENIZER_UNLOADABLE', reason: ''};
		const {container} = renderForm(args({model_name: 'org/missing'}));
		expect(warnings(container)).toEqual(['warning']);
		expect(screen.getByText(/reported no reason for this refusal/)).toBeTruthy();
	});

	it('is flagged for a reason code this build does not know', () => {
		gateway.byModel['org/x'] = {kind: 'not-ready', reasonCode: 'KV_EXACT_SOMETHING_NEW', reason: 'a later gateway sentence'};
		const {container} = renderForm(args({model_name: 'org/x'}));
		expect(warnings(container)).toEqual(['warning']);
		expect(screen.getByText('a later gateway sentence')).toBeTruthy();
	});
});

describe('answers that say nothing', () => {
	it.each([
		['ready', READY],
		['unknown', UNKNOWN],
	])('%s shows no warning', (_label, verdict) => {
		gateway.byModel['org/model'] = verdict;
		const {container} = renderForm(args({model_name: 'org/model'}));
		expect(gateway.asked).toEqual(['org/model']);
		expect(warnings(container)).toEqual([]);
	});
});

describe('the gateway is asked only about a settled name', () => {
	it('does not ask per keystroke', () => {
		const form = renderForm(args({model_name: ''}));
		for (const typed of ['org/mo', 'org/mod', 'org/model']) {
			form.type(args({model_name: typed}));
			settle(MODEL_VERDICT_DEBOUNCE_MS - 1);
		}
		expect(gateway.asked).toEqual([]);

		settle(1);
		expect(gateway.asked).toEqual(['org/model']);
	});

	it('never shows an answer about a name the operator has typed past', () => {
		gateway.byModel['org/a'] = NO_TOKENIZER;
		gateway.byModel['org/b'] = READY;
		const form = renderForm(args({model_name: 'org/a'}));
		expect(warnings(form.container)).toEqual(['warning']);

		// The name changed; the read on screen is still the one for org/a.
		form.type(args({model_name: 'org/b'}));
		expect(warnings(form.container)).toEqual([]);

		settle();
		expect(gateway.asked).toEqual(['org/a', 'org/b']);
		expect(warnings(form.container)).toEqual([]);
	});

	it('shows the warning for the new name only once it has settled', () => {
		gateway.byModel['org/a'] = READY;
		gateway.byModel['org/b'] = NO_TOKENIZER;
		const form = renderForm(args({model_name: 'org/a'}));
		form.type(args({model_name: 'org/b'}));
		expect(warnings(form.container)).toEqual([]);
		settle();
		expect(warnings(form.container)).toEqual(['warning']);
	});
});

describe('where the model verdict cannot decide anything, it is not read', () => {
	it.each<[string, Partial<IServiceArguments>]>([
		['sglang', {kvEngineType: 'sglang'}],
		['trtllm', {kvEngineType: 'trtllm'}],
		['plain routing', {kvExactMode: 0}],
		['P/D without KV exact', {pd_disagg_mode: true, kvExactMode: 0}],
		['no model name', {model_name: ''}],
		['a blank model name', {model_name: '   '}],
		['a non-L7 rule', {mode: 0}],
	])('%s', (_label, over) => {
		gateway.byModel['org/missing'] = NO_TOKENIZER;
		const {container} = renderForm(args({model_name: 'org/missing', ...over}));
		settle();
		expect(gateway.asked).toEqual([]);
		expect(warnings(container)).toEqual([]);
	});

	it('a gateway that already refuses KV-exact outright says so once', () => {
		// An existing exact rule on a gateway relaunched without its seed: the
		// topology alert carries the reason, and the model read would only
		// repeat it.
		gateway.seed = NO_SEED;
		gateway.byModel['org/missing'] = NO_SEED;
		const {container} = renderForm(args({model_name: 'org/missing'}), true);
		settle();
		expect(gateway.asked).toEqual([]);
		expect(warnings(container)).toEqual([]);
		expect(screen.getAllByText(SEED_SENTENCE)).toHaveLength(1);
	});
});
