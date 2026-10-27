//---------------------------------------------------------
// Request priority on keys, tenants and JWT profiles (gateway 9f5017e2).
//
// Pins the omission semantics per owner: a create sends only what is set; an
// edit sends only what changed, with '' / [] to clear; the UI never invents a
// class. Warnings are hints, never refusals.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {
	hasPrioritySettings,
	IAIObjectiveEntry,
	objectiveClass,
	parseObjectiveList,
	priorityChangedFields,
	priorityCreateFields,
	priorityDraftFrom,
	priorityWarnings,
	validatePriorityDraft,
} from './ai_priority';

const draft = (over: Partial<ReturnType<typeof priorityDraftFrom>> = {}) => ({...priorityDraftFrom(null), ...over});

const objectives: IAIObjectiveEntry[] = [
	{name: 'gold', priority: 10},
	{name: 'normal', priority: 0},
	{name: 'batch', priority: -5},
];

describe('objective class from a signed priority', () => {
	it('is critical above zero, standard at zero, sheddable below', () => {
		expect(objectiveClass(10)).toBe('critical');
		expect(objectiveClass(0)).toBe('standard');
		expect(objectiveClass(undefined)).toBe('standard');
		expect(objectiveClass(-1)).toBe('sheddable');
	});
});

describe('a create sends only what is set', () => {
	it('omits every unset field, so a key gets no cap', () => {
		expect(priorityCreateFields(draft(), 'key')).toEqual({});
		expect(priorityCreateFields(draft(), 'tenant')).toEqual({});
	});

	it('sends the set fields, the allowance as a trimmed list', () => {
		expect(priorityCreateFields(draft({priority_class: 'critical', default_objective: ' gold ', allowed_objectives: 'gold, tier:priority ,'}), 'key')).toEqual({
			priority_class: 'critical',
			default_objective: 'gold',
			allowed_objectives: ['gold', 'tier:priority'],
		});
	});

	it('sends only the class for a JWT profile', () => {
		expect(priorityCreateFields(draft({priority_class: 'sheddable', default_objective: 'gold', allowed_objectives: 'gold'}), 'jwt')).toEqual({priority_class: 'sheddable'});
	});
});

describe('an edit sends only what changed', () => {
	const current = {priority_class: 'critical', default_objective: 'gold', allowed_objectives: ['gold', 'normal']};

	it('sends nothing when nothing changed', () => {
		expect(priorityChangedFields(priorityDraftFrom(current), current, 'key')).toEqual({});
		expect(priorityChangedFields(priorityDraftFrom(null), null, 'tenant')).toEqual({});
	});

	it('clears with an empty string or an empty list', () => {
		expect(priorityChangedFields(draft(), current, 'key')).toEqual({priority_class: '', default_objective: '', allowed_objectives: []});
	});

	it('sends a single changed field and leaves the rest out', () => {
		expect(priorityChangedFields({...priorityDraftFrom(current), priority_class: 'standard'}, current, 'tenant')).toEqual({priority_class: 'standard'});
	});

	it('treats a null list as empty, the way a nil slice reads back', () => {
		expect(priorityChangedFields(draft(), {allowed_objectives: null}, 'key')).toEqual({});
	});
});

describe('validation refuses only what the gateway would', () => {
	it('accepts unset and the three classes', () => {
		for (const value of ['', 'critical', 'standard', 'sheddable']) expect(validatePriorityDraft(draft({priority_class: value}), 'key')).toEqual([]);
		expect(validatePriorityDraft(draft({priority_class: 'gold'}), 'key')).toHaveLength(1);
	});

	it('refuses a duplicated or oversized allowance', () => {
		expect(validatePriorityDraft(draft({allowed_objectives: 'gold, gold'}), 'tenant')).toEqual(['Allowed objective gold is duplicated.']);
		const many = Array.from({length: 65}, (_, i) => `o${i}`).join(',');
		expect(validatePriorityDraft(draft({allowed_objectives: many}), 'tenant')).toEqual(['At most 64 allowed objectives.']);
	});
});

describe('warnings are hints, never refusals', () => {
	it('says when a default objective does not exist now', () => {
		expect(priorityWarnings(draft({default_objective: 'missing'}), 'key', objectives).map(w => w.key)).toEqual([
			'The default objective names no objective that exists now. Requests are then treated as asking for an unknown objective.',
		]);
	});

	it('names allowed objectives that do not exist, but not the body tiers', () => {
		const warnings = priorityWarnings(draft({allowed_objectives: 'gold, tier:fast, nope'}), 'tenant', objectives);
		expect(warnings).toEqual([{key: 'Not an objective that exists now: {{names}}.', values: {names: 'nope'}}]);
	});

	it('warns when a default objective sits above the cap', () => {
		expect(priorityWarnings(draft({priority_class: 'standard', default_objective: 'gold'}), 'key', objectives)).toEqual([
			{key: 'The default objective is {{wanted}}, above the {{cap}} cap: its requests are held at {{cap}}.', values: {wanted: 'critical', cap: 'standard'}},
		]);
	});

	it('holds an unset tenant at standard, and an unset key adds no cap', () => {
		expect(priorityWarnings(draft({default_objective: 'gold'}), 'tenant', objectives)).toHaveLength(1);
		expect(priorityWarnings(draft({default_objective: 'gold'}), 'key', objectives)).toEqual([]);
	});

	it('says nothing when the objective list could not be read', () => {
		expect(priorityWarnings(draft({default_objective: 'missing'}), 'key', undefined)).toEqual([]);
	});
});

describe('helpers', () => {
	it('parses a comma-separated list', () => {
		expect(parseObjectiveList(' a, ,b ,')).toEqual(['a', 'b']);
	});

	it('knows when an identity declares something', () => {
		expect(hasPrioritySettings({})).toBe(false);
		expect(hasPrioritySettings({allowed_objectives: []})).toBe(false);
		expect(hasPrioritySettings({priority_class: 'standard'})).toBe(true);
	});
});
