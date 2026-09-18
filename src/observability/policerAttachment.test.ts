import {describe, expect, it} from 'vitest';
import {IPolicyAttribute} from 'types/qos';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {
	POLICER_ATTACHED,
	attachmentVerdict,
	policerAttachment,
} from './policerAttachment';

function snapshotOf(text: string, failure?: IMetricsSnapshot['failure']): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		// Fixed, not Date.now(): nothing in this module reads the clock, and a
		// live timestamp would make the suite's behaviour depend on when it runs.
		receivedAtMs: 1_700_000_000_000,
		available: true,
		failure,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

/**
 * ⚠️ A series exists only for a CONFIGURED policer — the collector walks a
 * live store, so every fixture lists exactly the idents it wants and nothing
 * else. An absent ident is "the gauge has no series for it", which is a
 * distinct input from the value 0.
 */
function gauge(lines: readonly {ident: string; value: number}[]): string {
	return lines.map(l => `${POLICER_ATTACHED}{ident="${l.ident}"} ${l.value}`).join('\n');
}

/** A policy entry carrying only what this module reads. */
function policy(policyIdent: string, attached?: boolean): IPolicyAttribute {
	return {
		policyIdent,
		...(attached === undefined ? {} : {attached}),
		policyInfo: {type: 0, colorAware: false, committedInfoRate: 100, peakInfoRate: 0, committedBlkSize: 0, excessBlkSize: 0},
		targetObject: {attachment: 0, polObjName: '10.0.0.1:18080:tcp'},
	};
}

const ok = (r: ReturnType<typeof policerAttachment>) => {
	if (r.kind !== 'ok') throw new Error(`expected ok, got ${r.kind}`);
	return r;
};
const rowFor = (r: ReturnType<typeof policerAttachment>, ident: string) => {
	const row = ok(r).rows.find(x => x.ident === ident);
	if (!row) throw new Error(`no row for ${ident}`);
	return row;
};

describe('policerAttachment — the attachment answer', () => {
	it('reads gauge 0 as shaping nothing and 1 as shaping', () => {
		const r = policerAttachment(snapshotOf(gauge([{ident: 'p-live', value: 1}, {ident: 'p-ghost', value: 0}])), [
			policy('p-live', true),
			policy('p-ghost', false),
		]);
		expect(rowFor(r, 'p-live').attached).toBe(true);
		expect(rowFor(r, 'p-ghost').attached).toBe(false);
		expect(rowFor(r, 'p-ghost').corroboration).toBe('agreed');
		expect(ok(r).verdict).toBe('pending-attachment');
	});

	it('never coerces a non-finite gauge sample into a pending finding', () => {
		// ⚠️ The defect this pins: `NaN > 0` and `NaN !== 0` both evaluate
		// falsey/truthy in ways that silently invent an answer. A sample that
		// is not a number must leave the metric side UNKNOWN, because the
		// alternative is reporting "configured but shaping nothing" — an
		// operator-facing alarm — on a scrape defect.
		const r = policerAttachment(snapshotOf(`${POLICER_ATTACHED}{ident="p1"} NaN`), [policy('p1')]);
		expect(rowFor(r, 'p1').metricAttached).toBeUndefined();
		expect(rowFor(r, 'p1').attached).toBeUndefined();
		expect(ok(r).verdict).not.toBe('pending-attachment');
	});

	it('treats a conflict as unknown rather than picking a winner', () => {
		// ⭐⭐ The correction at the heart of this module. REST `attached` and
		// the gauge are the SAME PolEntry.attached() predicate read at
		// different times, so a disagreement carries no information about
		// which is right — only that the state moved inside the last scrape.
		// Resolving it in favour of either source would fabricate certainty,
		// and resolving it toward `false` would raise a false alarm.
		const r = policerAttachment(snapshotOf(gauge([{ident: 'p1', value: 0}])), [policy('p1', true)]);
		const row = rowFor(r, 'p1');
		expect(row.corroboration).toBe('conflict');
		expect(row.attached).toBeUndefined();
		expect(ok(r).conflicts).toBe(1);
		// A conflict must NOT read as the actionable state.
		expect(ok(r).verdict).toBe('incomplete');
	});

	it('falls back to the single source that answered', () => {
		// A build that omits the read-only REST field: the gauge alone decides.
		const metricOnly = policerAttachment(snapshotOf(gauge([{ident: 'p1', value: 0}])), [policy('p1')]);
		expect(rowFor(metricOnly, 'p1').corroboration).toBe('metric-only');
		expect(rowFor(metricOnly, 'p1').attached).toBe(false);
		expect(ok(metricOnly).verdict).toBe('pending-attachment');

		// A policer created within the tick: REST alone decides, and it is
		// still enough to raise the finding.
		const restOnly = policerAttachment(snapshotOf(''), [policy('p1', false)]);
		expect(rowFor(restOnly, 'p1').corroboration).toBe('rest-only');
		expect(ok(restOnly).verdict).toBe('pending-attachment');
	});

	it('reports a policer neither source describes as unreported, not as healthy', () => {
		const r = policerAttachment(snapshotOf(''), [policy('p1')]);
		expect(rowFor(r, 'p1').corroboration).toBe('unreported');
		expect(rowFor(r, 'p1').attached).toBeUndefined();
		expect(ok(r).verdict).toBe('incomplete');
	});
});

describe('policerAttachment — what a zero is supposed to look like', () => {
	it('calls an empty gauge correct when REST lists no policer', () => {
		// ⭐ Pattern 5. The collector emits NOTHING with no policer
		// configured, so family-absent is the correct reading of an unused
		// feature — not a data failure and not a fault.
		const r = policerAttachment(snapshotOf(''), []);
		expect(ok(r).verdict).toBe('none-configured');
		expect(ok(r).familyExported).toBe(false);
		expect(ok(r).rows).toHaveLength(0);
	});

	it('separates a monitoring gap from an unused feature on the same empty gauge', () => {
		// The SAME absent family, and the opposite meaning, decided entirely
		// by REST. This is the pair the panel exists to tell apart.
		const r = policerAttachment(snapshotOf(''), [policy('p1'), policy('p2')]);
		expect(ok(r).familyExported).toBe(false);
		expect(ok(r).verdict).toBe('incomplete');
		expect(ok(r).configured).toBe(2);
	});

	it('withholds judgement when the policy list is unavailable', () => {
		// ⚠️ `undefined` must not collapse to "none configured": that would
		// declare an unused feature on a gateway whose REST call merely
		// failed, hiding real pending policers.
		const r = policerAttachment(snapshotOf(gauge([{ident: 'p1', value: 0}])), undefined);
		expect(ok(r).verdict).toBe('unknown-configuration');
		expect(ok(r).configured).toBeUndefined();
		// The gauge's rows are still reported — the data is shown, only the
		// verdict is withheld.
		expect(rowFor(r, 'p1').attached).toBe(false);
		expect(rowFor(r, 'p1').listedInRest).toBe(false);
	});

	it('does not claim all-attached while any state is unknown', () => {
		const r = policerAttachment(snapshotOf(gauge([{ident: 'p1', value: 1}])), [policy('p1', true), policy('p2')]);
		expect(ok(r).attached).toBe(1);
		expect(ok(r).unknown).toBe(1);
		expect(ok(r).verdict).toBe('incomplete');
	});

	it('reports all-attached only when every configured policer is known good', () => {
		const r = policerAttachment(snapshotOf(gauge([{ident: 'p1', value: 1}, {ident: 'p2', value: 1}])), [
			policy('p1', true),
			policy('p2', true),
		]);
		expect(ok(r).verdict).toBe('all-attached');
		expect(ok(r).attached).toBe(2);
	});
});

describe('policerAttachment — the row set', () => {
	it('joins on the ident byte-wise and keeps a series REST no longer lists', () => {
		// The collector passes PolEntry.Key.PolName to the label verbatim and
		// REST reads the same field, so the join is exact. A near-miss is a
		// DIFFERENT policer, never the same one to be folded together.
		const r = policerAttachment(snapshotOf(gauge([{ident: 'P1', value: 1}, {ident: 'p1 ', value: 1}])), [policy('p1', true)]);
		expect(ok(r).rows.map(x => x.ident).sort()).toEqual(['P1', 'p1', 'p1 ']);
		expect(rowFor(r, 'p1').listedInRest).toBe(true);
		expect(rowFor(r, 'P1').listedInRest).toBe(false);
		expect(rowFor(r, 'p1 ').listedInRest).toBe(false);
	});

	it('orders pending first, then unknown, then healthy, then by name', () => {
		// A gateway with many healthy policers must not push the one finding
		// below the fold, and the order must be stable between polls so the
		// table does not reshuffle under the operator's cursor.
		const r = policerAttachment(
			snapshotOf(gauge([{ident: 'a-ok', value: 1}, {ident: 'b-bad', value: 0}, {ident: 'c-ok', value: 1}])),
			[policy('a-ok', true), policy('b-bad', false), policy('c-ok', true), policy('d-unknown')],
		);
		expect(ok(r).rows.map(x => x.ident)).toEqual(['b-bad', 'd-unknown', 'a-ok', 'c-ok']);
	});

	it('drops a series with no ident label instead of creating an empty row', () => {
		const r = policerAttachment(snapshotOf(`${POLICER_ATTACHED} 1`), []);
		expect(ok(r).rows).toHaveLength(0);
		expect(ok(r).verdict).toBe('none-configured');
	});
});

describe('policerAttachment — no snapshot', () => {
	it('is unavailable without a snapshot, and on a failed scrape', () => {
		expect(policerAttachment(undefined, []).kind).toBe('unavailable');
		// A real OpResult: a scrape that failed must not be read as a gauge
		// reporting zeros, which would invent the pending finding wholesale.
		const failed = snapshotOf(gauge([{ident: 'p1', value: 0}]), {
			status: 'unavailable',
			code: 'metrics.scrape',
			localeKey: 'status.unavailable',
			retryable: true,
		});
		expect(policerAttachment(failed, [policy('p1', false)]).kind).toBe('unavailable');
	});
});

describe('the live wire, captured from the testbed gateway 2026-09-18', () => {
	// ⭐ Verbatim bytes from the gateway at 61.107.199.65, produced by creating
	// one policer whose target VIP deliberately does not exist (so it can
	// never attach) and reading both surfaces before deleting it again. This
	// is the POSITIVE path — the finding state itself — which no synthetic
	// fixture can prove is shaped the way the gateway actually shapes it.
	const LIVE_METRIC = 'loxilb_policer_attached{ident="p-probe"} 0';
	const LIVE_REST = JSON.parse(
		'{"polAttr":[{"attached":false,"policyIdent":"p-probe","policyInfo":{"committedBlkSize":30000000,"committedInfoRate":100,"excessBlkSize":60000000},"targetObject":{"attachment":0,"polObjName":"10.0.0.99:18080:tcp"}}]}',
	).polAttr as IPolicyAttribute[];

	it('reports the finding, corroborated, from the real bytes', () => {
		const r = policerAttachment(snapshotOf(LIVE_METRIC), LIVE_REST);
		expect(ok(r).verdict).toBe('pending-attachment');
		expect(ok(r).familyExported).toBe(true);
		expect(ok(r).pending).toBe(1);
		const row = rowFor(r, 'p-probe');
		// Both surfaces answered `false` and the join held byte-wise on the
		// ident — the two sources agreeing is the ordinary case, exactly as
		// predicted by their sharing one predicate.
		expect(row.attached).toBe(false);
		expect(row.corroboration).toBe('agreed');
		expect(row.metricAttached).toBe(false);
		expect(row.restAttached).toBe(false);
		expect(row.listedInRest).toBe(true);
	});

	it('⚠️ pins that the live body OMITS falsy policyInfo fields IPolicyInfo declares required', () => {
		// The POST sent type: 0, colorAware: false and peakInfoRate: 0; the
		// GET body carries NONE of them. So `IPolicyInfo` promises six numbers
		// and the wire delivers three — the same defect class as J1's
		// `"algs": null`. This module never reads policyInfo, so Stage 3.3 is
		// unaffected, but anything that renders a policer's rates from this
		// type will read `undefined` where TypeScript guarantees a number.
		const info = LIVE_REST[0].policyInfo as unknown as Record<string, unknown>;
		expect(info.committedInfoRate).toBe(100);
		expect(info.type).toBeUndefined();
		expect(info.colorAware).toBeUndefined();
		expect(info.peakInfoRate).toBeUndefined();
	});

	it('⭐ confirms the delete contract the presence design depends on', () => {
		// After DELETE the family vanished from the exposition ENTIRELY — not
		// even HELP/TYPE remained, and REST returned {"polAttr":[]}. That is
		// the wholesale-republish contract, and it is why 3.1's
		// stale-children lesson genuinely does not apply to this family: a
		// deleted policer leaves no ghost series to be mistaken for a live
		// one. The post-delete state is therefore `none-configured`.
		const r = policerAttachment(snapshotOf(''), []);
		expect(ok(r).verdict).toBe('none-configured');
		expect(ok(r).familyExported).toBe(false);
		expect(ok(r).rows).toHaveLength(0);
	});
});

describe('attachmentVerdict — precedence', () => {
	const row = (ident: string, attached: boolean | undefined) => ({
		ident,
		attached,
		corroboration: 'agreed' as const,
		listedInRest: true,
		metricAttached: attached,
		restAttached: attached,
	});

	it('puts the unanswered question ahead of any measurement', () => {
		expect(attachmentVerdict(undefined, [row('p1', false)])).toBe('unknown-configuration');
		expect(attachmentVerdict([], [row('p1', false)])).toBe('none-configured');
	});

	it('puts a known-pending policer ahead of an observability gap', () => {
		// The finding is true whichever source established it, so it must not
		// be demoted to "incomplete" just because another row is unknown.
		expect(attachmentVerdict([policy('p1', false), policy('p2')], [row('p1', false), row('p2', undefined)])).toBe('pending-attachment');
	});
});
