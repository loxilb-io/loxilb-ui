//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IPostParamFieldDesc, ITimeSeriesPoint, MAX_VALUE_BY_FORMAT, UNIT_LIST} from 'types/global';
import {ILog} from 'types/log';
import {IMenuItem, MENU_LIST} from 'types/menu';

//---------------------------------------------------------
// Global Functions
//---------------------------------------------------------
// Common hash function for stable sorting
//---------------------------------------------------------
export function getStableHash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash) + str.charCodeAt(i);
		hash |= 0;
	}
	return hash >>> 0;
}

export function is_logged_in(): boolean {
	return !!localStorage.getItem('access_token');
}

export function forced_relocation_to_login() {
	if (!window.location.href.includes('/login')) {
		console.error('Unauthorized, redirecting to login page');
		move_forced('/login');
	}
}

export function save_local_storage(name: string, value: string) {
	localStorage.setItem(name, value);
}

export function get_local_storage(name: string): string | null {
	return localStorage.getItem(name);
}

export function remove_local_storage(name: string) {
	localStorage.removeItem(name);
}

export function is_mobile_device(): boolean {
	const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
	return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
	if (!bytes || bytes === 0) return '0 Bytes';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const prevent_scroll = {
	overflowX: 'hidden',
	overflowY: 'hidden',
	touchAction: 'none',
	WebkitOverflowScrolling: 'none',
	overscrollBehavior: 'none',
	scrollbarWidth: 'none',
	msOverflowStyle: 'none',
	'&::-webkit-scrollbar': {display: 'none'},
};

export const allow_scroll_y = {
	overflowX: 'hidden',
	overflowY: 'auto',
	touchAction: 'pan-y',
	WebkitOverflowScrolling: 'none',
	overscrollBehavior: 'contain',
	scrollbarWidth: 'none',
	msOverflowStyle: 'none',
	'&::-webkit-scrollbar': {display: 'none'},
};

export const allow_scroll_x = {
	overflowX: 'auto',
	overflowY: 'hidden',
	touchAction: 'pan-x',
	WebkitOverflowScrolling: 'touch',
	overscrollBehavior: 'contain',
	scrollbarWidth: 'none',
	msOverflowStyle: 'none',
	'&::-webkit-scrollbar': {display: 'none'},
};

export const get_url_from_2_depth_name = (menu_list: any, name: string): string => {
	if (!name) return '';
	const menuItem = (Object.values(menu_list) as IMenuItem[]).find(item => item.items?.some(subItem => subItem.name === name));

	if (!menuItem?.items) return '';
	const subMenuItem = menuItem.items.find(item => item.name === name);

	if (!subMenuItem) return '';
	return `/instance/${menuItem.path}/${subMenuItem.path}`;
};

export const get_url_from_3_depth_name = (menu_list: any, name: string): string => {
	if (!name) return '';

	for (const section of Object.values(menu_list) as IMenuItem[]) {
		if (!section.items) continue;

		for (const item of section.items) {
			if (!item.items) continue;

			const subItem = item.items.find(i => i.name === name);
			if (subItem) return `/instance/${section.path}/${item.path}/${subItem.path}`;
		}
	}

	return '';
};
export const get_menu_name_from_path = (menu_list: IMenuItem[], path: string, root: string, depth: number): string => {
	if (!path || !root || depth < 1 || depth > 3) return '';

	const rootSegments = root.split('/').filter(Boolean);
	const pathSegments = path.split('/').filter(Boolean);
	const relativeSegments = pathSegments.slice(rootSegments.length);
	const targetPaths = relativeSegments.slice(0, depth);

	let currentMenuItems: IMenuItem[] = [...menu_list];
	let foundItem: IMenuItem | undefined;

	for (const segment of targetPaths) {
		foundItem = currentMenuItems.find(item => item.path === segment);
		if (!foundItem) return '';
		else currentMenuItems = [...(foundItem.items ?? [])];
	}

	return foundItem?.name || '';
};

export function get_date(date: string) {
	const d = new Date(date);
	const formattedDate = d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
	return formattedDate;
}

export function get_transfer_amount_str(bytes: number, packets: number) {
	const bytes_str = bytes.toLocaleString();
	const packets_str = packets.toLocaleString();
	return `${bytes_str} bytes\n${packets_str} pkts`;
}

export function get_ip_port_str(ip: string, port: number) {
	return `${ip}:${port}`;
}

export function is_active_status(value: any) {
	if (typeof value === 'string') {
		const lower_str = value.toLowerCase();
		return (
			lower_str === 'active' ||
			lower_str === 'synced' ||
			lower_str === 'connected' ||
			lower_str === 'up' ||
			lower_str === 'on' ||
			lower_str === 'ok' ||
			lower_str === 'true' ||
			lower_str === 'yes' ||
			lower_str === 'idle' ||
			lower_str === 'enabled' ||
			lower_str === 'established'
		);
	} else if (typeof value === 'boolean') return value === true;
	else return value === 1;
}

export function get_root_url(): string {
	return process.env.REACT_APP_PUBLIC_URL ?? '';
}

export function move_forced(target: string) {
	if (window.location.href.includes(target)) return;
	else window.location.href = get_root_url() + target;
}

export function move_404() {
	//if (window.location.href.includes('/404')) return;
	//else window.location.href = get_root_url() + '/404';
}

export function move_500(code?: number, message?: string) {
	if (window.location.href.includes('/500')) return;

	sessionStorage.setItem('error_code', code?.toString() || '');
	sessionStorage.setItem('error_message', message || '');
	window.location.href = get_root_url() + '/500';
}

export function move_cors() {
	if (window.location.href.includes('/cors')) return;
	else window.location.href = get_root_url() + '/cors';
}

export function move_home() {
	window.location.href = get_root_url();
}

export function get_menu_root(name: string): string {
	const getDeepestPath = (item: IMenuItem): string => {
		if (item.items && item.items.length > 0) return get_root_url() + '/' + item.path + getDeepestPath(item.items[0]);
		else return '/' + item.path;
	};

	const findMenuItemWithPath = (items: readonly IMenuItem[], parentPath: string = ''): {item: IMenuItem; fullPath: string} | null => {
		for (const item of items) {
			if (item.name === name) {
				return {
					item,
					fullPath: parentPath + '/' + item.path,
				};
			}
			if (item.items && item.items.length > 0) {
				const found = findMenuItemWithPath(item.items, parentPath + '/' + item.path);
				if (found) return found;
			}
		}
		return null;
	};

	const found = findMenuItemWithPath(MENU_LIST);
	if (found) {
		const remainingPath = found.item.items && found.item.items.length > 0 ? getDeepestPath(found.item.items[0]) : '';
		return '/instance' + found.fullPath + remainingPath;
	}

	return '';
}

export function get_speed_rate_str(value: number): string {
	if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)} Gbps`;
	else if (value >= 1000000) return `${(value / 1000000).toFixed(2)} Mbps`;
	else if (value >= 1000) return `${(value / 1000).toFixed(2)} Kbps`;
	else return `${value} bps`;
}

export function get_packet_rate_str(value: number): string {
	if (value >= 1000000) return `${(value / 1000000).toFixed(2)} Mpps`;
	else if (value >= 1000) return `${(value / 1000).toFixed(2)} Kpps`;
	else return `${value.toFixed(2)} pps`;
}

export function formatRate(rate: number, unit: 'bps' | 'pps'): string {
	return unit === 'bps' ? get_speed_rate_str(rate) : get_packet_rate_str(rate);
}

export function detectRateUnit(dataKey: string): 'bps' | 'pps' | 'bytes' | 'packets' {
	const key = dataKey.toLowerCase();
	if (key.includes('rate') || key.includes('_per_sec') || key.includes('bps')) return 'bps';
	if (key.includes('pps') || key.includes('packet') && key.includes('rate')) return 'pps';
	if (key.includes('packet')) return 'packets';
	return 'bytes';
}

export function formatRateForAxis(value: number, unit: 'bps' | 'pps'): string {
	if (value === 0) return '0';
	
	if (unit === 'bps') {
		if (value >= 1e9) return `${(value / 1e9).toFixed(0)}G`;
		if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
		if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
		return value.toFixed(0);
	} else {
		if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
		if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
		return value.toFixed(0);
	}
}

export function formatNumberForAxis(value: number): string {
	if (value === 0) return '0';
	if (value < 1_000) return value.toFixed(0);
	if (value < 1_000_000) return (value / 1_000).toFixed(0) + 'K';
	if (value < 1_000_000_000) return (value / 1_000_000).toFixed(0) + 'M';
	if (value < 1_000_000_000_000) return (value / 1_000_000_000).toFixed(0) + 'B';
	else return (value / 1_000_000_000_000).toFixed(0) + 'T';
}

export function get_size_str(value: number): string {
	if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)} GB`;
	else if (value >= 1000000) return `${(value / 1000000).toFixed(2)} MB`;
	else if (value >= 1000) return `${(value / 1000).toFixed(2)} KB`;
	else return `${value} B`;
}

export function getFlagUrl(countryCode: string) {
	return `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`;
}

export function getScaleInfo(value: number) {
	if (value > 1000000000) return {type: 'Gbps', factor: 1000000000};
	if (value > 1000000) return {type: 'Mbps', factor: 1000000};
	if (value > 1000) return {type: 'Kbps', factor: 1000};
	return {type: 'bps', factor: 1};
}

export function getMaxFromFormat(fieldMeta?: IPostParamFieldDesc): number | undefined {
	if (!fieldMeta?.format) return undefined;
	return MAX_VALUE_BY_FORMAT[fieldMeta.format];
}

export function parse_log_line(line: string): ILog | null {
	// Example log line:
	// ERROR: 2025/05/25 09:15:18 logging.go:51: go-rest-api/internal/services.(*LoxiLBService).FetchLoxiLBInstances.func1: Failed to fetch LoxiLB instances: sql: database is closed

	const regex = /^(ERROR|INFO|WARNING|DEBUG|CRITICAL): (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) ([^:]+): (.+)$/;

	const match = line.match(regex);
	if (!match) {
		// fallback: 좀 더 포괄적인 버전 시도
		const fallbackRegex = /^(ERROR|INFO|WARNING|DEBUG|CRITICAL): (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) (.+?): (.+)$/;
		const fallbackMatch = line.match(fallbackRegex);
		if (!fallbackMatch) return null;

		const [, level, timestamp, programLoc, message] = fallbackMatch;

		return {
			id: 0,
			created_at: timestamp,
			timestamp,
			level,
			message,
			programname: programLoc.trim().split(' ')[0],
			host: '',
		};
	}

	const [, level, timestamp, programLoc, message] = match;

	return {
		id: 0, // ID is not provided in the log line, set to 0 or handle as needed
		created_at: timestamp,
		timestamp,
		level,
		message,
		programname: programLoc.trim().split(' ')[0],
		host: '',
	};
}

export function parse_log_lines(lines: string[]): ILog[] {
	return lines.reduce<ILog[]>((acc, line, idx) => {
		const log = parse_log_line(line);
		if (log) acc.push({...log, id: idx});
		return acc;
	}, []);
}

export function getUnitFromSeries<T>(series: ITimeSeriesPoint<T>[]) {
	if (series.length < 2) return UNIT_LIST[0];

	const last = series[series.length - 1].timestamp;
	const secondLast = series[series.length - 2].timestamp;
	const deltaSec = Math.round((last - secondLast) / 1000);

	const closest = UNIT_LIST.reduce((prev, curr) => (Math.abs(curr.seconds - deltaSec) < Math.abs(prev.seconds - deltaSec) ? curr : prev));

	return closest;
}

export function extract_data_by_timestamp<T>(series: ITimeSeriesPoint<T>[], interval_sec: number, data_count: number, default_value: T = 0 as any): T[] {
	if (series.length === 0) return Array.from({length: data_count}, () => default_value);

	const now = Date.now();
	const interval_ms = interval_sec * 1000;

	return Array.from({length: data_count}, (_, idx) => {
		const target_ts = now - (data_count - 1 - idx) * interval_ms;

		const closest = series.reduce((prev, curr) => {
			const prev_diff = Math.abs(prev.timestamp - target_ts);
			const curr_diff = Math.abs(curr.timestamp - target_ts);
			return curr_diff < prev_diff ? curr : prev;
		}, series[0]);

		// 가까운 데이터가 충분히 가까운 경우만 사용 (interval의 절반 이내)
		if (Math.abs(closest.timestamp - target_ts) < interval_ms / 2) {
			return closest.data;
		}

		return default_value;
	});
}

export function clean_string(input?: string): string {
	return (input ?? '')
		.replace(/\\[nlr]/g, '')
		.replace(/[\n\r]/g, '')
		.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}

export function format_uptime(uptime_str: string): string {
	const seconds = parseFloat(uptime_str.split(' ')[0] ?? '0');
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	const parts = [];
	if (d > 0) parts.push(`${d}d`);
	if (h > 0) parts.push(`${h}h`);
	if (m > 0) parts.push(`${m}m`);
	if (s > 0 || parts.length === 0) parts.push(`${s}s`);

	return parts.join(' ');
}

export function isValidIPv4(ip: string): boolean {
	const ipv4Regex =
		/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
	return ipv4Regex.test(ip);
}

export function isValidIPv6(ip: string): boolean {
	// IPv6 regex pattern
	const ipv6Regex =
		/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
	return ipv6Regex.test(ip);
}

// Validate IPv4 CIDR (e.g., 192.168.1.1/24)
export function isValidIPv4Cidr(cidr: string): boolean {
	const match = cidr.match(/^([0-9.]+)\/(\d{1,2})$/);
	if (!match) return false;
	const ip = match[1];
	const mask = Number(match[2]);
	return isValidIPv4(ip) && mask >= 0 && mask <= 32;
}

// Validate IPv6 CIDR (e.g., 2001:db8::/64)
export function isValidIPv6Cidr(cidr: string): boolean {
	const match = cidr.match(/^([0-9a-fA-F:]+)\/(\d{1,3})$/);
	if (!match) return false;
	const ip = match[1];
	const mask = Number(match[2]);
	return isValidIPv6(ip) && mask >= 0 && mask <= 128;
}

export function isValidIPAddress(ip: string): boolean {
	if (!ip || typeof ip !== 'string') return false;
	return isValidIPv4(ip) || isValidIPv6(ip);
}

export function isValidIPAddressCidr(ip: string): boolean {
	if (!ip || typeof ip !== 'string') return false;
	return isValidIPv4Cidr(ip) || isValidIPv6Cidr(ip);
}

export function isValidPort(port: string | number): boolean {
	if (!port && port !== 0) return false;

	const portNum = typeof port === 'string' ? parseInt(port, 10) : port;

	// Check if it's a valid number and within port range (0-65535)
	return !isNaN(portNum) && portNum >= 0 && portNum <= 65535 && Number.isInteger(portNum);
}

export function isValidMacAddress(mac: string): boolean {
	const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
	return macRegex.test(mac);
}

export function filterUnusedParams(data: any): any {
	if (data === null || typeof data !== 'object') {
		return data; // Return non-objects directly
	}

	if (Array.isArray(data)) {
		// For arrays, process each item recursively
		const filteredArray = data.map(item => filterUnusedParams(item));
		return filteredArray; // Always return the array, even if empty
	}

	const filteredObject: any = {};
	for (const key in data) {
		if (Object.prototype.hasOwnProperty.call(data, key)) {
			const value = data[key];

			// If the value is -1 or '-1', skip adding it
			if (value === -1 || value === '-1' || value === null || value === undefined) {
				continue;
			}

			// If the value is an object (and not null), recurse
			if (typeof value === 'object' && value !== null) {
				const nestedFiltered = filterUnusedParams(value);
				// Always add the key for objects, even if the nested result is empty
				filteredObject[key] = nestedFiltered;
			} else {
				// Otherwise, add the value as is
				filteredObject[key] = value;
			}
		}
	}

	return filteredObject;
}

export const verify_params = (data: any, params: IPostParamFieldDesc): boolean => {
	return true;
};
