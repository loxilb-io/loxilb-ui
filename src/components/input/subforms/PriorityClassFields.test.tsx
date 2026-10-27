//---------------------------------------------------------
// The request-priority group on identity forms: collapsed on create, open on
// an edit that already declares something; unset offered first and never
// preselected; the JWT scope shows the class only.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {priorityDraftFrom} from 'types/ai_priority';
import PriorityClassFields from './PriorityClassFields';

afterEach(cleanup);

describe('PriorityClassFields', () => {
	it('starts collapsed and opens on request', async () => {
		render(<PriorityClassFields scope="key" value={priorityDraftFrom(null)} onChange={vi.fn()} />);
		expect(screen.queryByLabelText('Priority Class')).toBeNull();
		await userEvent.setup().click(screen.getByRole('button', {name: 'Request Priority'}));
		expect(screen.getByRole('combobox', {name: 'Priority Class'})).toBeTruthy();
	});

	it('offers unset first and does not preselect a class', async () => {
		render(<PriorityClassFields scope="tenant" value={priorityDraftFrom(null)} onChange={vi.fn()} defaultOpen />);
		const user = userEvent.setup();
		const select = screen.getByRole('combobox', {name: 'Priority Class'});
		expect(select.textContent).toContain('Unset (held at standard)');
		await user.click(select);
		const options = within(screen.getByRole('listbox')).getAllByRole('option').map(option => option.textContent);
		expect(options).toEqual(['Unset (held at standard)', 'critical', 'standard', 'sheddable']);
	});

	it('hands the chosen class to the form', async () => {
		const onChange = vi.fn();
		render(<PriorityClassFields scope="key" value={priorityDraftFrom(null)} onChange={onChange} defaultOpen />);
		const user = userEvent.setup();
		await user.click(screen.getByRole('combobox', {name: 'Priority Class'}));
		await user.click(screen.getByRole('option', {name: 'sheddable'}));
		expect(onChange).toHaveBeenLastCalledWith({priority_class: 'sheddable', default_objective: '', allowed_objectives: ''});
	});

	it('shows only the class on a JWT profile', () => {
		render(<PriorityClassFields scope="jwt" value={priorityDraftFrom(null)} onChange={vi.fn()} defaultOpen />);
		expect(screen.getByRole('combobox', {name: 'Priority Class'})).toBeTruthy();
		expect(screen.queryByText('Default Objective')).toBeNull();
	});

	it('shows a warning without blocking when a default objective does not exist', () => {
		render(<PriorityClassFields scope="key" value={{priority_class: '', default_objective: 'missing', allowed_objectives: ''}} onChange={vi.fn()} objectives={[{name: 'gold', priority: 1}]} defaultOpen />);
		expect(screen.getByRole('alert').textContent).toContain('names no objective that exists now');
	});
});
