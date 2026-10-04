import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {GET_INST_TEXT} from '../fetcher/fetcher_inst';
import {query_get_metrics_snapshot} from './observability';

vi.mock('../fetcher/fetcher_inst', () => ({GET_INST_TEXT: vi.fn()}));

// The snapshot connector shares the response shapes of the legacy flat read:
// the same three real-deployment fixtures (disabled, refused, healthy) plus
// the parser-limit path only the snapshot layer has.
describe('query_get_metrics_snapshot', () => {
	const instance = {id: 14, name: 'gw'} as IInstance;
	const mocked = vi.mocked(GET_INST_TEXT);

	const respond = (code: number, data: string | null) => {
		mocked.mockResolvedValue({code, data, message: ''});
	};

	beforeEach(() => {
		mocked.mockReset();
	});

	it('maps the disabled 503 with its exact prose body to unavailable', async () => {
		// The gateway's real disabled response, pinned verbatim per the risk
		// table. Detection is by STATUS — the prose is unversioned and only
		// appears here to prove it is not what the mapping keys on.
		respond(503, 'Prometheus option is disabled.');
		const snap = await query_get_metrics_snapshot(instance, 'inference-gateway');
		expect(snap.available).toBe(false);
		expect(snap.failure?.status).toBe('unavailable');
		expect(snap.families.size).toBe(0);
	});

	it('maps a refused scrape (401) to denied — never empty healthy data', async () => {
		respond(401, null);
		const snap = await query_get_metrics_snapshot(instance, 'inference-gateway');
		expect(snap.available).toBe(false);
		expect(snap.failure?.status).toBe('denied');
	});

	it('a healthy scrape carries families, diagnostics, and a receive time', async () => {
		respond(200, [
			'# TYPE loxilb_ai_active_streams gauge',
			'loxilb_ai_active_streams{model="m1"} 2',
			'loxilb_lb_rules 4',
		].join('\n'));
		const before = Date.now();
		const snap = await query_get_metrics_snapshot(instance, 'inference-gateway');
		expect(snap.available).toBe(true);
		expect(snap.failure).toBeUndefined();
		expect(snap.families.get('loxilb_ai_active_streams')!.samples[0].labels.model).toBe('m1');
		expect(snap.diagnostics.totalSamples).toBe(2);
		// receivedAtMs is the client fetch-completion time — the only
		// timing claim a scrape without a server timestamp can make.
		expect(snap.receivedAtMs).toBeGreaterThanOrEqual(before);
		expect(snap.instanceId).toBe(14);
		expect(snap.flavor).toBe('inference-gateway');
	});

	it('a 200 body that parses to nothing is unavailable data without a failure', async () => {
		respond(200, '"Prometheus option is disabled."');
		const snap = await query_get_metrics_snapshot(instance, 'loxilb');
		expect(snap.available).toBe(false);
		expect(snap.failure).toBeUndefined();
		expect(snap.diagnostics.skippedSamples).toBe(1);
	});

	it('a breached parser limit is a typed failure, not silent truncation', async () => {
		const big = 'x'.repeat(5_000);
		respond(200, `ok_metric 1\nm{v="${big}"} 1`);
		const snap = await query_get_metrics_snapshot(instance, 'inference-gateway');
		expect(snap.available).toBe(false);
		expect(snap.failure?.status).toBe('failed');
		expect(snap.failure?.code).toBe('observability.scrape.limit_label_length');
	});
});
