//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {InstanceFlavor} from 'api/capabilities';
import {Layout} from 'react-grid-layout';
import {isEntryApplicable, ObservabilityEntryId} from 'observability/capabilityRegistry';

//---------------------------------------------------------
// Registry-driven dashboard composition (UI-MON-007)
//---------------------------------------------------------
// The gateway summary panels exist on the dashboard only when their registry
// entries are applicable — never because data happened to arrive. Card keys
// are the layout identity, so they are pinned literals here; the geometry
// keeps every flavor's default GAP-FREE (the grid runs compaction-off, see
// DashboardPage).

export interface IGwSummaryCard {
	key: string;
	entry: ObservabilityEntryId;
}

export const GW_SUMMARY_CARDS: readonly IGwSummaryCard[] = [
	{key: 'gw-ai-events', entry: 'dashboard.gwAiEvents'},
	{key: 'gw-active-streams', entry: 'dashboard.gwActiveStreams'},
	{key: 'gw-worker-freshness', entry: 'dashboard.gwWorkerFreshness'},
	{key: 'gw-kv-exact', entry: 'dashboard.gwKvExactNonReady'},
	{key: 'gw-persistence', entry: 'dashboard.gwPersistenceFailures'},
];

// The flavor-independent base rows, in grid units (rowHeight 300). Lives here
// rather than in DashboardPage so the gap-free contract below is checked
// against the geometry that actually ships — the test used to keep its own
// copy of these rows, which silently stopped matching production the first
// time a row height changed.
// Rows, not coordinates. The grid runs compaction-off, so a vertical gap is
// permanent and a fractional height used to have to be balanced by hand in a
// `y` literal further down — which is not just tedious but unsound: heights
// like 1.3 and 1.15 are inexact in binary, so `3.3 + 1.15` is NOT `4.45` and a
// hand-written chain develops sub-ULP seams. Stacking the rows here makes each
// row's `y` the previous row's exact computed end, so the layout is gap-free
// by construction at any height.
interface IRowCard {
	i: string;
	x: number;
	w: number;
}
interface IRowSpec {
	h: number;
	cards: readonly IRowCard[];
}

function stackRows(rows: readonly IRowSpec[], startY: number): {layout: Layout[]; endY: number} {
	const layout: Layout[] = [];
	let y = startY;
	for (const row of rows) {
		for (const c of row.cards) layout.push({i: c.i, x: c.x, y, w: c.w, h: row.h});
		y += row.h;
	}
	return {layout, endY: y};
}

const BASE_ROWS: readonly IRowSpec[] = [
	// === ROW 1: SYSTEM OVERVIEW ===
	{h: 2, cards: [{i: 'system-usage', x: 0, w: 8}, {i: 'ha', x: 8, w: 4}]},

	// === ROW 2: CRITICAL METRICS ===
	{
		h: 1.3,
		cards: [{i: 'connection-flows', x: 0, w: 4}, {i: 'health-status', x: 4, w: 4}, {i: 'lb-rules', x: 8, w: 4}],
	},

	// === ROW 3: REAL-TIME TRAFFIC MONITORING ===
	// h 1.15 (345px), not 1: the rate cards render 329px of content once their
	// series arrives, so at h 1 the Paper's overflow:hidden clipped the graph's
	// time axis. The row is sized to the card, not the card to a round row.
	{
		h: 1.15,
		cards: [{i: 'total-traffic-rate', x: 0, w: 4}, {i: 'total-packet-rate', x: 4, w: 4}, {i: 'total-error-rate', x: 8, w: 4}],
	},

	// === ROW 4: SYSTEM LOGS AND DIAGNOSTICS ===
	{h: 2, cards: [{i: 'system-log', x: 0, w: 12}]},
];

const {layout: BASE_LAYOUT, endY: BASE_END_Y} = stackRows(BASE_ROWS, 0);

/** The flavor-independent base rows, in grid units (rowHeight 300). */
export const BASE_DASHBOARD_LAYOUT: readonly Layout[] = BASE_LAYOUT;

// The gateway rows continue from the base's exact end.
const GW_SUMMARY_ROWS: readonly IRowSpec[] = [
	{
		h: 1.3,
		cards: [{i: 'gw-ai-events', x: 0, w: 4}, {i: 'gw-active-streams', x: 4, w: 4}, {i: 'gw-worker-freshness', x: 8, w: 4}],
	},
	{h: 1.3, cards: [{i: 'gw-kv-exact', x: 0, w: 6}, {i: 'gw-persistence', x: 6, w: 6}]},
];

const GW_SUMMARY_LAYOUT: readonly Layout[] = stackRows(GW_SUMMARY_ROWS, BASE_END_Y).layout;

export function applicableGwSummaryCards(flavor: InstanceFlavor | undefined): readonly IGwSummaryCard[] {
	return GW_SUMMARY_CARDS.filter(c => flavor !== undefined && isEntryApplicable(c.entry, flavor));
}

/**
 * The flavor's gap-free default layout: the shared base plus one layout item
 * per applicable gateway summary card. An unresolved flavor gets the base
 * only — the narrow set, consistent with the fail-narrow capability surface.
 */
export function defaultLayoutFor(base: readonly Layout[], flavor: InstanceFlavor | undefined): Layout[] {
	const applicable = new Set(applicableGwSummaryCards(flavor).map(c => c.key));
	return [...base, ...GW_SUMMARY_LAYOUT.filter(l => applicable.has(l.i))];
}

//---------------------------------------------------------
// Dashboard layout reconciliation (UI-MON-006, layout v2→v3)
//---------------------------------------------------------
// Replaces the v2 length-equality validity check (`saved.length !==
// DEFAULT_LAYOUT.length` → discard) that silently reset every operator's
// saved layout the moment a card was added or removed. Validity is now the
// KEY SET: a saved layout is reconciled against the current applicable card
// set — saved positions survive, cards that no longer exist are dropped, and
// new cards are appended below the existing content so they can never
// collide with a saved position (the grid runs compaction-off +
// preventCollision, so overlap would make a card undraggable, and the
// defaults must stay gap-free by construction).

export interface IReconcileResult {
	layout: Layout[];
	// True when the persisted value should be (re)written: the saved layout
	// was missing, malformed, or amended by reconciliation.
	changed: boolean;
}

function isLayoutItem(v: unknown): v is Layout {
	const o = v as Layout;
	return (
		!!o &&
		typeof o === 'object' &&
		typeof o.i === 'string' &&
		typeof o.x === 'number' &&
		typeof o.y === 'number' &&
		typeof o.w === 'number' &&
		typeof o.h === 'number' &&
		[o.x, o.y, o.w, o.h].every(Number.isFinite)
	);
}

/**
 * @param saved    the parsed persisted value (unknown: operator-writable input)
 * @param defaults the current applicable card set's default layout, gap-free
 */
export function reconcileDashboardLayout(saved: unknown, defaults: readonly Layout[]): IReconcileResult {
	if (!Array.isArray(saved)) return {layout: [...defaults], changed: true};

	const wanted = new Set(defaults.map(d => d.i));
	const seen = new Set<string>();
	const kept: Layout[] = [];
	let dropped = false;
	for (const item of saved) {
		// A malformed or duplicate entry poisons collision handling — drop it
		// and let its card re-enter through the missing-card path below.
		if (!isLayoutItem(item) || !wanted.has(item.i) || seen.has(item.i)) {
			dropped = true;
			continue;
		}
		seen.add(item.i);
		kept.push({...item});
	}

	// Nothing usable survived — the true defaults beat a single stacked
	// column of appended cards.
	if (kept.length === 0) return {layout: [...defaults], changed: true};

	const missing = defaults.filter(d => !seen.has(d.i));
	// Append each new card on its own full row below everything kept: never a
	// collision with a saved position, contiguous with the content above.
	let nextY = kept.reduce((max, item) => Math.max(max, item.y + item.h), 0);
	for (const d of missing) {
		kept.push({...d, y: nextY});
		nextY += d.h;
	}

	return {layout: kept, changed: dropped || missing.length > 0};
}
