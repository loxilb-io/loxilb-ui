//---------------------------------------------------------
// JWT credential policy + profile selector on the AI rule form (J2).
//
// Pins: the selector appears only under a mode that consults it, its options
// come from the configured profiles (so an unconfigured name is unreachable
// rather than a 400 on save), both cross-field warnings, the apikey-or-jwt
// precedence notice, the clearing of a stale reference when the mode moves
// away, and the create-vs-edit labelling of the omit option.
//
// The serializer's half of this contract is pinned in types/ai_gateway.test.ts.
// These are the parts only a mounted form can show: what an operator can
// actually select, and what the screen tells them.
//---------------------------------------------------------
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {IJWTAuthProfileEntry} from 'types/ai_jwt';
import {IServiceArguments} from 'types/load_balancer';
import AIGatewaySettingsForm from './AIGatewaySettingsForm';

const profiles = vi.hoisted(() => ({current: undefined as IJWTAuthProfileEntry[] | undefined}));

vi.mock('hooks/instanceHook', () => ({
	useInstanceFromURL: () => ({id: 1, name: 'gw'}),
}));

vi.mock('hooks/query/queryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/queryHooks')>();
	return {
		...mod,
		useJWTAuthProfiles: () => ({data: profiles.current, refetch: vi.fn()}),
		useModelProfiles: () => ({data: undefined, refetch: vi.fn()}),
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

const PROFILES: IJWTAuthProfileEntry[] = [
	{name: 'zeta-realm', issuer: 'https://zeta.example.com'},
	{name: 'acme-realm', issuer: 'https://acme.example.com'},
];

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {
		name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp',
		mode: 4,
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

/**
 * The delta from the last onChange that carried `api_key_auth`.
 *
 * ⚠️ Read as a raw object on purpose. `toHaveBeenCalledWith({k: undefined})`
 * ALSO matches a call whose object omits `k` entirely — and here those are
 * opposite instructions: the delta is merged into the draft, so an explicit
 * `jwt_auth_profile: undefined` clears a stale reference while an absent key
 * leaves it in place. Asserting with `in` is what makes that distinction
 * visible to the test.
 */
function lastPolicyDelta(onChange: ReturnType<typeof vi.fn>): Record<string, unknown> {
	const calls = onChange.mock.calls.filter(([delta]) => delta && 'api_key_auth' in delta);
	expect(calls.length, 'expected a policy change to have been announced').toBeGreaterThan(0);
	return calls[calls.length - 1][0];
}

beforeEach(async () => {
	profiles.current = PROFILES;
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('credential policy modes', () => {
	it('offers all four declarable policies plus the omit option', async () => {
		renderForm(args());
		const listbox = await openSelect('Data-plane Credential Policy');
		for (const label of [/Disabled \(strip header\)/, /Required \(enforce and strip\)/, /JWT bearer token/, /API key or JWT/]) {
			expect(listbox.getByText(label)).toBeTruthy();
		}
	});

	// ⚠️ The omit option means different things per operation and the label has
	// to say so. A replace that omits api_key_auth PRESERVES the declared
	// policy, so on edit "Preserve / unmanaged" would name a transition the
	// wire cannot perform: select it, save, and enforcement is still on.
	it('names the omit option for what it does in each operation', async () => {
		renderForm(args());
		expect((await openSelect('Data-plane Credential Policy')).getByText(/Unmanaged \(no policy\)/)).toBeTruthy();
		cleanup();

		renderForm(args({api_key_auth: 'required'}), vi.fn(), true);
		expect((await openSelect('Data-plane Credential Policy')).getByText(/Leave unchanged/)).toBeTruthy();
	});

	it('tells an editing operator that only an explicit Disabled stops enforcement', () => {
		renderForm(args({api_key_auth: 'required'}), vi.fn(), true);
		expect(screen.getByText(/it is not a way back to unmanaged/)).toBeTruthy();
	});
});

describe('the profile selector appears only where it is consulted', () => {
	it.each(['disabled', 'required'] as const)('stays hidden under %s', mode => {
		renderForm(args({api_key_auth: mode}));
		expect(screen.queryByLabelText('JWT Auth Profile')).toBeNull();
	});

	it('stays hidden when no policy is declared at all', () => {
		renderForm(args());
		expect(screen.queryByLabelText('JWT Auth Profile')).toBeNull();
	});

	it.each(['jwt', 'apikey-or-jwt'] as const)('appears under %s', mode => {
		renderForm(args({api_key_auth: mode}));
		expect(screen.getByLabelText('JWT Auth Profile')).toBeTruthy();
	});
});

describe('profile options come from what is configured', () => {
	// A selector rather than free text is the whole point: the gateway rejects
	// an unconfigured name with a 400, and a dropdown makes that state
	// unreachable instead of deferring it to save time.
	it('lists the configured profiles in name order and nothing else', async () => {
		renderForm(args({api_key_auth: 'jwt'}));
		const listbox = await openSelect('JWT Auth Profile');
		const options = listbox.getAllByRole('option').map(o => o.textContent);
		expect(options).toEqual(['Select a profile…', 'acme-realm', 'zeta-realm']);
	});

	it('warns that none exist rather than showing an empty picker', () => {
		profiles.current = [];
		renderForm(args({api_key_auth: 'jwt'}));
		expect(screen.getByText(/No JWT auth profiles are configured on this instance/)).toBeTruthy();
	});

	// The list read is a plain query; a 402 licence gate answers a JSON object,
	// not an array. Mapping that as a list would throw and white-screen the
	// rule form, so the non-array case must degrade to "none configured".
	it('survives a non-array payload instead of crashing the rule form', () => {
		profiles.current = {message: 'license required'} as unknown as IJWTAuthProfileEntry[];
		renderForm(args({api_key_auth: 'jwt'}));
		expect(screen.getByText(/No JWT auth profiles are configured on this instance/)).toBeTruthy();
	});

	it('warns while a JWT mode has no profile chosen', () => {
		renderForm(args({api_key_auth: 'jwt'}));
		expect(screen.getByText(/A JWT mode requires a profile/)).toBeTruthy();
	});

	it('drops the warning once a profile is chosen', () => {
		renderForm(args({api_key_auth: 'jwt', jwt_auth_profile: 'acme-realm'}));
		expect(screen.queryByText(/A JWT mode requires a profile/)).toBeNull();
	});
});

describe('apikey-or-jwt precedence is stated, not left to be discovered', () => {
	// Deleting this notice must fail a test. "API key or JWT" reads as "try
	// both" and it is not: a present X-Api-Key decides alone and its rejection
	// is FINAL — no fallback to the bearer arm. An operator who assumes
	// fallback ships a rule that refuses traffic they expected to admit.
	it('explains the fixed precedence under apikey-or-jwt', () => {
		renderForm(args({api_key_auth: 'apikey-or-jwt'}));
		expect(screen.getByText(/its rejection is final, with no JWT fallback/)).toBeTruthy();
	});

	it('does not show it under plain jwt, where nothing takes precedence', () => {
		renderForm(args({api_key_auth: 'jwt'}));
		expect(screen.queryByText(/no JWT fallback/)).toBeNull();
	});
});

describe('the reference travels with the mode', () => {
	// A non-JWT mode carrying a profile is refused upstream
	// (ErrJwtProfileNotApplicable), and a dangling reference would block that
	// profile's deletion for a rule that can never consult it. So the clear
	// has to happen in the SAME delta as the mode change — a later cleanup
	// pass would leave a save in between that the gateway rejects.
	it('clears a stale profile in the same delta as a move to a non-JWT mode', async () => {
		const onChange = renderForm(args({api_key_auth: 'jwt', jwt_auth_profile: 'acme-realm'}));
		const user = userEvent.setup();
		await user.click(screen.getByLabelText('Data-plane Credential Policy'));
		await user.click(within(await screen.findByRole('listbox')).getByText(/Required \(enforce and strip\)/));

		const delta = lastPolicyDelta(onChange);
		expect(delta.api_key_auth).toBe('required');
		// The key must be PRESENT and undefined. Omitting it merges to nothing
		// and the stale reference survives into the save.
		expect('jwt_auth_profile' in delta, 'the delta must carry the cleared reference').toBe(true);
		expect(delta.jwt_auth_profile).toBeUndefined();
	});

	it('keeps the profile when moving between the two JWT modes', async () => {
		const onChange = renderForm(args({api_key_auth: 'jwt', jwt_auth_profile: 'acme-realm'}));
		const user = userEvent.setup();
		await user.click(screen.getByLabelText('Data-plane Credential Policy'));
		await user.click(within(await screen.findByRole('listbox')).getByText(/API key or JWT/));

		const delta = lastPolicyDelta(onChange);
		expect(delta.api_key_auth).toBe('apikey-or-jwt');
		// The converse: the key must be ABSENT. Clearing here would drop a
		// valid reference the new mode still consults.
		expect('jwt_auth_profile' in delta, 'a JWT-to-JWT move must not touch the reference').toBe(false);
	});

	it('sends the chosen profile name', async () => {
		const onChange = renderForm(args({api_key_auth: 'jwt'}));
		const user = userEvent.setup();
		await user.click(screen.getByLabelText('JWT Auth Profile'));
		await user.click(within(await screen.findByRole('listbox')).getByText('zeta-realm'));
		expect(onChange).toHaveBeenCalledWith({jwt_auth_profile: 'zeta-realm'});
	});
});
