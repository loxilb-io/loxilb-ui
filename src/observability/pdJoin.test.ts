import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {buildEpJoinIndex, joinEp} from './pdJoin';

function snapshotOf(text: string): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs: 0,
		available: true,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

describe('strict P/D endpoint join', () => {
	const SNAPSHOT = snapshotOf([
		'loxilb_pd_ep_info{service="svc-a",ep_idx="0",ep="10.0.0.1:8000"} 1',
		'loxilb_pd_ep_info{service="svc-a",ep_idx="1",ep="10.0.0.2:8000"} 1',
		'loxilb_pd_ep_info{service="svc-b",ep_idx="0",ep="10.0.1.1:8000"} 1',
	].join('\n'));

	it('joins service+ep_idx to the endpoint on a unique match', () => {
		const index = buildEpJoinIndex(SNAPSHOT);
		expect(joinEp(index, 'svc-a', '0')).toEqual({kind: 'ok', ep: '10.0.0.1:8000'});
		expect(joinEp(index, 'svc-b', '0')).toEqual({kind: 'ok', ep: '10.0.1.1:8000'});
	});

	it('an unmatched pair is unknown — ep_idx is never shown as an address', () => {
		const index = buildEpJoinIndex(SNAPSHOT);
		expect(joinEp(index, 'svc-a', '7')).toEqual({kind: 'unknown'});
		expect(joinEp(index, 'svc-missing', '0')).toEqual({kind: 'unknown'});
	});

	it('conflicting info series for one pair are ambiguous — no winner is picked', () => {
		const torn = snapshotOf([
			'loxilb_pd_ep_info{service="svc",ep_idx="0",ep="10.0.0.1:8000"} 1',
			'loxilb_pd_ep_info{service="svc",ep_idx="0",ep="10.0.0.9:8000",extra="x"} 1',
		].join('\n'));
		expect(joinEp(buildEpJoinIndex(torn), 'svc', '0')).toEqual({kind: 'ambiguous'});
	});

	it('a snapshot without the info family joins nothing', () => {
		const index = buildEpJoinIndex(snapshotOf('loxilb_pd_kv_blocks{service="svc",ep_idx="0"} 5'));
		expect(joinEp(index, 'svc', '0')).toEqual({kind: 'unknown'});
	});
});
