//---------------------------------------------------------
// Objective form projection: a signed whole number for priority (a half-typed
// sign never becomes 0), services as a list left out when empty.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {objectiveApplied, objectiveGone} from 'hooks/query/confirmPredicates';
import {objectiveFormErrors, objectiveFormToEntry, objectiveToForm, parsePriority} from './ObjectiveInputForm';

describe('objective form', () => {
	it('parses a signed whole number and nothing else', () => {
		expect(parsePriority('-5')).toBe(-5);
		expect(parsePriority(' 12 ')).toBe(12);
		expect(parsePriority('-')).toBeUndefined();
		expect(parsePriority('1.5')).toBeUndefined();
		expect(parsePriority('')).toBeUndefined();
	});

	it('round-trips an objective and leaves empty services out', () => {
		expect(objectiveFormToEntry(objectiveToForm({name: 'gold', priority: 3}))).toEqual({name: 'gold', priority: 3});
		expect(objectiveFormToEntry({name: ' gold ', priority: '-1', services: '10.0.0.1:443, 10.0.0.2:443'})).toEqual({name: 'gold', priority: -1, services: ['10.0.0.1:443', '10.0.0.2:443']});
	});

	it('refuses a half-typed priority instead of sending 0', () => {
		expect(objectiveFormErrors({name: 'gold', priority: '-', services: ''})).toHaveLength(1);
		expect(objectiveFormErrors({name: 'gold', priority: '0', services: ''})).toEqual([]);
	});
});

describe('objective confirmation', () => {
	it('confirms by name, priority and service set, empty services equal to null', () => {
		expect(objectiveApplied({name: 'gold', priority: 3})([{name: 'gold', priority: 3, services: null}])).toBe(true);
		expect(objectiveApplied({name: 'gold', priority: 3})([{name: 'gold', priority: 2}])).toBe(false);
		expect(objectiveApplied({name: 'gold', priority: 0, services: ['b', 'a']})([{name: 'gold', services: ['a', 'b']}])).toBe(true);
		expect(objectiveApplied({name: 'gold', priority: 0, services: ['a']})([{name: 'gold'}])).toBe(false);
		expect(objectiveGone('gold')([{name: 'silver'}])).toBe(true);
		expect(objectiveGone('gold')([{name: 'gold'}])).toBe(false);
	});
});
