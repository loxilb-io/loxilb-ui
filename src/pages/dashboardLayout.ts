//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Layout} from 'react-grid-layout';

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
