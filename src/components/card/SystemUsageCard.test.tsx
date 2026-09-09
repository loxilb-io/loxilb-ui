//---------------------------------------------------------
// System Usage card — System Information block.
//
// jsdom has no layout engine, so this cannot assert that the fields line up.
// What it can pin is the structure that makes them line up (one grid, not a
// row of independent per-column stacks — as columns, a value that wrapped
// pushed only its own column down) and the honesty of an unreported field.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import SystemUsageCard from './SystemUsageCard';

const status = vi.hoisted(() => ({current: {} as any}));

vi.mock('hooks/query/metricsHook', () => ({
	useLiveMetrics: () => ({metrics: undefined, isLoading: false, failure: undefined, refetch: vi.fn()}),
}));

vi.mock('hooks/query/statusHook', () => ({
	useStatus: () => status.current,
}));

const INSTANCE = {id: 1, name: 'gw'} as any;

function renderCard(systemInfo: Record<string, string | undefined> | undefined) {
	status.current = {processAttr: undefined, systemInfo, filesystemAttr: undefined};
	return render(<SystemUsageCard instance={INSTANCE} />);
}

afterEach(() => {
	cleanup();
});

describe('System Information block', () => {
	const infoGrid = () => screen.getByTestId('system-information');

	it('lays the fields out in a single grid so rows share a baseline', () => {
		renderCard({hostName: 'h', bootID: 'b', uptime: 'u', OS: 'o', machineID: 'm', kernel: 'k', architecture: 'a'});

		const grid = infoGrid();
		// Every field is a direct child of that ONE container. When these were
		// separate per-column stacks, a wrapped value pushed the field beneath
		// it down while the other columns stayed put. (jsdom cannot check the
		// resulting geometry; the single container is the structural cause.)
		const cells = new Set(Array.from(grid.children));
		for (const field of ['Host Name', 'Boot ID', 'Uptime', 'OS', 'Machine ID', 'Kernel', 'Architecture']) {
			expect(cells.has(within(grid).getByText(field).parentElement!), field).toBe(true);
		}
		expect(grid.children.length).toBe(7);
	});

	it('says N/A for a field the instance does not report', () => {
		// It used to print "Available" — the pie chart's slice label — which
		// reads as a statement about the machine rather than absence of data.
		renderCard({hostName: 'h'});

		const grid = infoGrid();
		expect(within(grid).getByText('Host Name')).toBeDefined();
		expect(within(grid).queryByText('Available')).toBeNull();
		// Six unreported fields, each rendering the absence marker.
		expect(within(grid).getAllByText('N/A')).toHaveLength(6);
	});

	it('treats an empty string from /status as unreported, not as a blank value', () => {
		renderCard({hostName: '', bootID: '   ', uptime: 'u', OS: 'o', machineID: 'm', kernel: 'k', architecture: 'a'});

		expect(within(infoGrid()).getAllByText('N/A')).toHaveLength(2);
	});
});
