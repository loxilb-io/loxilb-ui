//---------------------------------------------------------
// Admission control group on the AI rule form.
//
// Pins the one thing only a mounted form can break: what a keystroke turns
// into. On these fields 0 means "reset to the process default", so a cleared
// box must reach the form as undefined (omitted), never 0, and text that is not
// a whole number in range must reach it as-is, so the AI validator refuses it
// instead of the value silently vanishing. The serializer and validator halves
// are pinned in types/ai_gateway.test.ts.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {FC_FIELDS} from 'types/ai_gateway';
import {IServiceArguments} from 'types/load_balancer';
import AdmissionControlForm from './AdmissionControlForm';

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp', mode: 4, sse_mode: true, ...over} as IServiceArguments;
}

function renderForm(value: IServiceArguments, opts: {pdTopology?: boolean; isEdit?: boolean; declared?: readonly (keyof IServiceArguments)[]} = {}) {
	const onChange = vi.fn();
	const declared = new Set(opts.declared ?? FC_FIELDS);
	render(<AdmissionControlForm value={value} onChange={onChange} pdTopology={opts.pdTopology ?? false} isEdit={opts.isEdit ?? false} declared={declared} />);
	return onChange;
}

const box = (name: string) => screen.getByRole('textbox', {name});
/** Every value the form was handed for one field, in order. */
const sent = (onChange: ReturnType<typeof vi.fn>, field: string) =>
	onChange.mock.calls.map(([delta]) => delta).filter(delta => field in delta).map(delta => delta[field]);

async function expand() {
	await userEvent.setup().click(screen.getByRole('button', {name: 'Admission Control'}));
}

afterEach(cleanup);

describe('AdmissionControlForm', () => {
	it('hands the form the integer typed, and undefined — never 0 — once the box is cleared', async () => {
		const onChange = renderForm(args());
		await expand();
		const user = userEvent.setup();
		await user.type(box('Max Outstanding'), '64');
		expect(sent(onChange, 'fc_max_outstanding').at(-1)).toBe(64);
		await user.clear(box('Max Outstanding'));
		await user.tab();
		expect(sent(onChange, 'fc_max_outstanding').at(-1)).toBeUndefined();
		expect(sent(onChange, 'fc_max_outstanding')).not.toContain(0);
		expect((box('Max Outstanding') as HTMLInputElement).value).toBe('');
	});

	it('keeps an explicit 0, which the gateway reads as "reset to the default"', async () => {
		const onChange = renderForm(args());
		await expand();
		await userEvent.setup().type(box('Endpoint Warm-up (ms)'), '0');
		expect(sent(onChange, 'fc_warmup_ms').at(-1)).toBe(0);
	});

	it('passes unparseable or out-of-range text through as text, with the reason shown, never clamped', async () => {
		const onChange = renderForm(args());
		await expand();
		const user = userEvent.setup();
		await user.type(box('Max Outstanding'), '12x');
		expect(sent(onChange, 'fc_max_outstanding').at(-1)).toBe('12x');
		expect(screen.getByText('Must be a whole number.')).toBeTruthy();
		await user.clear(box('Max Outstanding'));
		await user.type(box('Max Outstanding'), '100001');
		expect(sent(onChange, 'fc_max_outstanding').at(-1)).toBe('100001');
		expect(screen.getByText('Must be at most 100000.')).toBeTruthy();
		expect((box('Max Outstanding') as HTMLInputElement).value).toBe('100001');
	});

	it('never hands the mode or adaptive selectors an empty string: "Gateway default" is omitted', () => {
		const onChange = renderForm(args());
		// The dropdowns announce their first item on an empty value at mount.
		expect(sent(onChange, 'fc_mode').every(value => value === undefined)).toBe(true);
		expect(sent(onChange, 'fc_adaptive').every(value => value === undefined)).toBe(true);
		expect(sent(onChange, 'fc_expose_headers').every(value => value === undefined)).toBe(true);
	});

	it('preserves an explicit response header mode in its declared selector', () => {
		const onChange = renderForm(args({fc_expose_headers: 'off'}));
		expect(screen.getByLabelText('Admission Response Headers')).toBeTruthy();
		expect(sent(onChange, 'fc_expose_headers')).not.toContain(undefined);
	});

	it('shows the P/D-only fields only on a P/D rule', async () => {
		renderForm(args());
		await expand();
		expect(screen.queryByRole('textbox', {name: 'Prefill Max Inflight'})).toBeNull();
		expect(screen.queryByRole('textbox', {name: 'Telemetry Stale (ms)'})).toBeNull();
		cleanup();
		renderForm(args({pd_disagg_mode: true}), {pdTopology: true});
		await expand();
		for (const name of ['Prefill Max Inflight', 'Decode Max Inflight', 'Telemetry Stale (ms)']) expect(box(name)).toBeTruthy();
	});

	it('opens already expanded on a rule that declares admission fields, showing their values', () => {
		renderForm(args({fc_mode: 'observe', fc_max_outstanding: 64, fc_max_queue_depth: 8, fc_max_queue_wait_ms: 2000}), {isEdit: true});
		expect(screen.getByRole('button', {name: 'Admission Control'}).getAttribute('aria-expanded')).toBe('true');
		expect((box('Max Outstanding') as HTMLInputElement).value).toBe('64');
		expect((box('Queue Wait (ms)') as HTMLInputElement).value).toBe('2000');
		expect(screen.getByText(/cannot be changed in place/)).toBeTruthy();
	});

	it('starts collapsed on a rule that declares nothing', () => {
		renderForm(args());
		expect(screen.getByRole('button', {name: 'Admission Control'}).getAttribute('aria-expanded')).toBe('false');
	});

	it('says a TTFT target does nothing while the adaptive ceiling is explicitly off', async () => {
		renderForm(args({fc_adaptive: 'off', fc_ttft_target_ms: 800}));
		expect(screen.getByText('A TTFT target has no effect while the adaptive ceiling is off.')).toBeTruthy();
		cleanup();
		// Gateway default may be adaptive through the environment: no claim.
		renderForm(args({fc_ttft_target_ms: 800}));
		expect(screen.queryByText('A TTFT target has no effect while the adaptive ceiling is off.')).toBeNull();
	});
	it('offers only the fields this gateway declares, so none can be dropped behind a 200', async () => {
		// The testbed build before per-rule admission knew only the queue pair.
		renderForm(args(), {pdTopology: true, declared: ['fc_max_queue_depth', 'fc_max_queue_wait_ms']});
		await expand();
		expect(box('Queue Depth')).toBeTruthy();
		expect(box('Queue Wait (ms)')).toBeTruthy();
		for (const name of ['Max Outstanding', 'Per-endpoint Max Inflight', 'Prefill Max Inflight', 'TTFT Target (ms)', 'Endpoint Warm-up (ms)']) {
			expect(screen.queryByRole('textbox', {name})).toBeNull();
		}
		expect(screen.queryByLabelText('Admission Mode')).toBeNull();
		expect(screen.queryByLabelText('Adaptive Ceiling')).toBeNull();
		expect(screen.queryByLabelText('Admission Response Headers')).toBeNull();
	});
});
