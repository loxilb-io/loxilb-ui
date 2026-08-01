import {describe, expect, it} from 'vitest';
import {IProcessAttribute} from 'types/process';
import {extractTopCpuUsageData} from './extracts';

function proc(pid: string, command: string, cpu: string): IProcessAttribute {
	return {pid, command, CPUUsage: cpu, MemoryUsage: '0'} as IProcessAttribute;
}

describe('extractTopCpuUsageData', () => {
	it('keeps the top N-1 processes, folds the rest into etc, pads with Unused', () => {
		const data = extractTopCpuUsageData(
			[proc('1', 'a', '30'), proc('2', 'b', '20'), proc('3', 'c', '10'), proc('4', 'd', '5'), proc('5', 'e', '4'), proc('6', 'f', '1')],
			5,
		);
		const labels = data.map(d => d.label);
		expect(labels).toContain('a(1)');
		expect(labels).toContain('etc');
		expect(labels).toContain('Unused');
		// pie slices must account for the whole 100%
		const total = data.reduce((s, d) => s + d.value, 0);
		expect(total).toBeCloseTo(100, 0);
	});

	it('renders zero-usage processes with a minimum visible slice', () => {
		const data = extractTopCpuUsageData([proc('1', 'idle', '0')], 5);
		const idle = data.find(d => d.label === 'idle(1)');
		expect(idle!.value).toBeGreaterThan(0);
	});

	it('handles an empty process list', () => {
		const data = extractTopCpuUsageData([], 5);
		// only the Unused filler remains
		expect(data.every(d => d.label === 'Unused')).toBe(true);
	});
});
