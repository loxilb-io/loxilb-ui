import {describe, expect, it} from 'vitest';
import {Layout} from 'react-grid-layout';
import {reconcileDashboardLayout} from './dashboardLayout';

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
