import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from 'observability/parser';
import {circuitBreakerLabel} from './SecurityPage';
import {classifyQosPresence, QOS_FAMILIES} from './QosPage';

function snapshotOf(text: string): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs: 1_000_000,
		available: true,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

describe('classifyQosPresence', () => {
	// ⭐ The defect this pins: an unshaped gateway's scrape carries NO QoS
	// family at all — the shaper's custom collector emits nothing, and the
	// exposition writes no HELP/TYPE for a family with no samples. The live
	// gateway proves it. The old rule waited for declared-but-empty families
	// that never arrive, so the no-shaped-service note could never render.
	it('an unshaped gateway (every QoS family absent) classifies as no-shaped-service', () => {
		expect(classifyQosPresence(snapshotOf('loxilb_ai_requests_total 5'))).toBe('no-shaped-service');
	});

	// Kept for a parser that ever preserves an empty family: it means the same.
	it('declared-but-empty families classify as no-shaped-service', () => {
		const text = QOS_FAMILIES.map(f => `# TYPE ${f} counter`).join('\n');
		expect(classifyQosPresence(snapshotOf(text))).toBe('no-shaped-service');
	});

	it('a single sample in any family flips the page to shaped', () => {
		const text = [
			'# TYPE loxilb_proxy_qos_bytes_passed_total counter',
			'loxilb_proxy_qos_bytes_passed_total{vip="10.0.0.1",port="80",proto="tcp",direction="upload"} 42',
		].join('\n');
		expect(classifyQosPresence(snapshotOf(text))).toBe('shaped');
	});

	it('a partially present shaper still reads as unshaped until a sample appears', () => {
		const text = `# TYPE ${QOS_FAMILIES[0]} counter`;
		expect(classifyQosPresence(snapshotOf(text))).toBe('no-shaped-service');
	});
});

describe('circuitBreakerLabel', () => {
	it('maps the pinned 0/1/2 enum', () => {
		expect(circuitBreakerLabel(0)).toBe('closed');
		expect(circuitBreakerLabel(1)).toBe('open');
		expect(circuitBreakerLabel(2)).toBe('half-open');
	});

	// A value outside the pinned vocabulary must surface raw, never be
	// coerced into a known state — the caller renders the number itself.
	it('answers undefined outside the pinned vocabulary', () => {
		expect(circuitBreakerLabel(3)).toBeUndefined();
		expect(circuitBreakerLabel(-1)).toBeUndefined();
		expect(circuitBreakerLabel(undefined)).toBeUndefined();
		expect(circuitBreakerLabel(Number.NaN)).toBeUndefined();
	});
});
