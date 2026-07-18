//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IExtractedHAData, IPieChartData} from 'types/global';
import {IVipConfiguration} from 'types/ha';
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

export function extractHaData(data: IVipConfiguration): IExtractedHAData[] {
	return data.Attr.map((item, index) => ({
		id: index,
		instance: item.instance,
		vip: item.vip,
		state: item.state,
	}));
}
