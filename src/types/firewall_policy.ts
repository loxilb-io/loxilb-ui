import {getStableHash} from 'common';
import type {IFirewallRule, IRuleArguments} from './firewall';
import {networkPrefixKey} from './network_prefix';
const PORTS = ['minSourcePort', 'maxSourcePort', 'minDestinationPort', 'maxDestinationPort'] as const;
const VERDICTS = ['allow', 'drop', 'redirect', 'trap', 'doSnat'] as const;
const integer = (n: unknown, max: number) => n === undefined || (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max);

export function validateFirewallConfig(data: IFirewallRule): string[] {
	const a = data?.ruleArguments; const o = data?.opts; const issues: string[] = [];
	if (!a || !o) return ['configuration'];
	for (const f of [...PORTS, 'preference'] as const) if (!integer(a[f], 65535)) issues.push(f);
	if (!integer(a.protocol, 255)) issues.push('protocol');
	if (a.hwOffload !== undefined && typeof a.hwOffload !== 'boolean') issues.push('hwOffload');
	if (!integer(o.toPort, 65535) || !integer(o.fwMark, 4294967295)) issues.push('options');
	if (!(typeof a.sourceIP === 'string' && a.sourceIP.trim()) && !(typeof a.destinationIP === 'string' && a.destinationIP.trim())) issues.push('match');
	for (const f of ['sourceIP', 'destinationIP'] as const) if (a[f] && networkPrefixKey(a[f]) === undefined) issues.push(f);
	for (const [min, max] of [['minSourcePort', 'maxSourcePort'], ['minDestinationPort', 'maxDestinationPort']] as const) if ((a[min] ?? 0) > (a[max] ?? 0)) issues.push(max);
	if (VERDICTS.filter(f => o[f]).length > 1) issues.push('verdict');
	for (const f of [...VERDICTS, 'record', 'onDefault'] as const) if (o[f] !== undefined && typeof o[f] !== 'boolean') issues.push(f);
	if (o.toIP && (typeof o.toIP !== 'string' || o.toIP.includes('/') || networkPrefixKey(o.toIP) === undefined)) issues.push('toIP');
	if (o.doSnat && (!o.toIP || (o.fwMark ?? 0) !== 0)) issues.push('snat');
	return issues;
}

/** Preference participates in Gateway identity and must fence selection/delete. */
export function firewallIdentity(a: IRuleArguments): string {
	const family = networkPrefixKey(a.sourceIP || a.destinationIP || '0.0.0.0/0')?.startsWith('v6:') ? '::/0' : '0.0.0.0/0';
	return JSON.stringify([a.portName ?? '', networkPrefixKey(a.sourceIP || family), a.minSourcePort ?? 0, a.maxSourcePort ?? 0, networkPrefixKey(a.destinationIP || family), a.minDestinationPort ?? 0, a.maxDestinationPort ?? 0, a.protocol ?? 0, a.preference ?? 0]);
}
export const firewallRowId = (rule: IFirewallRule): number => getStableHash(firewallIdentity(rule.ruleArguments));
export const firewallsAbsent = (want: IFirewallRule[]) => (rows: IFirewallRule[]): boolean => want.every(item => !rows.some(row => firewallIdentity(row.ruleArguments) === firewallIdentity(item.ruleArguments)));
export const firewallApplied = (want: IFirewallRule) => (rows: IFirewallRule[]): boolean => rows.some(row =>
	firewallIdentity(row.ruleArguments) === firewallIdentity(want.ruleArguments) &&
	(want.ruleArguments.hwOffload === undefined || Boolean(row.ruleArguments.hwOffload) === want.ruleArguments.hwOffload) &&
	([...VERDICTS, 'record', 'onDefault'] as const).every(f => want.opts[f] === undefined || Boolean(row.opts[f]) === want.opts[f]) &&
	(['redirectPortName', 'toIP', 'toPort', 'fwMark'] as const).every(f =>
		want.opts[f] === undefined || (f === 'fwMark' && want.opts.doSnat && want.opts[f] === 0) ||
		(row.opts[f] ?? (typeof want.opts[f] === 'number' ? 0 : '')) === want.opts[f]));

export function parseFirewallRows(value: unknown): IFirewallRule[] {
	if (value === null) return [];
	if (!Array.isArray(value)) throw new Error('Invalid firewall readback.');
	for (const row of value) {
		const a = row?.ruleArguments; const o = row?.opts;
		if (!a || typeof a !== 'object' || !o || typeof o !== 'object' || networkPrefixKey(a.sourceIP) === undefined || networkPrefixKey(a.destinationIP) === undefined) throw new Error('Invalid firewall readback.');
		for (const f of [...PORTS, 'preference']) if (!integer(a[f], 65535)) throw new Error('Invalid firewall readback.');
		if (!integer(a.protocol, 255) || !integer(o.toPort, 65535) || !integer(o.fwMark, 4294967295)) throw new Error('Invalid firewall readback.');
		for (const f of [...VERDICTS, 'record', 'onDefault']) if (o[f] !== undefined && typeof o[f] !== 'boolean') throw new Error('Invalid firewall readback.');
		if (o.counter !== undefined && typeof o.counter !== 'string') throw new Error('Invalid firewall readback.');
	}
	return value as IFirewallRule[];
}
