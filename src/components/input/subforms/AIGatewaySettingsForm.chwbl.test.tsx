//---------------------------------------------------------
// CHWBL ring tuning on the LB rule form: mean load factor, replication, and
// the cache_salt requirement.
//
// The gateway refuses a rule that carries any of the three off a fullproxy
// rule under sel 8/10, and resolves an omitted one itself. So the controls
// exist only where they apply and only on a gateway that declares them, they
// send nothing until the operator acts, and switching the cache_salt
// requirement on says what it does to clients.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {CHWBL_TUNING_FIELDS} from 'types/ai_gateway';
import {IServiceArguments} from 'types/load_balancer';
import AIGatewaySettingsForm from './AIGatewaySettingsForm';

const gateway = vi.hoisted(() => ({unknownFields: [] as string[]}));

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
	return {...mod, useCapabilityVerdict: () => ({kind: 'ready'})};
});

vi.mock('hooks/query/flavorHook', () => ({
	useInstanceCapabilities: () => ({
		resolved: true,
		flavor: 'inference-gateway',
		hasField: (_context: string, field: string) => !gateway.unknownFields.includes(field),
		hasFeature: () => true,
		allowedEnum: (_site: string, values: unknown[]) => values,
		resolution: {state: 'resolved'},
	}),
}));

const DECLARED = {
	chwbl_mean_load_factor: {type: 'integer', minimum: 100, maximum: 300},
	chwbl_replication: {type: 'integer', minimum: 1, maximum: 1024},
	chwbl_enable_cache_salt: {type: 'boolean'},
};

const LOAD_FACTOR = 'CHWBL Mean Load Factor (%)';
const REPLICATION = 'CHWBL Replication';
const CACHE_SALT = 'Require cache_salt';
const LABELS = [LOAD_FACTOR, REPLICATION, CACHE_SALT];

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.10', inactiveTimeOut: 0, port: 8000, protocol: 'tcp', mode: 4, sel: 8, ...over};
}

function renderForm(value: IServiceArguments, params: Record<string, unknown> = DECLARED) {
	const onChange = vi.fn();
	render(<AIGatewaySettingsForm value={value} onChange={onChange} params={params} />);
	return onChange;
}

// By label text: the form is a collapsed accordion, and an accessible name is
// not computed from a hidden label.
const control = (label: string) => screen.queryByLabelText(label) as HTMLInputElement | null;
// hidden: true for the same reason — the accordion is collapsed.
const warning = () => screen.queryByRole('alert', {hidden: true});
const offered = () => LABELS.filter(label => control(label) !== null);
const sentTuning = (onChange: ReturnType<typeof vi.fn>) =>
	onChange.mock.calls.flatMap(([delta]) => Object.keys(delta)).filter(key => (CHWBL_TUNING_FIELDS as readonly string[]).includes(key));

afterEach(() => {
	cleanup();
	gateway.unknownFields = [];
});

describe('CHWBL ring tuning controls', () => {
	it('are offered under the chwbl and WRR-hash selectors, empty and off, and announce nothing', () => {
		for (const sel of [8, 10]) {
			const onChange = renderForm(args({sel}));
			expect(offered()).toEqual(LABELS);
			expect(control(LOAD_FACTOR)?.value).toBe('');
			expect(control(REPLICATION)?.value).toBe('');
			expect(control(CACHE_SALT)?.checked).toBe(false);
			expect(sentTuning(onChange)).toEqual([]);
			cleanup();
		}
	});

	it('are not offered under a selector that builds no ring, even with values left in the draft', () => {
		for (const sel of [0, 1, 3, 9, undefined]) {
			renderForm(args({sel, chwbl_mean_load_factor: 150, chwbl_replication: 64, chwbl_enable_cache_salt: true}));
			expect(offered()).toEqual([]);
			expect(warning()).toBeNull();
			cleanup();
		}
	});

	it('are not offered off fullproxy', () => {
		renderForm(args({mode: 0}));
		expect(offered()).toEqual([]);
	});

	it('offers only the fields this gateway declares in /meta', () => {
		renderForm(args(), {chwbl_replication: DECLARED.chwbl_replication});
		expect(offered()).toEqual([REPLICATION]);
		cleanup();

		renderForm(args(), {});
		expect(offered()).toEqual([]);
	});

	it('offers only the fields the instance contract has', () => {
		gateway.unknownFields = ['chwbl_enable_cache_salt'];
		renderForm(args());
		expect(offered()).toEqual([LOAD_FACTOR, REPLICATION]);
	});

	it('sends what the operator enters, as a number', () => {
		const onChange = renderForm(args());
		fireEvent.change(control(LOAD_FACTOR)!, {target: {value: '125'}});
		expect(onChange).toHaveBeenLastCalledWith({chwbl_mean_load_factor: 125});
		fireEvent.change(control(REPLICATION)!, {target: {value: '64'}});
		expect(onChange).toHaveBeenLastCalledWith({chwbl_replication: 64});
	});

	it('shows a read-back value as reported', () => {
		renderForm(args({chwbl_mean_load_factor: 175, chwbl_replication: 256, chwbl_enable_cache_salt: true}));
		expect(control(LOAD_FACTOR)?.value).toBe('175');
		expect(control(REPLICATION)?.value).toBe('256');
		expect(control(CACHE_SALT)?.checked).toBe(true);
	});

	it('sends the cache_salt requirement only on a click', () => {
		const onChange = renderForm(args());
		fireEvent.click(control(CACHE_SALT)!);
		expect(onChange).toHaveBeenCalledWith({chwbl_enable_cache_salt: true});
	});

	it('warns that clients must send a cache_salt only while the requirement is on', () => {
		renderForm(args());
		expect(warning()).toBeNull();
		cleanup();

		renderForm(args({chwbl_enable_cache_salt: false}));
		expect(warning()).toBeNull();
		cleanup();

		renderForm(args({chwbl_enable_cache_salt: true}));
		const text = warning()?.textContent ?? '';
		expect(text).toContain('refused with HTTP 400');
		expect(text).toContain('at most 63 bytes');
		expect(text).toContain('not authentication');
	});

	// The description is the control's tooltip, which MUI also exposes as the
	// aria-label of the wrapped element — readable without hovering.
	it('describes replication as a per-endpoint count under chwbl and a total budget under WRR-hash', () => {
		const described = (text: string) => document.querySelector(`[aria-label^="${text}"]`) !== null;

		renderForm(args({sel: 8}));
		expect(described('Virtual nodes per endpoint')).toBe(true);
		expect(described('Total virtual nodes')).toBe(false);
		cleanup();

		renderForm(args({sel: 10}));
		expect(described('Total virtual nodes')).toBe(true);
		expect(described('Virtual nodes per endpoint')).toBe(false);
	});
});
