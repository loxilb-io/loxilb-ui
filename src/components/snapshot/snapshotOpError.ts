import {t} from 'i18next';
import {OpResult} from 'connector/fetcher/opResult';

//---------------------------------------------------------
// Snapshot inline-error convention (§5.3): the localized headline comes
// first, the server's verbatim detail follows. Snapshot failures are
// operator-actionable (stale row, checksum mismatch, storage errors), so this
// family deliberately renders rawDetail — unlike the general OpResult rule
// that keeps raw server prose out of dialogs. Shared by SnapshotPage's
// popups and RestoreWizard's dry-run/commit panels.
//---------------------------------------------------------
export function snapshotOpErrorText(res: Pick<OpResult, 'localeKey' | 'rawDetail'>): string {
	const detail = res.rawDetail?.trim();
	return detail ? `${t(res.localeKey)} ${detail}` : t(res.localeKey);
}
