//---------------------------------------------------------
// Operator maintenance page.
//
// What these pin:
//   - maintenance is not shown as a drain unless inference is refused;
//   - a read that failed shows no state and offers no Enter;
//   - nothing resumes on its own — a run-out window is reported, and Resume
//     is sent only when an operator confirms it;
//   - a change is reported from the read-back, and an accepted change whose
//     read-back fails is not called a success;
//   - a viewer sees the state and neither control.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import MaintenancePage from './MaintenancePage';

type Popup = {title: string; contents: unknown; yes?: string; onYes?: () => void | Promise<void>};

const state = vi.hoisted(() => ({
	query: {} as Record<string, unknown>,
	afterRefetch: undefined as unknown,
	refetchFails: false,
	canWrite: true,
	popups: [] as Popup[],
	enter: vi.fn(),
	leave: vi.fn(),
	invalidated: [] as unknown[],
}));

vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 5, name: 'gw'})}));
vi.mock('hooks/query/oamHooks', () => ({useRole: () => ({can_write_gateway: state.canWrite})}));
vi.mock('hooks/popupHook', () => ({
	usePopUp: () => ({
		openPopUp: (title: string, contents: unknown, yes?: string, _no?: string, onYes?: () => void | Promise<void>) => {
			state.popups.push({title, contents, yes, onYes});
		},
	}),
}));
vi.mock('@tanstack/react-query', async importOriginal => ({
	...(await importOriginal<typeof import('@tanstack/react-query')>()),
	useQueryClient: () => ({invalidateQueries: (arg: unknown) => state.invalidated.push(arg)}),
}));
vi.mock('hooks/query/maintenanceHooks', async importOriginal => ({
	...(await importOriginal<typeof import('hooks/query/maintenanceHooks')>()),
	useMaintenance: () => ({
		...state.query,
		refetch: async () => (state.refetchFails ? {isError: true, data: state.query.data} : {isError: false, data: state.afterRefetch ?? state.query.data}),
	}),
}));
vi.mock('connector/instance/maintenance', async importOriginal => ({
	...(await importOriginal<typeof import('connector/instance/maintenance')>()),
	request_enter_maintenance: state.enter,
	request_leave_maintenance: state.leave,
}));

const read = (data: Record<string, unknown>) => ({data, receivedAtMs: Date.now()});
const loaded = (data: Record<string, unknown>) => ({data: read(data), error: null, dataUpdatedAt: Date.now(), isFetching: false, isPending: false});
const failed = (status: number) => ({data: undefined, error: Object.assign(new Error('x'), {status, name: 'ApiError'}), dataUpdatedAt: 0, isFetching: false, isPending: false});

const ACTIVE = {state: 'active', refusing_new_config: false, refusing_new_inference: false, in_flight_streams: 0, elapsed_seconds: 0, drain_deadline_exceeded: false, cancellable: true};
const DRAINING = {
	state: 'maintenance',
	operation_id: 'op-7',
	refusing_new_config: true,
	refusing_new_inference: true,
	in_flight_requests: 3,
	in_flight_streams: 1,
	entered_at: '2026-10-07T10:00:00Z',
	elapsed_seconds: 42,
	drain_timeout_seconds: 60,
	drain_deadline_exceeded: false,
	cancellable: true,
};

const statOf = (label: string) => screen.getByText(label).parentElement?.lastElementChild?.textContent;
const button = (name: string) => screen.queryByRole('button', {name});
const lastPopup = () => state.popups[state.popups.length - 1];

afterEach(() => {
	cleanup();
	state.query = {};
	state.afterRefetch = undefined;
	state.refetchFails = false;
	state.canWrite = true;
	state.popups = [];
	state.invalidated = [];
	state.enter.mockReset();
	state.leave.mockReset();
});

describe('MaintenancePage state', () => {
	it('shows an active gateway and offers Enter only', () => {
		state.query = loaded(ACTIVE);
		render(<MaintenancePage />);
		expect(screen.getByTestId('maintenance-state').textContent).toContain('Active: the gateway accepts');
		expect(statOf('Refusing new inference requests')).toBe('No');
		expect(statOf('Executing inference requests')).toBe('0');
		expect(button('Enter Maintenance')).not.toBeNull();
		expect(button('Resume')).toBeNull();
	});

	it('shows a drain with its counters and episode, and offers Resume only', () => {
		state.query = loaded(DRAINING);
		render(<MaintenancePage />);
		expect(screen.getByTestId('maintenance-state').textContent).toContain('In maintenance, draining');
		expect(statOf('Executing inference requests')).toBe('3');
		expect(statOf('Open streaming sessions')).toBe('1');
		expect(statOf('Operation ID')).toBe('op-7');
		expect(statOf('Elapsed (seconds)')).toBe('42');
		expect(statOf('Drain window (seconds)')).toBe('60');
		expect(button('Resume')).not.toBeNull();
		expect(button('Enter Maintenance')).toBeNull();
	});

	it('does not call maintenance a drain when inference is not refused', () => {
		state.query = loaded({...DRAINING, refusing_new_inference: false, in_flight_requests: undefined});
		render(<MaintenancePage />);
		const text = screen.getByTestId('maintenance-state').textContent ?? '';
		expect(text).toContain('NOT being refused');
		expect(text).not.toContain('In maintenance, draining');
	});

	it('reports a run-out window and sends nothing', () => {
		state.query = loaded({...DRAINING, drain_deadline_exceeded: true});
		render(<MaintenancePage />);
		expect(screen.getByTestId('maintenance-state').textContent).toContain('drain window has run out');
		expect(statOf('Drain window run out')).toBe('Yes');
		expect(state.leave).not.toHaveBeenCalled();
		expect(state.popups).toHaveLength(0);
	});

	it.each([503, 403])('shows no state and no control when the read fails with %i', status => {
		state.query = failed(status);
		render(<MaintenancePage />);
		expect(screen.queryByTestId('maintenance-state')).toBeNull();
		expect(screen.queryByText(/Active: the gateway accepts/)).toBeNull();
		expect(button('Enter Maintenance')).toBeNull();
		expect(button('Resume')).toBeNull();
	});

	it('keeps Resume and withholds Enter on a state kept from before a failed refresh', () => {
		state.query = {...loaded(DRAINING), error: Object.assign(new Error('x'), {status: 503, name: 'ApiError'})};
		render(<MaintenancePage />);
		expect(button('Resume')).not.toBeNull();
		cleanup();
		state.query = {...loaded(ACTIVE), error: Object.assign(new Error('x'), {status: 503, name: 'ApiError'})};
		render(<MaintenancePage />);
		expect(button('Enter Maintenance')).toHaveProperty('disabled', true);
	});

	it('gives a viewer the state and neither control', () => {
		state.canWrite = false;
		state.query = loaded(DRAINING);
		render(<MaintenancePage />);
		expect(statOf('Executing inference requests')).toBe('3');
		expect(button('Resume')).toBeNull();
		expect(button('Enter Maintenance')).toBeNull();
		expect(screen.getByText(/needs the operator or administrator role/)).not.toBeNull();
	});
});

describe('MaintenancePage changes', () => {
	it('resumes only after the operator confirms, and reports the read-back', async () => {
		state.query = loaded(DRAINING);
		state.afterRefetch = read(ACTIVE);
		state.leave.mockResolvedValue({status: 'confirmed', code: 'maintenance.leave', localeKey: 'x', retryable: false});
		render(<MaintenancePage />);
		fireEvent.click(button('Resume')!);
		expect(state.leave).not.toHaveBeenCalled();
		await lastPopup().onYes!();
		expect(state.leave).toHaveBeenCalledTimes(1);
		expect(lastPopup().title).toBe('Success');
		expect(state.invalidated).toContainEqual({queryKey: ['instance', 'diagnostics', 5]});
	});

	it('does not call an accepted resume a success when the read-back fails', async () => {
		state.query = loaded(DRAINING);
		state.refetchFails = true;
		state.leave.mockResolvedValue({status: 'confirmed', code: 'maintenance.leave', localeKey: 'x', retryable: false});
		render(<MaintenancePage />);
		fireEvent.click(button('Resume')!);
		await lastPopup().onYes!();
		expect(lastPopup().title).toBe('Warning');
		expect(String(lastPopup().contents)).toContain('could not be read back');
	});

	it('does not call an accepted resume a success when the gateway still reports maintenance', async () => {
		state.query = loaded(DRAINING);
		state.leave.mockResolvedValue({status: 'confirmed', code: 'maintenance.leave', localeKey: 'x', retryable: false});
		render(<MaintenancePage />);
		fireEvent.click(button('Resume')!);
		await lastPopup().onYes!();
		expect(lastPopup().title).toBe('Warning');
		expect(String(lastPopup().contents)).toContain('maintenance');
	});

	it('reports a refused resume as an error', async () => {
		state.query = loaded(DRAINING);
		state.leave.mockResolvedValue({status: 'unavailable', code: 'maintenance.leave.unavailable', localeKey: 'The service is temporarily unavailable.', retryable: true, httpStatus: 503});
		render(<MaintenancePage />);
		fireEvent.click(button('Resume')!);
		await lastPopup().onYes!();
		expect(lastPopup().title).toBe('Error');
		expect(String(lastPopup().contents)).toContain('Maintenance was not ended');
	});

	it('enters with the declared window and reports the read-back', async () => {
		state.query = loaded(ACTIVE);
		state.afterRefetch = read(DRAINING);
		state.enter.mockResolvedValue({status: 'confirmed', code: 'maintenance.enter', localeKey: 'x', retryable: false});
		render(<MaintenancePage />);
		fireEvent.click(button('Enter Maintenance')!);
		const confirm = lastPopup();
		const form = render(<>{confirm.contents as never}</>);
		fireEvent.change(form.getByLabelText('Drain window (seconds, optional)'), {target: {value: '90'}});
		await confirm.onYes!();
		await waitFor(() => expect(state.enter).toHaveBeenCalledWith({id: 5, name: 'gw'}, 90));
		expect(lastPopup().title).toBe('Success');
	});

	it('refuses a window that is not whole seconds, and sends nothing', async () => {
		state.query = loaded(ACTIVE);
		render(<MaintenancePage />);
		fireEvent.click(button('Enter Maintenance')!);
		const confirm = lastPopup();
		const form = render(<>{confirm.contents as never}</>);
		fireEvent.change(form.getByLabelText('Drain window (seconds, optional)'), {target: {value: '1.5'}});
		await confirm.onYes!();
		expect(state.enter).not.toHaveBeenCalled();
		expect(lastPopup().title).toBe('Error');
	});
});
