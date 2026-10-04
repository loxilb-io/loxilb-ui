import {describe, expect, it} from 'vitest';
import {Layout} from 'react-grid-layout';
import {applicableGwSummaryCards, BASE_DASHBOARD_LAYOUT, defaultLayoutFor, GW_SUMMARY_CARDS, reconcileDashboardLayout} from './dashboardLayout';

// The current gap-free default shape in miniature: two rows, then a
// full-width row — same construction rules as DashboardPage.
const DEFAULTS: Layout[] = [
	{i: 'a', x: 0, y: 0, w: 6, h: 2},
	{i: 'b', x: 6, y: 0, w: 6, h: 2},
	{i: 'c', x: 0, y: 2, w: 12, h: 1},
];

function overlaps(l1: Layout, l2: Layout): boolean {
	return l1.x < l2.x + l2.w && l2.x < l1.x + l1.w && l1.y < l2.y + l2.h && l2.y < l1.y + l1.h;
}

describe('reconcileDashboardLayout', () => {
	it('a saved layout matching the key set survives untouched', () => {
		const saved = [
			{i: 'c', x: 0, y: 0, w: 12, h: 1},
			{i: 'a', x: 0, y: 1, w: 6, h: 2},
			{i: 'b', x: 6, y: 1, w: 6, h: 2},
		];
		const r = reconcileDashboardLayout(saved, DEFAULTS);
		expect(r.changed).toBe(false);
		expect(r.layout).toEqual(saved);
	});

	it('adding a card AMENDS the saved layout instead of resetting it', () => {
		// The v2 defect this module replaces: `saved.length !==
		// DEFAULT_LAYOUT.length` threw the whole saved layout away the moment
		// a card shipped. Saved positions must survive; only the new card is
		// appended.
		const saved = [
			{i: 'a', x: 6, y: 0, w: 6, h: 2}, // operator swapped a and b
			{i: 'b', x: 0, y: 0, w: 6, h: 2},
		];
		const r = reconcileDashboardLayout(saved, DEFAULTS);
		expect(r.changed).toBe(true);
		expect(r.layout.find(l => l.i === 'a')).toEqual(saved[0]);
		expect(r.layout.find(l => l.i === 'b')).toEqual(saved[1]);
		// The new card lands below the kept content...
		const added = r.layout.find(l => l.i === 'c')!;
		expect(added.y).toBe(2);
		// ...and collides with nothing (the grid runs preventCollision).
		for (const other of r.layout) {
			if (other.i !== 'c') expect(overlaps(added, other), `c overlaps ${other.i}`).toBe(false);
		}
	});

	it('drops cards that no longer exist in the applicable set', () => {
		const saved = [
			{i: 'a', x: 0, y: 0, w: 6, h: 2},
			{i: 'b', x: 6, y: 0, w: 6, h: 2},
			{i: 'c', x: 0, y: 2, w: 12, h: 1},
			{i: 'removed-card', x: 0, y: 3, w: 4, h: 1},
		];
		const r = reconcileDashboardLayout(saved, DEFAULTS);
		expect(r.changed).toBe(true);
		expect(r.layout.map(l => l.i).sort()).toEqual(['a', 'b', 'c']);
	});

	it('rejects malformed and duplicate entries without losing the healthy ones', () => {
		const saved = [
			{i: 'a', x: 0, y: 0, w: 6, h: 2},
			{i: 'a', x: 6, y: 0, w: 6, h: 2}, // duplicate key
			{i: 'b', x: 'NaN'}, // malformed — operator-editable storage
			null,
		];
		const r = reconcileDashboardLayout(saved, DEFAULTS);
		expect(r.changed).toBe(true);
		expect(r.layout.filter(l => l.i === 'a')).toHaveLength(1);
		// b and c re-enter through the missing-card path.
		expect(r.layout.map(l => l.i).sort()).toEqual(['a', 'b', 'c']);
	});

	it('non-array input falls back to the true defaults', () => {
		for (const bad of [undefined, null, 'garbage', {i: 'a'}, 42]) {
			const r = reconcileDashboardLayout(bad, DEFAULTS);
			expect(r.changed).toBe(true);
			expect(r.layout).toEqual(DEFAULTS);
		}
	});

	it('an empty or fully-invalid save gets the true defaults, not a stacked column', () => {
		expect(reconcileDashboardLayout([], DEFAULTS).layout).toEqual(DEFAULTS);
		expect(reconcileDashboardLayout([{i: 'ghost', x: 0, y: 0, w: 1, h: 1}], DEFAULTS).layout).toEqual(DEFAULTS);
	});

	it('round-trips: reconciling its own output is a no-op', () => {
		const first = reconcileDashboardLayout([{i: 'a', x: 3, y: 0, w: 6, h: 2}, {i: 'b', x: 0, y: 5, w: 3, h: 2}], DEFAULTS);
		const second = reconcileDashboardLayout(first.layout, DEFAULTS);
		expect(second.changed).toBe(false);
		expect(second.layout).toEqual(first.layout);
	});
});

//---------------------------------------------------------
// Registry-driven dashboard composition (UI-MON-007)
//---------------------------------------------------------
// Exercised against the REAL registry/manifest: the gateway summary set is
// applicable exactly on the resolved gateway flavor, and every flavor's
// default layout is gap-free and collision-free by construction.

function overlapsAny(items: readonly Layout[]): string | null {
	for (let i = 0; i < items.length; i++) {
		for (let j = i + 1; j < items.length; j++) {
			if (overlaps(items[i], items[j])) return `${items[i].i} overlaps ${items[j].i}`;
		}
	}
	return null;
}

function gapFree(items: readonly Layout[]): boolean {
	// Contiguous rows: sorted by y, every row's start equals some earlier
	// row's end (or 0). Fractional heights make exact equality the point.
	const starts = [...new Set(items.map(l => l.y))].sort((a, b) => a - b);
	const ends = new Set(items.map(l => l.y + l.h));
	return starts.every(y => y === 0 || ends.has(y));
}

describe('gateway summary composition', () => {
	it('every summary card is registry-applicable on the gateway and absent on loxilb', () => {
		expect(applicableGwSummaryCards('inference-gateway').map(c => c.key)).toEqual(GW_SUMMARY_CARDS.map(c => c.key));
		expect(applicableGwSummaryCards('loxilb')).toEqual([]);
		// Unresolved flavor answers the narrow set — no gateway card may mount
		// before the /version probe proves the flavor.
		expect(applicableGwSummaryCards(undefined)).toEqual([]);
	});

	it('the gateway default layout appends the summary rows gap-free and collision-free', () => {
		const gw = defaultLayoutFor(DEFAULTS, 'inference-gateway');
		expect(gw.map(l => l.i)).toEqual([...DEFAULTS.map(l => l.i), ...GW_SUMMARY_CARDS.map(c => c.key)]);
		expect(overlapsAny(gw)).toBeNull();
	});

	it('the real base + gateway geometry is gap-free (compaction-off contract)', () => {
		// The SHIPPED base, not a copy of it. This test previously mirrored the
		// production rows by hand and therefore only checked that the copy was
		// self-consistent — it stayed green through a base-geometry change that
		// left a gap in the real dashboard.
		const gw = defaultLayoutFor(BASE_DASHBOARD_LAYOUT, 'inference-gateway');
		expect(overlapsAny(gw)).toBeNull();
		expect(gapFree(gw)).toBe(true);
	});

	it('the shipped base is itself gap-free on every flavor', () => {
		for (const flavor of ['loxilb', 'inference-gateway', undefined] as const) {
			const layout = defaultLayoutFor(BASE_DASHBOARD_LAYOUT, flavor);
			expect(overlapsAny(layout), `${flavor} overlap`).toBeNull();
			expect(gapFree(layout), `${flavor} gap`).toBe(true);
		}
	});

	it('the loxilb and unresolved defaults are exactly the base', () => {
		expect(defaultLayoutFor(DEFAULTS, 'loxilb')).toEqual(DEFAULTS);
		expect(defaultLayoutFor(DEFAULTS, undefined)).toEqual(DEFAULTS);
	});

	it('a gateway layout saved before the summary cards existed is amended, not reset', () => {
		// The composed default is what reconciliation runs against, so an old
		// base-only save gains the summary cards below its content. The saved
		// positions differ from the defaults (a and b swapped) to prove they
		// survive verbatim.
		const savedNineCards = defaultLayoutFor(DEFAULTS, 'loxilb').map(l =>
			l.i === 'a' ? {...l, x: 6} : l.i === 'b' ? {...l, x: 0} : l,
		);
		const r = reconcileDashboardLayout(savedNineCards, defaultLayoutFor(DEFAULTS, 'inference-gateway'));
		expect(r.changed).toBe(true);
		for (const saved of savedNineCards) {
			expect(r.layout.find(l => l.i === saved.i)).toEqual(saved);
		}
		for (const c of GW_SUMMARY_CARDS) {
			expect(r.layout.some(l => l.i === c.key), c.key).toBe(true);
		}
		expect(overlapsAny(r.layout)).toBeNull();
	});
});
