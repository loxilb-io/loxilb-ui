//---------------------------------------------------------
// KV-exact readiness on the LB rule form.
//
// The gateway now answers "can I serve vLLM KV-exact rules?" before a client
// submits one (GET /status/capabilities). What that answer is allowed to change
// on screen, and what it is NOT:
//
//   not-ready  → withdraw the KV-exact topologies and say why, in the
//                gateway's own words.
//   ready      → offer them.
//   unknown    → offer them. An unread, unreachable or older gateway must look
//                exactly like the world before the endpoint existed.
//
// ⭐ And the one case that outranks all three: a rule that ALREADY uses a
// KV-exact topology keeps its option, because DropDownSelectBox silently falls
// back to the first item when the value has no match — withdrawing it would
// show the operator a rule shape that is not the rule they are editing.
//---------------------------------------------------------
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CapabilityVerdict} from 'types/capability_status';
import {IServiceArguments} from 'types/load_balancer';
import AIGatewaySettingsForm from './AIGatewaySettingsForm';

const verdict = vi.hoisted(() => ({current: {kind: 'ready'} as CapabilityVerdict}));
const capabilityCalls = vi.hoisted(() => ({args: [] as unknown[][]}));

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
		// ⚠️ Honours the null-instance contract of the real hook: with no
		// instance there is no read, so the verdict is `unknown`. A stub that
		// returned the scripted verdict regardless would report a refusal the
		// gateway was never asked for — and would have "passed" the engine-gating
		// test below while proving nothing about it.
		useCapabilityVerdict: (...args: unknown[]) => {
			capabilityCalls.args.push(args);
			return args[0] === null ? ({kind: 'unknown', why: 'unreadable'} as CapabilityVerdict) : verdict.current;
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

const SEED_SENTENCE = 'vllm kvExactMode requires non-empty Gateway LLB_KV_NONE_HASH_SEED matching engine PYTHONHASHSEED';
const NOT_READY: CapabilityVerdict = {kind: 'not-ready', reasonCode: 'KV_EXACT_SEED_UNSET', reason: SEED_SENTENCE};

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {
		name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp',
		mode: 4, kvEngineType: 'vllm', pd_disagg_mode: false, kvExactMode: 0,
		...over,
	} as IServiceArguments;
}

// ⚠️ The subform renders inside a COLLAPSED accordion, so its content is
// present but hidden — role queries skip it (they respect aria-hidden) while
// label and text queries do not. Hence getByLabelText for the control, exactly
// as the sibling profile suite does; the listbox itself lands in a portal
// outside the accordion, so that one is reachable by role.
function renderForm(value: IServiceArguments, isEdit = false) {
	const onChange = vi.fn();
	const {container} = render(<AIGatewaySettingsForm value={value} onChange={onChange} isEdit={isEdit} />);
	return {onChange, container};
}

/** The option names currently offered by the Topology combobox. */
async function topologyOptionNames(): Promise<string[]> {
	await userEvent.setup().click(screen.getByLabelText('Topology'));
	const listbox = await screen.findByRole('listbox');
	return within(listbox)
		.getAllByRole('option')
		.map(option => option.textContent ?? '');
}

/** MUI encodes Alert severity in a class; there is no accessible name to match. */
function alertSeverities(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll('.MuiAlert-root')).map(el =>
		/MuiAlert-(standard|filled|outlined)(\w+)/.exec(el.className)?.[2]?.toLowerCase() ?? 'unknown',
	);
}

beforeEach(async () => {
	await i18n.changeLanguage('en');
});

afterEach(() => {
	cleanup();
	verdict.current = {kind: 'ready'};
	capabilityCalls.args = [];
});

describe('KV-exact topologies follow the gateway verdict', () => {
	it('offers them when the gateway reports ready', async () => {
		renderForm(args());
		expect(await topologyOptionNames()).toEqual(
			expect.arrayContaining(['P/D + KV exact', 'Single-role KV exact']),
		);
	});

	it('withdraws them when the gateway reports not ready', async () => {
		verdict.current = NOT_READY;
		renderForm(args());
		const names = await topologyOptionNames();
		expect(names).not.toContain('P/D + KV exact');
		expect(names).not.toContain('Single-role KV exact');
		// The rest of the control is untouched — this is a withdrawal of two
		// options, not of the topology choice.
		expect(names).toEqual(expect.arrayContaining(['Plain routing', 'P/D disaggregation']));
	});

	// ⭐ Each `unknown` reason spelled out, because each one is a different way
	// of not knowing and all three must behave identically: an unread query, a
	// gateway too old to have the endpoint, and a build that does not list the
	// capability.
	it.each([
		['unreadable (unread or failed)', {kind: 'unknown', why: 'unreadable'} as CapabilityVerdict],
		['endpoint-absent (older gateway, 404)', {kind: 'unknown', why: 'endpoint-absent'} as CapabilityVerdict],
		['not-listed (build does not know it)', {kind: 'unknown', why: 'not-listed'} as CapabilityVerdict],
		['ready', {kind: 'ready'} as CapabilityVerdict],
	])('still offers them when the verdict is %s', async (_label, given) => {
		verdict.current = given;
		renderForm(args());
		expect(await topologyOptionNames()).toEqual(
			expect.arrayContaining(['P/D + KV exact', 'Single-role KV exact']),
		);
	});

	// ⭐⭐ The regression this guards is a silent misrepresentation, not a crash:
	// DropDownSelectBox falls back to index 0 when nothing matches the value and
	// only calls onChange for an EMPTY value, so a withdrawn selected option
	// leaves the combobox reading "Plain routing" while the form still holds
	// kvExactMode 3.
	it.each([
		['single-role (kvExactMode 3)', args({kvExactMode: 3}), 'Single-role KV exact'],
		['P/D + KV exact (kvExactMode 1)', args({kvExactMode: 1, pd_disagg_mode: true}), 'P/D + KV exact'],
	])('keeps the option a rule already uses: %s', async (_label, value, expected) => {
		verdict.current = NOT_READY;
		renderForm(value, true);
		// The control still SHOWS the rule's real topology...
		expect(screen.getByLabelText('Topology').textContent).toContain(expected);
		// ...and it is still in the list, so nothing silently re-points it.
		expect(await topologyOptionNames()).toContain(expected);
	});

	it('withdraws only the one not in use, keeping the other available to leave', async () => {
		verdict.current = NOT_READY;
		renderForm(args({kvExactMode: 3}), true);
		const names = await topologyOptionNames();
		expect(names).toContain('Single-role KV exact');
		expect(names).not.toContain('P/D + KV exact');
		expect(names).toContain('Plain routing');
	});
});

describe('what the operator is told', () => {
	it('quotes the gateway\'s own sentence rather than paraphrasing it', async () => {
		verdict.current = NOT_READY;
		renderForm(args());
		expect(await screen.findByText(SEED_SENTENCE)).toBeTruthy();
	});

	// A rule already on an exact topology cannot be saved, so the message is an
	// error about THIS rule. A plain rule is merely told why an option is
	// missing — informational, because nothing is broken.
	it('escalates to an error only when the rule in hand would be refused', async () => {
		verdict.current = NOT_READY;
		const {container} = renderForm(args({kvExactMode: 3}), true);
		expect(await screen.findByText(/This gateway will refuse this rule/)).toBeTruthy();
		expect(alertSeverities(container)).toContain('error');
	});

	it('explains the missing options informationally on a plain rule', async () => {
		verdict.current = NOT_READY;
		const {container} = renderForm(args());
		expect(await screen.findByText(/KV-exact topologies are not offered/)).toBeTruthy();
		expect(screen.queryByText(/This gateway will refuse this rule/)).toBeNull();
		// Informational, not an error: nothing about this draft is broken.
		expect(alertSeverities(container)).toContain('info');
		expect(alertSeverities(container)).not.toContain('error');
	});

	// The contract makes `reason` optional. Saying the reason is missing is
	// honest; inventing one is not.
	it('says the gateway gave no reason instead of guessing one', async () => {
		verdict.current = {kind: 'not-ready', reasonCode: '', reason: ''};
		renderForm(args());
		expect(await screen.findByText(/The gateway reported no reason for this refusal/)).toBeTruthy();
	});

	it('says nothing at all when the capability is ready', () => {
		renderForm(args());
		expect(screen.queryByText(/KV-exact topologies are not offered/)).toBeNull();
		expect(screen.queryByText(/This gateway will refuse this rule/)).toBeNull();
	});
});

describe('who gets asked', () => {
	// ⚠️ The capability is about vllm only (`kv_exact_vllm`). sglang and trtllm
	// have their own admission rules that this surface does not report, so a
	// verdict must not be applied to them — their exact topologies stay offered
	// and the gateway stays the authority.
	it('does not consult the vLLM verdict for another engine', async () => {
		verdict.current = NOT_READY;
		renderForm(args({kvEngineType: 'sglang'}));
		expect(capabilityCalls.args.every(call => call[0] === null)).toBe(true);
		expect(await topologyOptionNames()).toEqual(
			expect.arrayContaining(['P/D + KV exact', 'Single-role KV exact']),
		);
	});

	it('asks with the selected instance on a vLLM rule', () => {
		renderForm(args());
		expect(capabilityCalls.args.some(call => call[0] !== null && call[1] === 'kv_exact_vllm')).toBe(true);
	});
});
