//---------------------------------------------------------
// Endpoint list — row lifecycle under P/D mode
// (npm test src/components/input/subforms/EndpointListForm.test.tsx)
//
// Pins the fix for the vanishing-row defect: a freshly added row has no IP
// yet, so it lives only in local state; editing ANY of its fields (EP Role
// first is the natural P/D order) must not delete it. The old values→local
// sync effect did exactly that — the parent echoed back the IP-filtered
// list and clobbered the empty row.
//---------------------------------------------------------
import i18n from 'locales/i18n';
import EndpointListForm from './EndpointListForm';
import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, within} from '@testing-library/react';
import {IEndpoint, IServiceArguments} from 'types/load_balancer';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

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

const PD_ARGS = {probetype: '', kvEngineType: 'vllm', pd_disagg_mode: true} as IServiceArguments;

// The parent contract mirrors LBInputForm: it stores whatever onChange
// emits and hands it back as `values` on re-render.
function Harness({onChange}: {onChange: (values: IEndpoint[]) => void}) {
	return <EndpointListForm values={[]} onChange={onChange} params={{}} serviceArguments={PD_ARGS} onServiceArgumentsChange={() => {}} />;
}

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('P/D row lifecycle', () => {
	it('a fresh row survives having its EP Role set before its IP', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(<Harness onChange={onChange} />);

		// The AccordionBox mounts collapsed; open it to reach the Add button.
		await user.click(screen.getByRole('heading', {level: 6, name: 'Endpoints'}));
		await user.click(screen.getByRole('button', {name: /^Add$/}));
		expect(screen.getByLabelText(/^IP( \*)?$/)).toBeTruthy();

		// Natural P/D order: say WHAT the endpoint is before WHERE it lives.
		await user.click(screen.getByLabelText('EP Role'));
		await user.click(within(await screen.findByRole('listbox')).getByText('prefill'));

		// The row is still there, role applied, and the parent has not been
		// handed the incomplete row.
		expect(screen.getByLabelText(/^IP( \*)?$/)).toBeTruthy();
		expect(screen.getByLabelText('EP Role').textContent).toContain('prefill');
		for (const call of onChange.mock.calls) {
			expect(call[0]).toEqual([]);
		}
	});

	it('the row reaches the parent once its IP is filled, with the earlier role intact', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(<Harness onChange={onChange} />);

		// The AccordionBox mounts collapsed; open it to reach the Add button.
		await user.click(screen.getByRole('heading', {level: 6, name: 'Endpoints'}));
		await user.click(screen.getByRole('button', {name: /^Add$/}));
		await user.click(screen.getByLabelText('EP Role'));
		await user.click(within(await screen.findByRole('listbox')).getByText('decode'));
		await user.type(screen.getByLabelText(/^IP( \*)?$/), '198.51.100.9');

		const last = onChange.mock.calls.at(-1)?.[0] as IEndpoint[];
		expect(last).toHaveLength(1);
		expect(last[0].endpointIP).toBe('198.51.100.9');
		expect(last[0].ep_role).toBe(2);
	});
});
