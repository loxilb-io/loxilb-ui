import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {GET_INST_TEXT} from '../fetcher/fetcher_inst';
import {parse_prometheus_text, project_live_metrics, query_get_live_metrics} from './metrics';
import {query_get_metrics_snapshot} from './observability';

vi.mock('../fetcher/fetcher_inst', () => ({GET_INST_TEXT: vi.fn()}));

// UI-MON-006 compatibility guarantees that metrics.test.ts (kept unmodified
// as the frozen legacy contract) does not cover.
describe('live-metrics compatibility projection', () => {
	const instance = {id: 7, name: 'gw'} as IInstance;
	const mocked = vi.mocked(GET_INST_TEXT);

	beforeEach(() => {
		mocked.mockReset();
	});

	it('critical and important are THE SAME object reference', async () => {
		// The split is typing-only and consumers may rely on the identity —
		// the legacy connector always returned one map under both keys, and
		// the projection must reproduce that, not a structural copy.
		mocked.mockResolvedValue({code: 200, data: 'loxilb_lb_rules 4\n', message: ''});
		const res = await query_get_live_metrics(instance, 'inference-gateway');
		expect(res.important).toBe(res.critical);
	});

	it('projects the snapshot to exactly what the legacy parser produced', async () => {
		// Same body through both paths: the legacy flat parser and the
		// snapshot→projection pipeline must agree key-for-key, so the old
		// fixtures keep protecting the new path.
		const body = [
			'# HELP go_gc_duration_seconds A summary of the pause duration.',
			'go_gc_duration_seconds{quantile="0"} 7.9598e-05',
			'healthy_endpoints_count{service="a"} 2',
			'healthy_endpoints_count{service="b"} 3',
			'broken_metric NaN',
			'loxilb_lb_rules 9',
		].join('\n');
		mocked.mockResolvedValue({code: 200, data: body, message: ''});

		const snap = await query_get_metrics_snapshot(instance, 'inference-gateway');
		const projected = project_live_metrics(snap, 'inference-gateway');
		const legacy = parse_prometheus_text(body);

		// The projection then normalizes; compare the raw flat layer by
		// checking every legacy key survived with the same value.
		for (const [key, value] of Object.entries(legacy)) {
			expect(projected.critical[key], key).toBe(value);
		}
		// NaN was skipped by both pipelines.
		expect(projected.critical['broken_metric']).toBeUndefined();
		// Alias resolution ran on top (gateway table).
		expect(projected.critical['loxilb_healthy_endpoints']).toBe(5);
	});

	it('timestamp is the snapshot receive time', async () => {
		mocked.mockResolvedValue({code: 200, data: 'loxilb_lb_rules 1\n', message: ''});
		const snap = await query_get_metrics_snapshot(instance, 'loxilb');
		expect(project_live_metrics(snap, 'loxilb').timestamp).toBe(snap.receivedAtMs);
	});

	it('carries the snapshot failure through unchanged', async () => {
		mocked.mockResolvedValue({code: 503, data: 'Prometheus option is disabled.', message: ''});
		const res = await query_get_live_metrics(instance, 'loxilb');
		expect(res.failure?.status).toBe('unavailable');
		expect(res.available).toBe(false);
	});
});
