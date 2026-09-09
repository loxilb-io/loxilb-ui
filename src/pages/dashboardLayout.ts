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

// The base layout ends at y 6.3 (system-log: y 4.3 + h 2); the gateway rows
// continue exactly there so the default stays gap-free by construction.
const GW_SUMMARY_LAYOUT: readonly Layout[] = [
	{i: 'gw-ai-events', x: 0, y: 6.3, w: 4, h: 1.3},
	{i: 'gw-active-streams', x: 4, y: 6.3, w: 4, h: 1.3},
	{i: 'gw-worker-freshness', x: 8, y: 6.3, w: 4, h: 1.3},
	{i: 'gw-kv-exact', x: 0, y: 7.6, w: 6, h: 1.3},
	{i: 'gw-persistence', x: 6, y: 7.6, w: 6, h: 1.3},
];

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
