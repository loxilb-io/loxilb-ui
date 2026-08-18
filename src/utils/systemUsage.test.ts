import {describe, expect, it} from 'vitest';
import {IFilesystemAttribute} from 'types/filesystem';
import {IProcessAttribute} from 'types/process';
import {derive_cpu_usage, derive_disk_usage, derive_memory_usage} from './systemUsage';

// Fixtures are the real payloads from the live loxilb testbed (v0.9.8-dev),
// including its quirks: a process row with no CPUUsage/MemoryUsage at all, and
// a df listing full of container pseudo-filesystems.
const LOXILB_PROCESSES = [
	{pid: '9', command: 'loxilb', CPUUsage: '5.1', MemoryUsage: '0.9'},
	{pid: '1', command: 'bash', CPUUsage: '0.0', MemoryUsage: '0.0'},
	{pid: '290', command: 'top'}, // no usage columns at all
] as IProcessAttribute[];

const LOXILB_FILESYSTEMS = [
	{fileSystem: 'overlay', type: 'overlay', size: '96G', used: '71G', avail: '26G', usePercent: '74%', mountedOn: '/'},
	{fileSystem: 'tmpfs', type: 'tmpfs', size: '64M', used: '0', avail: '64M', usePercent: '0%', mountedOn: '/dev'},
	{fileSystem: 'shm', type: 'tmpfs', size: '64M', used: '0', avail: '64M', usePercent: '0%', mountedOn: '/dev/shm'},
	{fileSystem: 'tmpfs', type: 'tmpfs', size: '1.6G', used: '24M', avail: '1.6G', usePercent: '2%', mountedOn: '/dev/log'},
	{fileSystem: '/dev/vda1', type: 'ext4', size: '96G', used: '71G', avail: '26G', usePercent: '74%', mountedOn: '/etc/hosts'},
] as IFilesystemAttribute[];

describe('derive_cpu_usage', () => {
	it('sums %CPU across the processes top reported', () => {
		expect(derive_cpu_usage(LOXILB_PROCESSES)).toEqual({percent: 5.1, source: 'top', detail: '2'});
	});

	it('skips rows with no CPUUsage instead of counting them as zero', () => {
		// The `top` row carries no usage columns; counting it would drag an
		// average down and imply we measured it.
		expect(derive_cpu_usage(LOXILB_PROCESSES)?.detail).toBe('2');
	});

	it('clamps to 100 (top %CPU is per-core, so a sum can exceed it)', () => {
		const busy = [{CPUUsage: '180.0'}, {CPUUsage: '40.0'}] as IProcessAttribute[];
		expect(derive_cpu_usage(busy)?.percent).toBe(100);
	});

	it('returns undefined when nothing usable is present, so the card says N/A', () => {
		expect(derive_cpu_usage([])).toBeUndefined();
		expect(derive_cpu_usage(undefined)).toBeUndefined();
		expect(derive_cpu_usage([{command: 'top'}] as IProcessAttribute[])).toBeUndefined();
	});
});

describe('derive_memory_usage', () => {
	it('sums %MEM across the processes top reported', () => {
		expect(derive_memory_usage(LOXILB_PROCESSES)).toEqual({percent: 0.9, source: 'top', detail: '2'});
	});

	it('returns undefined rather than 0 when no row carries %MEM', () => {
		expect(derive_memory_usage([{command: 'top'}] as IProcessAttribute[])).toBeUndefined();
	});
});

describe('derive_disk_usage', () => {
	it('reports the root filesystem, not a sum over every mount', () => {
		expect(derive_disk_usage(LOXILB_FILESYSTEMS)).toEqual({percent: 74, source: 'df', detail: '/'});
	});

	it('falls back to the largest real filesystem when / is not listed', () => {
		const noRoot = LOXILB_FILESYSTEMS.filter(fs => fs.mountedOn !== '/');
		// /etc/hosts (ext4, 96G) beats the tmpfs mounts despite being a bind target.
		expect(derive_disk_usage(noRoot)).toEqual({percent: 74, source: 'df', detail: '/etc/hosts'});
	});

	it('does not pick a pseudo-filesystem while a real one exists', () => {
		const tmpfsHeavy = [
			{type: 'tmpfs', size: '900G', usePercent: '99%', mountedOn: '/dev/shm'},
			{type: 'ext4', size: '50G', usePercent: '10%', mountedOn: '/data'},
		] as IFilesystemAttribute[];
		expect(derive_disk_usage(tmpfsHeavy)?.detail).toBe('/data');
	});

	it('still reports something when every mount is a pseudo-filesystem', () => {
		const onlyTmpfs = [{type: 'tmpfs', size: '64M', usePercent: '3%', mountedOn: '/dev'}] as IFilesystemAttribute[];
		expect(derive_disk_usage(onlyTmpfs)?.percent).toBe(3);
	});

	it('returns undefined when df reports nothing parseable', () => {
		expect(derive_disk_usage([])).toBeUndefined();
		expect(derive_disk_usage(undefined)).toBeUndefined();
		expect(derive_disk_usage([{mountedOn: '/', usePercent: '-'}] as IFilesystemAttribute[])).toBeUndefined();
	});
});
