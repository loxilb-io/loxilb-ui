//---------------------------------------------------------
// Row-shaping tests: the chips must carry their meaning in TEXT (a11y — the
// e2e tier asserts them by label), the corrupt flag must only fire on an
// explicit false verdict, and unknown server values must pass through
// verbatim instead of being guessed at.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {getStableHash} from 'common';
import {snapshot_to_row} from './SnapshotTable';

describe('snapshot_to_row', () => {
	it('maps the four trigger types to labelled chips', () => {
		expect(snapshot_to_row({trigger_type: 'manual'}, 0).trigger).toEqual({label: 'Manual'});
		expect(snapshot_to_row({trigger_type: 'scheduled'}, 0).trigger).toEqual({label: 'Scheduled', color: 'info'});
		expect(snapshot_to_row({trigger_type: 'pre_upgrade'}, 0).trigger).toEqual({label: 'Pre-Upgrade', color: 'warning'});
		expect(snapshot_to_row({trigger_type: 'pre_restore'}, 0).trigger).toEqual({label: 'Pre-Restore', color: 'secondary'});
	});

	it('passes an UNKNOWN trigger type through verbatim (never hidden, never guessed)', () => {
		expect(snapshot_to_row({trigger_type: 'some-new-server-value'}, 0).trigger).toEqual({label: 'some-new-server-value'});
	});

	it('flags Corrupt ONLY on an explicit checksum_ok=false verdict', () => {
		expect(snapshot_to_row({checksum_ok: false}, 0).integrity).toEqual({label: 'Corrupt', color: 'error'});
		expect(snapshot_to_row({checksum_ok: true}, 0).integrity).toBeNull();
		expect(snapshot_to_row({}, 0).integrity).toBeNull(); // sweep not run yet ≠ corrupt
	});

	it('maps the three last_restore_result values distinctly; rollback_failed is an error', () => {
		expect(snapshot_to_row({last_restore_result: 'ok'}, 0).last_restore).toEqual({label: 'OK', color: 'success'});
		expect(snapshot_to_row({last_restore_result: 'rolled_back'}, 0).last_restore).toEqual({label: 'Rolled back', color: 'warning'});
		expect(snapshot_to_row({last_restore_result: 'rollback_failed'}, 0).last_restore).toEqual({label: 'Rollback failed', color: 'error'});
		expect(snapshot_to_row({}, 0).last_restore).toBeNull();
	});

	it('keys the grid row by a stable hash of the snapshot UUID, carrying the UUID out-of-band', () => {
		const row = snapshot_to_row({id: 'abc-uuid', name: 'x'}, 3);
		expect(row.id).toBe(getStableHash('abc-uuid')); // stable across refetch, not the array index
		expect(row.sid).toBe('abc-uuid');
	});
});
