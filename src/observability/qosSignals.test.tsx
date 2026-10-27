//---------------------------------------------------------
// QoS page signals: band outcomes, log loss, rule pools (gateway 9f5017e2).
//
// Pins: rates over the measured interval only; parks kept apart from the
// four terminal outcomes; an absent family is a reading, never 0; a scrape
// failure is no data; a reset is typed.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {BandOutcomesPanel, LogLossPanel, ProxyPoolsPanel} from 'components/observability/QosSignalPanels';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {bandOutcomes, logLoss, proxyPools} from './qosSignals';

afterEach(cleanup);

function snapshotOf(text: string, receivedAtMs: number, over: Partial<IMetricsSnapshot> = {}): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs, available: true, families: parsed.families, diagnostics: parsed.diagnostics, ...over};
}

const T0 = 1_000_000;
const T1 = T0 + 10_000;

const band = (service: string, rows: Record<string, Record<string, number>>) =>
	Object.entries(rows).flatMap(([b, outcomes]) => Object.entries(outcomes).map(([o, v]) => `loxilb_ai_fc_band_total{service="${service}",band="${b}",outcome="${o}"} ${v}`));

const zeros = {admitted: 0, queued: 0, shed: 0, expired: 0, cancelled: 0};

describe('admission by priority band', () => {
	it('rates each outcome per service and band, parks apart, over the measured interval', () => {
		const before = band('10.0.0.1:443', {critical: zeros, standard: zeros, sheddable: zeros}).join('\n');
		const after = band('10.0.0.1:443', {critical: {...zeros, admitted: 50}, standard: {...zeros, admitted: 20, queued: 10}, sheddable: {...zeros, shed: 5, queued: 30}}).join('\n');
		const report = bandOutcomes([snapshotOf(before, T0), snapshotOf(after, T1)]);
		expect(report.kind).toBe('ok');
		if (report.kind !== 'ok') return;
		expect(report.intervalMs).toBe(10_000);
		const [service] = report.services;
		expect(service.bands.map(b => b.band)).toEqual(['critical', 'standard', 'sheddable']);
		expect(service.bands[0].outcomes.admitted).toEqual({kind: 'ok', perSecond: 5, intervalMs: 10_000});
		expect(service.bands[2].outcomes.shed).toEqual({kind: 'ok', perSecond: 0.5, intervalMs: 10_000});
		expect(service.bands[2].parks).toEqual({kind: 'ok', perSecond: 3, intervalMs: 10_000});
		expect(Object.keys(service.bands[2].outcomes)).toEqual(['admitted', 'shed', 'expired', 'cancelled']);
	});

	it('warms up on one snapshot instead of inventing a rate', () => {
		const report = bandOutcomes([snapshotOf(band('s', {critical: zeros}).join('\n'), T0)]);
		expect(report.kind === 'ok' && report.services[0].bands[0].outcomes.admitted).toEqual({kind: 'insufficient-samples'});
		expect(report.kind === 'ok' && report.intervalMs).toBeUndefined();
	});

	it('reads an absent family from the manifest, never as zero', () => {
		const report = bandOutcomes([snapshotOf('other_metric 1', T0)]);
		expect(report).toEqual({kind: 'absent', reading: {kind: 'conditional', precondition: expect.stringContaining('AI-gateway service')}});
	});

	it('is no data when the scrape failed', () => {
		expect(bandOutcomes([snapshotOf('', T0, {available: false})])).toEqual({kind: 'no-data'});
	});

	it('renders parks as their own column with the interval said', () => {
		const before = band('svc', {critical: zeros}).join('\n');
		const after = band('svc', {critical: {...zeros, admitted: 10, queued: 20}}).join('\n');
		render(<BandOutcomesPanel report={bandOutcomes([snapshotOf(before, T0), snapshotOf(after, T1)])} />);
		expect(screen.getAllByRole('columnheader').map(c => c.textContent)).toEqual(['svc', 'Admitted', 'Shed', 'Expired', 'Cancelled', 'Parks']);
		expect(screen.getByText(/measured interval of 10 s/)).toBeTruthy();
		expect(screen.queryByText(/hour/)).toBeNull();
	});
});

describe('log loss', () => {
	const levels = (v: Record<string, number>) => ['error', 'warn', 'notice', 'info', 'debug', 'trace'].map(l => `loxilb_log_lines_dropped_total{level="${l}"} ${v[l] ?? 0}`).join('\n');

	it('reports dropping now apart from drops earlier since start', () => {
		const dropping = logLoss([snapshotOf(levels({info: 5}), T0), snapshotOf(levels({info: 25}), T1)]);
		expect(dropping.kind === 'ok' && dropping.dropping).toBe(true);
		const earlier = logLoss([snapshotOf(levels({info: 5}), T0), snapshotOf(levels({info: 5}), T1)]);
		expect(earlier.kind === 'ok' && [earlier.dropping, earlier.everDropped]).toEqual([false, true]);
		const clean = logLoss([snapshotOf(levels({}), T0), snapshotOf(levels({}), T1)]);
		expect(clean.kind === 'ok' && [clean.dropping, clean.everDropped]).toEqual([false, false]);
	});

	it('keeps the level order and types a reset', () => {
		const report = logLoss([snapshotOf(levels({warn: 100}), T0), snapshotOf(levels({warn: 2}), T1)]);
		expect(report.kind === 'ok' && report.levels.map(l => l.level)).toEqual(['error', 'warn', 'notice', 'info', 'debug', 'trace']);
		expect(report.kind === 'ok' && report.levels[1].rate).toEqual({kind: 'reset'});
	});

	it('warns while lines are dropped', () => {
		render(<LogLossPanel report={logLoss([snapshotOf(levels({}), T0), snapshotOf(levels({error: 3}), T1)])} />);
		expect(screen.getByRole('alert').textContent).toContain('Log lines are being dropped');
	});
});

describe('rule pools', () => {
	it('reports pools held, the change, and the freeing rate', () => {
		const report = proxyPools([
			snapshotOf('loxilb_proxy_pools_live 4\nloxilb_proxy_pools_freed_total 10', T0),
			snapshotOf('loxilb_proxy_pools_live 6\nloxilb_proxy_pools_freed_total 12', T1),
		]);
		expect(report).toMatchObject({kind: 'ok', live: 6, livePrevious: 4, freedTotal: 12, freedRate: {kind: 'ok', perSecond: 0.2}});
	});

	it('never calls growth a leak', () => {
		render(<ProxyPoolsPanel report={proxyPools([snapshotOf('loxilb_proxy_pools_live 4\nloxilb_proxy_pools_freed_total 0', T0), snapshotOf('loxilb_proxy_pools_live 9\nloxilb_proxy_pools_freed_total 0', T1)])} />);
		expect(screen.getByText(/Pools held now: 9/).textContent).toContain('(+5)');
		expect(screen.getByText(/growth alone is not a leak/)).toBeTruthy();
	});

	it('reads an absent live gauge from the manifest', () => {
		expect(proxyPools([snapshotOf('other 1', T0)]).kind).toBe('absent');
	});
});
