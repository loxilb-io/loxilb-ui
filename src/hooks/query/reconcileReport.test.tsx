//---------------------------------------------------------
// What the operator is told after an accepted write.
// (npx vitest run src/hooks/query/reconcileReport.test.tsx)
//
// An accepted write has three honest endings, and each has its own sentence:
// the change was read back, the change was not there when read, or the read
// itself failed. The last two must not be merged: "has not appeared" is a
// statement about state that a failed read never saw.
//---------------------------------------------------------
import {act, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useEffect} from 'react';
import {fromQueryRefetch} from 'hooks/query/reconcile';
import {useReconcileReporter} from 'hooks/query/reconcileReport';

const openPopUp = vi.fn();
// The reporter's sentences are source strings; an identity `t` keeps them readable here.
vi.mock('i18next', () => ({t: (key: string) => key}));
vi.mock('hooks/popupHook', () => ({usePopUp: () => ({openPopUp})}));

type Report = ReturnType<typeof useReconcileReporter>['report'];

function Harness(props: {onReady: (report: Report) => void}) {
	const {report} = useReconcileReporter();
	useEffect(() => props.onReady(report), [props, report]);
	return null;
}

async function runReport<T>(refetch: () => Promise<T | undefined>, confirm: (latest: T) => boolean) {
	let report!: Report;
	render(<Harness onReady={r => (report = r)} />);
	let done = false;
	const outcome = report({refetch, confirm}, 'Saved successfully.').then(v => {
		done = true;
		return v;
	});
	for (let i = 0; i < 200 && !done; i++) {
		await act(async () => {
			await vi.advanceTimersByTimeAsync(250);
		});
	}
	return outcome;
}

const NOT_APPEARED = 'The gateway accepted the change, but it has not appeared yet. Refresh to check again.';
const NOT_READ = 'The gateway accepted the change, but it could not be read back to confirm it. Refresh to check again.';

beforeEach(() => {
	vi.useFakeTimers();
	openPopUp.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('reporting an accepted write', () => {
	it('says success only when the change was read back', async () => {
		expect(await runReport(async () => ['row'], rows => rows.includes('row'))).toBe('confirmed');
		expect(openPopUp).toHaveBeenCalledTimes(1);
		expect(openPopUp.mock.calls[0].slice(0, 2)).toEqual(['Success', 'Saved successfully.']);
	});

	it('says the change has not appeared when every read answered without it', async () => {
		expect(await runReport(async () => ['other'], rows => rows.includes('row'))).toBe('pending');
		expect(openPopUp.mock.calls[0].slice(0, 2)).toEqual(['Submitted', NOT_APPEARED]);
	});

	it('says the change could not be read back when the last read threw', async () => {
		const refetch = vi.fn(async (): Promise<string[] | undefined> => {
			throw new Error('502');
		});
		expect(await runReport(refetch, rows => rows.includes('row'))).toBe('pending');
		expect(openPopUp).toHaveBeenCalledTimes(1);
		expect(openPopUp.mock.calls[0].slice(0, 2)).toEqual(['Submitted', NOT_READ]);
	});

	it('goes by the LAST read: an early failure followed by an answer is "not appeared"', async () => {
		let call = 0;
		const refetch = async (): Promise<string[] | undefined> => {
			if (call++ === 0) throw new Error('503');
			return ['other'];
		};
		await runReport(refetch, rows => rows.includes('row'));
		expect(openPopUp.mock.calls[0][1]).toBe(NOT_APPEARED);
	});

	it('never repeats the write: the mutation is not part of what it is given', async () => {
		const refetch = vi.fn(async () => ['other']);
		await runReport(refetch, rows => rows.includes('row'));
		// One acceptance read plus one per backoff step, and nothing else.
		expect(refetch).toHaveBeenCalledTimes(5);
	});
});

describe('a failed list refetch is not evidence', () => {
	it('hands a predicate nothing when the refetch failed, even though react-query keeps the old rows', async () => {
		// The rows from BEFORE a delete still contain the deleted row. Had they
		// reached an "appeared" predicate for a row that was already there,
		// a write that was never read back would have been confirmed.
		const refetch = async () => ({data: ['row'], isError: true});
		expect(await fromQueryRefetch(refetch)()).toBeUndefined();
	});

	it('hands over the rows of a refetch that worked', async () => {
		expect(await fromQueryRefetch(async () => ({data: ['row'], isError: false}))()).toEqual(['row']);
		expect(await fromQueryRefetch(async () => ({data: ['row']}))()).toEqual(['row']);
	});

	it('a failed list refetch is reported as "could not be read back"', async () => {
		const refetch = fromQueryRefetch(async () => ({data: ['row'], isError: true}));
		expect(await runReport(refetch, (rows: string[]) => rows.includes('row'))).toBe('pending');
		expect(openPopUp.mock.calls[0][1]).toBe(NOT_READ);
	});
});
