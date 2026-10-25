import type {IIPFilterEntry} from './security';
import {networkPrefixKey} from './network_prefix';

export function validIPFilterConfig(data: IIPFilterEntry): boolean {
	const cidr = typeof data.cidr === 'string' ? data.cidr.trim() : '';
	return networkPrefixKey(cidr) !== undefined &&
		(data.zone === undefined || data.zone === 0) &&
		(data.priority === undefined || (Number.isInteger(data.priority) && data.priority >= 0 && data.priority <= 65535)) &&
		((data.filterType === 'whitelist' && data.action === 'allow') || (data.filterType === 'blacklist' && data.action === 'drop'));
}

export function parseIPFilterRows(value: unknown): IIPFilterEntry[] {
	// A real empty Gateway list is explicitly null, verified against /all.
	if (value === null) return [];
	if (!Array.isArray(value) || value.some(row => !row || !validIPFilterConfig(row) || row.priority === undefined || ['packets', 'bytes'].some(field => row[field] !== undefined && !(typeof row[field] === 'number' && Number.isSafeInteger(row[field]) && row[field] >= 0)))) throw new Error('Invalid IP-filter readback.');
	return value as IIPFilterEntry[];
}

const sameIdentity = (a: IIPFilterEntry, b: IIPFilterEntry): boolean => a.filterType === b.filterType && (a.zone ?? 0) === (b.zone ?? 0) && networkPrefixKey(a.cidr) === networkPrefixKey(b.cidr);
export const ipFilterApplied = (want: IIPFilterEntry) => (rows: IIPFilterEntry[]): boolean => rows.some(row => sameIdentity(row, want) && row.action === want.action && (row.priority ?? 0) === (want.priority ?? 100));
export const ipFiltersAbsent = (want: IIPFilterEntry[]) => (rows: IIPFilterEntry[]): boolean => want.every(item => !rows.some(row => sameIdentity(row, item)));
