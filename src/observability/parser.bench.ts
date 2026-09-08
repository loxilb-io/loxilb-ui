//---------------------------------------------------------
// Opt-in performance lane for the snapshot pipeline (UI-MON-015).
//---------------------------------------------------------
// Run with `npm run bench:observability` — this lane is NEVER part of the
// blocking suite. The recorded product decision fixes the budgets at
// parse+select ≤ 100 ms for a 10K-sample scrape and ≤ 500 ms for 50K
// samples on the reference dev machine; per the reproducibility standard the
// budgets live HERE as reference numbers to compare a bench report against,
// not as wall-clock assertions that would flake under CI load. The blocking
// suite pins behavior instead (one parse per cadence tick, bounded ring).

import {bench, describe} from 'vitest';
import {parseExposition} from './parser';
import {projectFlatSums} from './selectors';
import {IMetricsSnapshot} from 'types/observability';

export const BUDGET_10K_MS = 100;
export const BUDGET_50K_MS = 500;

// Deterministic fixture in the shape of a real gateway scrape: labeled
// counters across services/models, gauges, and histogram ladders — the mix
// that exercises label parsing, identity hashing, and suffix grouping.
function buildFixture(sampleTarget: number): string {
	const lines: string[] = [];
	let samples = 0;
	const bounds = ['0.05', '0.1', '0.5', '1', '5', '10', '+Inf'];
	let series = 0;
	while (samples < sampleTarget) {
		const family = `loxilb_bench_family_${series % 40}`;
		if (series % 40 === 0) {
			lines.push(`# HELP ${family} synthetic benchmark family`);
			lines.push(`# TYPE ${family} ${series % 80 === 0 ? 'histogram' : 'counter'}`);
		}
		if (series % 80 === 0) {
			for (const le of bounds) {
				lines.push(`${family}_bucket{service="svc-${series % 7}",le="${le}"} ${series + 1}`);
				samples++;
			}
			lines.push(`${family}_sum{service="svc-${series % 7}"} ${series * 0.25}`);
			lines.push(`${family}_count{service="svc-${series % 7}"} ${series + 1}`);
			samples += 2;
		} else {
			lines.push(`${family}{service="svc-${series % 7}",model="model-${series % 13}",status="${series % 2 ? 'ok' : 'err'}"} ${series * 3}`);
			samples++;
		}
		series++;
	}
	return lines.join('\n');
}

const FIXTURE_10K = buildFixture(10_000);
const FIXTURE_50K = buildFixture(50_000);

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

describe('parse+select — budget 100 ms at 10K samples', () => {
	bench('parse 10K samples', () => {
		parseExposition(FIXTURE_10K);
	});

	bench('parse + flat projection 10K samples', () => {
		projectFlatSums(snapshotOf(FIXTURE_10K));
	});
});

describe('parse+select — budget 500 ms at 50K samples', () => {
	bench('parse 50K samples', () => {
		parseExposition(FIXTURE_50K);
	});

	bench('parse + flat projection 50K samples', () => {
		projectFlatSums(snapshotOf(FIXTURE_50K));
	});
});
