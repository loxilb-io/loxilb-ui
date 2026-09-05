//---------------------------------------------------------
// Model Profile selector on the KV-exact rule form.
//
// Pins: compatible-only filtering by model name, alias context, API-surface
// restriction to the profile's declared set, single-surface preselection,
// strict-edit immutability, and the C-03 decision that a profile-less rule
// shows NO attach affordance in edit.
//---------------------------------------------------------
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {IModelProfileRegistry} from 'types/ai_gateway';
import {IServiceArguments} from 'types/load_balancer';
import AIGatewaySettingsForm from './AIGatewaySettingsForm';

const registry = vi.hoisted(() => ({current: undefined as IModelProfileRegistry | undefined}));

vi.mock('hooks/instanceHook', () => ({
	useInstanceFromURL: () => ({id: 1, name: 'gw'}),
}));

vi.mock('hooks/query/queryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/queryHooks')>();
	return {...mod, useModelProfiles: () => ({data: registry.current, refetch: vi.fn()})};
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

const REGISTRY: IModelProfileRegistry = {
	registryGeneration: 4,
	setDigest: 'sha256:abc',
	profiles: [
		{profileId: 'llama-both', gen: 4, baseModel: 'meta-llama/Llama-3-70B', aliasPolicy: 'base_model_only', supportedApis: ['completions', 'chat'], tokenizerSha256: 'b'.repeat(64)},
		{profileId: 'qwen3-chat', gen: 4, baseModel: 'Qwen/Qwen3-32B', aliasPolicy: 'list', allowedAliases: ['qwen-chat'], supportedApis: ['chat'], tokenizerSha256: 'a'.repeat(64)},
	],
};

function strictArgs(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {
		name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp',
		mode: 4, pd_disagg_mode: true, kvExactMode: 1, kvEngineType: 'vllm',
		...over,
	} as IServiceArguments;
}

function renderForm(value: IServiceArguments, onChange = vi.fn(), isEdit = false) {
	render(<AIGatewaySettingsForm value={value} onChange={onChange} isEdit={isEdit} />);
	return onChange;
}

async function openSelect(label: string) {
	const user = userEvent.setup();
	await user.click(screen.getByLabelText(label));
	return within(await screen.findByRole('listbox'));
}

beforeEach(async () => {
	registry.current = REGISTRY;
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('profile selector (create mode)', () => {
	it('offers every published profile plus the legacy option when no model name is set', async () => {
		renderForm(strictArgs());
		const listbox = await openSelect('Model Profile');
		expect(listbox.getByText(/None \(legacy profile-less routing\)/)).toBeTruthy();
		expect(listbox.getByText(/llama-both — meta-llama\/Llama-3-70B — completions\/chat/)).toBeTruthy();
		expect(listbox.getByText(/qwen3-chat — Qwen\/Qwen3-32B — chat/)).toBeTruthy();
	});

	it('filters to profiles serving the declared model, with alias context (MP-E2E-006/007)', async () => {
		renderForm(strictArgs({model_name: 'qwen-chat'}));
		const listbox = await openSelect('Model Profile');
		expect(listbox.getByText(/qwen3-chat.*\(alias: qwen-chat\)/)).toBeTruthy();
		expect(listbox.queryByText(/llama-both/)).toBeNull();
	});

	it('warns — without crashing — when no profile serves the model name', () => {
		renderForm(strictArgs({model_name: 'unknown/model'}));
		expect(screen.getByText(/No published profile serves this model name/)).toBeTruthy();
	});

	it('preselects the surface of a single-surface profile in the same delta', async () => {
		const onChange = renderForm(strictArgs());
		const user = userEvent.setup();
		await user.click(screen.getByLabelText('Model Profile'));
		await user.click(within(await screen.findByRole('listbox')).getByText(/qwen3-chat/));
		expect(onChange).toHaveBeenCalledWith({kvModelProfile: 'qwen3-chat', kvExactApiMode: 'chat'});
	});

	it('demands an explicit choice for a multi-surface profile', async () => {
		const onChange = renderForm(strictArgs());
		const user = userEvent.setup();
		await user.click(screen.getByLabelText('Model Profile'));
		await user.click(within(await screen.findByRole('listbox')).getByText(/llama-both/));
		expect(onChange).toHaveBeenCalledWith({kvModelProfile: 'llama-both', kvExactApiMode: undefined});
	});

	it('restricts the API-surface options to the selected profile declaration (MP-E2E-008 seed)', async () => {
		renderForm(strictArgs({kvModelProfile: 'llama-both'}));
		const listbox = await openSelect('API Surface');
		expect(listbox.getByText('completions')).toBeTruthy();
		expect(listbox.getByText('chat')).toBeTruthy();
		expect(listbox.getByText('both')).toBeTruthy();
	});

	it('clears both fields when the operator returns to legacy routing', async () => {
		const onChange = renderForm(strictArgs({kvModelProfile: 'qwen3-chat', kvExactApiMode: 'chat'}));
		const user = userEvent.setup();
		await user.click(screen.getByLabelText('Model Profile'));
		await user.click(within(await screen.findByRole('listbox')).getByText(/None \(legacy/));
		expect(onChange).toHaveBeenCalledWith({kvModelProfile: undefined, kvExactApiMode: undefined});
	});

	it('flags a selection that fell out of the published registry', () => {
		renderForm(strictArgs({kvModelProfile: 'ghost-profile'}));
		expect(screen.getByText(/Selected profile is not in the currently published registry/)).toBeTruthy();
	});
});

describe('edit mode (FR-03)', () => {
	it('renders the strict binding read-only with the immutability warning', () => {
		renderForm(strictArgs({kvModelProfile: 'qwen3-chat', kvExactApiMode: 'chat'}), vi.fn(), true);
		expect(screen.getByText(/model profile and API surface are immutable/)).toBeTruthy();
		const profileSelect = screen.getByLabelText('Model Profile');
		expect(profileSelect.getAttribute('aria-disabled')).toBe('true');
	});

	it('offers NO attach affordance on a profile-less rule (C-03 deferred migration)', () => {
		renderForm(strictArgs(), vi.fn(), true);
		expect(screen.queryByLabelText('Model Profile')).toBeNull();
		expect(screen.queryByLabelText('API Surface')).toBeNull();
	});
});

describe('gating', () => {
	it('shows no selector outside exact routing', () => {
		renderForm(strictArgs({kvExactMode: 0, pd_disagg_mode: false}));
		expect(screen.queryByLabelText('Model Profile')).toBeNull();
	});
});
