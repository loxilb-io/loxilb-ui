//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IFilesystemAttribute} from 'types/filesystem';
import {IExtractedHAData, IPieChartData, ITimelineDataSet} from 'types/global';
import {IVipConfiguration} from 'types/ha';
import {ILBRuleCount} from 'types/metrics';
import {IProcessAttribute} from 'types/process';

const MIN_VISIBLE_VALUE = 0.0001;

//---------------------------------------------------------
// Functions
//---------------------------------------------------------
export function extractTopCpuUsageData(processes: IProcessAttribute[], maxItems: number = 5): IPieChartData[] {
	const all = processes.map((p, i) => {
		const cpu = parseFloat(p.CPUUsage);
		return {
			id: `cpu-${i}`,
			value: cpu > 0 ? cpu : MIN_VISIBLE_VALUE,
			original: cpu,
			label: `${p.command}(${p.pid})`,
		};
	});

	const total = all.reduce((sum, p) => sum + p.original, 0);
	const sorted = all.sort((a, b) => b.value - a.value);
	const top = sorted.slice(0, maxItems - 1);
	const rest = sorted.slice(maxItems - 1);
	const etc = rest.reduce((sum, p) => sum + p.value, 0);

	if (rest.length > 0) top.push({id: `cpu-${maxItems}`, value: etc, original: etc, label: 'etc'});

	const unused = Math.max(0, 100 - total);
	if (unused > 0) top.push({id: `cpu-${maxItems + 1}`, value: unused, original: unused, label: 'Unused'});

	return top.map(({original, ...d}) => d);
}

export function extractTopMemoryUsageData(processes: IProcessAttribute[], maxItems: number = 5): IPieChartData[] {
	const all = processes.map((p, i) => {
		const mem = parseFloat(p.MemoryUsage);
		return {
			id: `mem-${i}`,
			value: mem > 0 ? mem : 0.0,
			original: mem,
			label: `${p.pid} - ${p.command}`,
		};
	});

	const total = all.reduce((sum, p) => sum + p.original, 0);
	const sorted = all.sort((a, b) => b.value - a.value);
	const top = sorted.slice(0, maxItems - 1);
	const rest = sorted.slice(maxItems - 1);
	const etc = rest.reduce((sum, p) => sum + p.value, 0);

	if (rest.length > 0) top.push({id: `mem-${maxItems}`, value: etc, original: etc, label: 'etc'});

	const unused = Math.max(0, 100 - total);
	if (unused > 0) top.push({id: `mem-${maxItems + 1}`, value: unused, original: unused, label: 'Unused'});

	return top.map(({original, ...d}) => d);
}

export function extractTopDiskUsageData(filesystems: IFilesystemAttribute[], maxItems: number = 5): IPieChartData[] {
	const all = filesystems.map((fs, i) => {
		const used = parseFloat(fs.used);
		return {
			id: `disk-${i}`,
			value: used > 0 ? used : MIN_VISIBLE_VALUE,
			original: used,
			label: `${fs.mountedOn}`,
		};
	});

	const total = all.reduce((sum, fs) => sum + fs.original, 0);
	const sorted = all.sort((a, b) => b.value - a.value);
	const top = sorted.slice(0, maxItems - 1);
	const rest = sorted.slice(maxItems - 1);
	const etc = rest.reduce((sum, fs) => sum + fs.value, 0);

	if (rest.length > 0) top.push({id: `fs-${maxItems}`, value: etc, original: etc, label: 'etc'});

	const unused = Math.max(0, 100 - total);
	if (unused > 0) top.push({id: `fs-${maxItems + 1}`, value: unused, original: unused, label: 'Unused'});

	return top.map(({original, ...d}) => d);
}

export function extractHaData(data: IVipConfiguration): IExtractedHAData[] {
	return data.Attr.map((item, index) => ({
		id: index,
		instance: item.instance,
		vip: item.vip,
		state: item.state,
	}));
}

export function extractLBRuleData(data: ILBRuleCount[], maxItems: number = 5): ITimelineDataSet {
	const now = Date.now();
	const croppedData = data.slice(0, maxItems);

	return {
		label: 'LB Rule',
		values: croppedData.map((item, i) => ({
			timestamp: now - (croppedData.length - 1 - i) * 1000,
			data: item.lb_rule_count ?? 0,
		})),
	};
}
