//---------------------------------------------------------
// The circuit-breaker switch on the LB rule form.
//
// The gateway resolves an omitted cb_enable itself: on for a P/D rule, off
// otherwise. So the switch has two jobs that pull against each other — show
// what the rule will actually run with, and send nothing until the operator
// chooses. And it must not exist at all on a gateway that would accept the
// field and drop it.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {IServiceArguments} from 'types/load_balancer';
import AdvancedSettingsForm from './AdvancedSettingsForm';

const gateway = vi.hoisted(() => ({knowsField: true}));

vi.mock('hooks/query/flavorHook', () => ({
	useInstanceCapabilities: () => ({
		resolved: true,
		flavor: 'inference-gateway',
		hasField: (_context: string, field: string) => field !== 'cb_enable' || gateway.knowsField,
		hasFeature: () => true,
		allowedEnum: (_site: string, values: unknown[]) => values,
		resolution: {state: 'resolved'},
	}),
}));

const DECLARED = {cb_enable: {type: 'boolean'}};

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.10', inactiveTimeOut: 0, port: 8000, protocol: 'tcp', mode: 4, ...over};
}

function renderForm(value: IServiceArguments, opts: {params?: Record<string, unknown>; isEdit?: boolean} = {}) {
	const onChange = vi.fn();
	render(<AdvancedSettingsForm value={value} onChange={onChange} params={opts.params ?? DECLARED} isEdit={opts.isEdit} />);
	return onChange;
}

// By label text, not by role + name: the section is a collapsed accordion, and
// an accessible name is not computed from a hidden label.
const breaker = () => screen.queryByLabelText('Circuit Breaker') as HTMLInputElement | null;

afterEach(() => {
	cleanup();
	gateway.knowsField = true;
});

describe('circuit-breaker switch', () => {
	it('shows a P/D draft as on and a plain draft as off without sending anything', () => {
		const onPd = renderForm(args({pd_disagg_mode: true}));
		expect(breaker()?.checked).toBe(true);
		expect(onPd.mock.calls.some(([delta]) => 'cb_enable' in delta)).toBe(false);
		cleanup();

		const onPlain = renderForm(args());
		expect(breaker()?.checked).toBe(false);
		expect(onPlain.mock.calls.some(([delta]) => 'cb_enable' in delta)).toBe(false);
	});

	it('sends an explicit false when the operator switches a P/D rule off', () => {
		const onChange = renderForm(args({pd_disagg_mode: true}));
		fireEvent.click(breaker()!);
		expect(onChange).toHaveBeenCalledWith({cb_enable: false});
	});

	it('keeps an explicit choice when the topology default says otherwise', () => {
		renderForm(args({pd_disagg_mode: true, cb_enable: false}));
		expect(breaker()?.checked).toBe(false);
	});

	it('is off and locked on a rule that is not fullproxy', () => {
		renderForm(args({mode: 0, pd_disagg_mode: true, cb_enable: true}));
		expect(breaker()?.checked).toBe(false);
		expect(breaker()?.disabled).toBe(true);
	});

	// GET omits cb_enable when the breaker is off, so a P/D rule read back
	// without it is OFF — the draft default must not be applied to it.
	it('shows a read-back as the gateway reported it, and read-only', () => {
		renderForm(args({pd_disagg_mode: true}), {isEdit: true});
		expect(breaker()?.checked).toBe(false);
		expect(breaker()?.disabled).toBe(true);
		cleanup();

		renderForm(args({pd_disagg_mode: true, cb_enable: true}), {isEdit: true});
		expect(breaker()?.checked).toBe(true);
	});

	it('is not offered when this gateway does not declare the field in /meta', () => {
		renderForm(args({pd_disagg_mode: true}), {params: {}});
		expect(breaker()).toBeNull();
	});

	it('is not offered on an instance whose contract has no such field', () => {
		gateway.knowsField = false;
		renderForm(args({pd_disagg_mode: true}));
		expect(breaker()).toBeNull();
	});
});
