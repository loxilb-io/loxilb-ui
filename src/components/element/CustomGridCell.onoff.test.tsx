import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {OnOffCell} from './CustomGridCell';

vi.mock('i18next', () => ({t: (key: string) => key}));
afterEach(cleanup);

describe('OnOffCell accessible configuration state', () => {
	it.each([[true, 'Enabled'], [false, 'Disabled'], [undefined, 'Not reported'], [null, 'Not reported']])('reports %s using visible text', (value, label) => {
		render(<OnOffCell value={value} />);
		expect(screen.getByText(label as string)).toBeTruthy();
	});
});
