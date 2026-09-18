//---------------------------------------------------------
// The no-data caption — what an operator is TOLD (Stage 3.5)
//---------------------------------------------------------
// The absence readings are pinned in observability/familyActivation.test.ts.
// This file pins the half that cannot be: that the caption changes the WORDS
// and never the STATE, and that only one of the six readings reads as a
// problem.
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IAbsenceExplanation} from 'observability/familyActivation';
import ObservabilityStateFrame from './ObservabilityStateFrame';

const explanation = (reading: IAbsenceExplanation['reading']): IAbsenceExplanation => ({
	reading,
	absentFamilies: ['loxilb_x'],
	presentCount: 0,
});

// Vocabulary that tells an operator something is WRONG with their gateway.
// Only the `unexpected` reading may use it: every other reading describes a
// feature that is simply not in use yet.
const FAULT_WORDS = /should always be exported|worth reporting/i;

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('the caption explains no-data without becoming a fault', () => {
	it('falls back to a bare "No data" when the manifest says nothing', () => {
		// Pages that do not pass an explanation (WorkersPage has no metrics
		// snapshot at all) must keep the old behaviour exactly.
		render(<ObservabilityStateFrame state={{kind: 'no-data'}} name="X" />);
		expect(screen.getByText('No data')).toBeTruthy();
	});

	it('⭐ quotes the manifest precondition verbatim so it says what to configure', () => {
		render(
			<ObservabilityStateFrame
				state={{kind: 'no-data'}}
				name="X"
				absence={explanation({kind: 'conditional', precondition: 'at least one JWT auth profile configured.'})}
			/>,
		);
		expect(screen.getByText(/at least one JWT auth profile configured/i)).toBeTruthy();
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
	});

	it('⭐ reads a lazy family as not-yet-used, not as broken', () => {
		render(<ObservabilityStateFrame state={{kind: 'no-data'}} name="X" absence={explanation({kind: 'until-used'})} />);
		expect(screen.getByText(/first time the feature is used/i)).toBeTruthy();
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
	});

	it('⭐⭐ reads an eager unconditional absence as worth reporting', () => {
		// The one reading that indicates something is wrong: the gateway
		// always registers these.
		render(<ObservabilityStateFrame state={{kind: 'no-data'}} name="X" absence={explanation({kind: 'unexpected'})} />);
		expect(screen.getByText(FAULT_WORDS)).toBeTruthy();
	});

	it('says the reason is unknown rather than guessing a benign one', () => {
		for (const kind of ['indeterminate', 'not-in-manifest'] as const) {
			cleanup();
			render(<ObservabilityStateFrame state={{kind: 'no-data'}} name="X" absence={explanation({kind})} />);
			expect(screen.getByText(/cannot tell whether that is expected/i), kind).toBeTruthy();
			expect(screen.queryByText(FAULT_WORDS), kind).toBeNull();
		}
	});

	it('names a gate rather than implying a fault', () => {
		render(<ObservabilityStateFrame state={{kind: 'no-data'}} name="X" absence={explanation({kind: 'gated'})} />);
		expect(screen.getByText(/datapath or hardware gate/i)).toBeTruthy();
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
	});

	it('keeps the status role so the caption is announced like the old text', () => {
		render(<ObservabilityStateFrame state={{kind: 'no-data'}} name="X" absence={explanation({kind: 'until-used'})} />);
		expect(screen.getByRole('status')).toBeTruthy();
	});
});

describe('⚠️ the caption never leaks into another state', () => {
	it('is ignored for a failed scrape, which has its own explanation', () => {
		// A transport failure already says what happened. A configuration
		// precondition here would send an operator after the wrong thing —
		// and `explainAbsence` returns undefined on a failed scrape anyway, so
		// this pins the frame's half of that contract.
		render(
			<ObservabilityStateFrame
				state={{kind: 'unavailable', failure: {status: 'unavailable', code: 'x', localeKey: 'status.unavailable', retryable: true}}}
				name="X"
				absence={explanation({kind: 'conditional', precondition: 'something configured'})}
			/>,
		);
		expect(screen.queryByText(/something configured/i)).toBeNull();
	});

	it('is ignored for not-applicable', () => {
		render(<ObservabilityStateFrame state={{kind: 'not-applicable'}} name="X" absence={explanation({kind: 'unexpected'})} />);
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
		expect(screen.getByText(/Not applicable/i)).toBeTruthy();
	});

	it('is ignored when data IS present', () => {
		render(
			<ObservabilityStateFrame state={{kind: 'ready'}} name="X" absence={explanation({kind: 'unexpected'})}>
				<div>rows</div>
			</ObservabilityStateFrame>,
		);
		expect(screen.getByText('rows')).toBeTruthy();
		expect(screen.queryByText(FAULT_WORDS)).toBeNull();
	});
});
