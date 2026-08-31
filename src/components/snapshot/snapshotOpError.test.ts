//---------------------------------------------------------
// UI-P6-1 follow-up — snapshot inline-error convention regression
// (npm test src/components/snapshot/snapshotOpError.test.ts)
//
// The snapshot family's design (§5.3 / do-not-regress list) surfaces the
// server's verbatim detail INLINE under the localized headline — proven by the
// pre-existing E2E spec snapshots.spec.ts "9. stale row … surfaces the
// verbatim 404 inline". The OpResult migration kept the convention in
// RestoreWizard (dry-run/commit panels) but SnapshotPage.reportResult dropped
// it: a Pin on a stale row rendered only the generic "The operation could not
// be completed." — the E2E spec failed on two independent AFTER-runs.
// This pins the shared text rule the page and the wizard must both use.
//---------------------------------------------------------
import {snapshotOpErrorText} from 'components/snapshot/snapshotOpError';
import {describe, expect, it} from 'vitest';
import 'locales/i18n';

describe('snapshotOpErrorText', () => {
	it('appends the verbatim server detail after the localized headline', () => {
		const text = snapshotOpErrorText({
			localeKey: 'The operation could not be completed.',
			rawDetail: 'snapshot not found',
		});
		expect(text).toBe('The operation could not be completed. snapshot not found');
	});

	it('matches the stale-row E2E contract: a 404 body detail stays greppable', () => {
		const text = snapshotOpErrorText({
			localeKey: 'The operation could not be completed.',
			rawDetail: 'snapshot e2e-spec-stale not found',
		});
		expect(text).toMatch(/not found/i);
	});

	it('falls back to the localized headline alone when the server sent no detail', () => {
		const text = snapshotOpErrorText({localeKey: 'The operation could not be completed.'});
		expect(text).toBe('The operation could not be completed.');
	});

	it('ignores a blank-string detail', () => {
		const text = snapshotOpErrorText({localeKey: 'The operation could not be completed.', rawDetail: '   '});
		expect(text).toBe('The operation could not be completed.');
	});
});
