import {describe, expect, it} from 'vitest';
import {formatBytes, getStableHash, get_ip_port_str, parse_log_lines} from './common';

describe('parse_log_lines', () => {
	it('parses the gateway log format (LEVEL: DATE TIME message)', () => {
		const logs = parse_log_lines([
			'INFO: 2025/08/17 09:00:00 ebpf unload - lo',
			'ERR:  2025/08/17 09:00:03 nlp: RT add failed-rt exists',
			'DBG:  2025/08/17 09:00:04 RootCA cert loaded',
		]);
		expect(logs).toHaveLength(3);
		expect(logs[0]).toMatchObject({id: 0, message: 'ebpf unload - lo', timestamp: '2025/08/17 09:00:00'});
		expect(logs[1].level.toLowerCase()).toContain('err');
	});

	it('parses the legacy format (LEVEL: DATE TIME file:line: message)', () => {
		const logs = parse_log_lines(['ERROR: 2025/05/25 07:23:58 logging.go:51: Reconnection failed']);
		expect(logs).toHaveLength(1);
		expect(logs[0].message).toContain('Reconnection failed');
	});

	it('drops lines that match no known format but keeps stable ids for the rest', () => {
		const logs = parse_log_lines(['garbage line', 'INFO: 2025/08/17 09:00:00 ok']);
		expect(logs).toHaveLength(1);
		expect(logs[0].id).toBe(1); // id is the source-line index
	});
});

describe('formatBytes', () => {
	it('formats binary magnitudes', () => {
		expect(formatBytes(0)).toMatch(/^0/);
		expect(formatBytes(1024)).toContain('KB');
		expect(formatBytes(1024 * 1024)).toContain('MB');
	});
});

describe('getStableHash', () => {
	it('is deterministic and differentiates inputs', () => {
		expect(getStableHash('lb-rule-a')).toBe(getStableHash('lb-rule-a'));
		expect(getStableHash('lb-rule-a')).not.toBe(getStableHash('lb-rule-b'));
	});
});

describe('get_ip_port_str', () => {
	it('joins ip and port', () => {
		expect(get_ip_port_str('10.0.0.1', 8080)).toContain('10.0.0.1');
		expect(get_ip_port_str('10.0.0.1', 8080)).toContain('8080');
	});
});
