import {describe, expect, it} from 'vitest';
import {RATE_SAMPLES_REQUIRED, rateWarmUpSeconds} from './RealTimeRateCard';
import {OBSERVABILITY_CADENCE_OPTIONS_MS} from 'preferences';

//---------------------------------------------------------
// The rate card's warm-up must be stated in terms of the cadence ACTUALLY in
// force. Before Stage 5.1 the card asked `useLiveMetrics` for a 1000 ms
// interval, the hook ignored it, and the wait was reported nowhere — so a
// silent skeleton sat on screen for two ticks of the real cadence with nothing
// to distinguish it from a hung card.
//---------------------------------------------------------

describe('rate warm-up estimate', () => {
	it('scales with the cadence rather than with a hard-coded default', () => {
		// ⚠️ THE DEFECT THIS PINS: an estimate that assumed the 10 s default
		// would tell an operator on the 60 s option to wait 20 s, and then keep
		// them waiting two minutes. The gap is the whole complaint.
		expect(rateWarmUpSeconds(0, 10_000)).toBe(30);
		expect(rateWarmUpSeconds(0, 60_000)).toBe(180);
		expect(rateWarmUpSeconds(0, 5_000)).toBe(15);
	});

	it('shrinks as samples arrive', () => {
		expect(rateWarmUpSeconds(1, 10_000)).toBe(20);
		expect(rateWarmUpSeconds(2, 10_000)).toBe(10);
	});

	it('never promises zero or a negative wait', () => {
		// The caller only renders this while the series is still too short, but
		// an estimate of "0s" would read as "ready" on the tick it is not.
		for (const samples of [RATE_SAMPLES_REQUIRED, RATE_SAMPLES_REQUIRED + 5, 99]) {
			expect(rateWarmUpSeconds(samples, 10_000)).toBeGreaterThan(0);
		}
	});

	it('is a whole number of seconds for every pinned cadence option', () => {
		// The string renders it raw, so a fractional value would print as
		// "about 12.5s".
		for (const cadence of OBSERVABILITY_CADENCE_OPTIONS_MS) {
			for (let samples = 0; samples < RATE_SAMPLES_REQUIRED; samples++) {
				expect(Number.isInteger(rateWarmUpSeconds(samples, cadence))).toBe(true);
			}
		}
	});
});
