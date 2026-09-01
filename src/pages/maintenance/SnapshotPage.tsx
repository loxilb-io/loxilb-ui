//---------------------------------------------------------
// Instance Snapshots page (docs/SNAPSHOT_UI_DESIGN.md).
//
// Serves the operator upgrade runbook: take → pin → upgrade → dry-run →
// commit → verify. All data comes from the OAM snapshot orchestration API;
// the server response is the truth — no client-side success is ever invented.
// Every mutating control (and Download — snapshots contain IPsec secrets) is
// admin-only (OAM ActConfigWrite); the list renders for every role.
//---------------------------------------------------------
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import BookmarkRemoveIcon from '@mui/icons-material/BookmarkRemove';
import DownloadIcon from '@mui/icons-material/Download';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {Alert, Box, Button, Chip, Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import SnapshotScheduleForm, {IScheduleEntry} from 'components/input/SnapshotScheduleForm';
import TakeSnapshotForm, {ITakeSnapshotEntry} from 'components/input/TakeSnapshotForm';
import UploadSnapshotForm, {IUploadSnapshotEntry} from 'components/input/UploadSnapshotForm';
import RestoreWizard from 'components/snapshot/RestoreWizard';
import {snapshotOpErrorText} from 'components/snapshot/snapshotOpError';
import SnapshotTable from 'components/table/maintenance/SnapshotTable';
import {
	request_delete_snapshot,
	request_download_snapshot,
	request_patch_snapshot,
	request_take_snapshot,
	request_upload_snapshot,
	request_put_snapshot_schedule,
} from 'connector/oam/snapshotApi';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useRole} from 'hooks/query/oamHooks';
import {useInvalidateSnapshots, useSnapshotSchedule, useSnapshots} from 'hooks/query/snapshotHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState} from 'react';
import {getStableHash} from 'common';
import {ISnapshot} from 'types/snapshot';
import {toPageState} from 'components/state/pageState';

// Server page size. Retention caps unpinned snapshots at 100 per instance, so
// a single max-size page covers every realistic list; total_count is checked
// and a truncation notice shown if the instance ever exceeds it (no silent cap).
const PAGE_LIMIT = 100;

//---------------------------------------------------------
// Main Page Component
//---------------------------------------------------------
export default function SnapshotPage() {
	const inst = useInstanceFromURL();
	const instanceId = inst?.id;
	const snapshot_query = useSnapshots(instanceId, 1, PAGE_LIMIT);
	const {data, isError, isLoading, refetch} = snapshot_query;
	const {data: schedule, refetch: refetchSchedule} = useSnapshotSchedule(instanceId);
	const invalidate = useInvalidateSnapshots(instanceId);
	const {can_manage_config} = useRole();
	const {openPopUp, enableYes} = usePopUp();

	const snapshots: ISnapshot[] = data?.data ?? [];
	const totalCount = data?.pagination?.total_count ?? snapshots.length;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [restoreTarget, setRestoreTarget] = useState<ISnapshot | null>(null);
	const [downloading, setDownloading] = useState(false);

	const takeFormRef = useRef<(ITakeSnapshotEntry & {isValid: boolean}) | null>(null);
	const uploadFormRef = useRef<(IUploadSnapshotEntry & {isValid: boolean}) | null>(null);
	const scheduleFormRef = useRef<(IScheduleEntry & {isValid: boolean}) | null>(null);
	const deleteConfirmRef = useRef<string>('');

	// selected_rows carries the grid row id, which is a stable hash of the
	// snapshot UUID (see SnapshotTable) — resolve back to the snapshot by that
	// hash, never by array position, so a refetch can't move the selection.
	const selected: ISnapshot | null =
		selected_rows.length === 1 ? snapshots.find(s => getStableHash(s.id ?? '') === selected_rows[0]) ?? null : null;
	const selectedCorrupt = selected?.checksum_ok === false;

	const refreshAll = () => {
		set_selected_rows([]);
		invalidate();
		refetch();
		refetchSchedule();
	};

	// Localized headline first, then the server's verbatim detail — the
	// snapshot inline-error convention (§5.3); a stale-row 404 must stay
	// readable in the dialog, not collapse to the generic failure text.
	const reportResult = (res: {status: string; localeKey: string; rawDetail?: string}, successMsg: string) => {
		if (res.status === 'confirmed') {
			openPopUp(t('Success'), successMsg, t('OK'));
			refreshAll();
		} else {
			openPopUp(t('Error'), snapshotOpErrorText(res), t('OK'));
		}
	};

	//---------------------------------------------------------
	// Take / Pre-Upgrade / Upload
	//---------------------------------------------------------
	const handleTake = () => {
		if (!instanceId) return;
		takeFormRef.current = null;
		const form = (
			<TakeSnapshotForm
				key={Date.now()}
				onChange={data => {
					takeFormRef.current = data;
					enableYes(data.isValid);
				}}
			/>
		);
		openPopUp('', form, t('Take Snapshot'), t('Cancel'), async () => {
			if (!takeFormRef.current) return;
			const {name, description} = takeFormRef.current;
			const res = await request_take_snapshot(instanceId, {name: name.trim(), description: description.trim() || undefined, trigger_type: 'manual'});
			reportResult(res, t('Snapshot "{{name}}" created.', {name: name.trim()}));
		}, true);
	};

	// Runbook steps 1+2 in one click: take with trigger pre_upgrade and
	// auto-pin the result. The name is stamped with the REAL gateway version
	// from the take response (design §4) — the instance record's version field
	// is operator-entered and often stale; the initial take uses it only as a
	// placeholder, then the pin PATCH renames to the authoritative version.
	const handlePreUpgrade = () => {
		if (!instanceId) return;
		const placeholder = `pre-upgrade-${inst?.version || 'unknown'}`;
		openPopUp(
			t('Pre-Upgrade Snapshot'),
			t('Take a pinned pre-upgrade snapshot named after the running gateway version (e.g. "{{name}}")?', {name: placeholder}),
			t('Take & Pin'),
			t('Cancel'),
			async () => {
				const res = await request_take_snapshot(instanceId, {
					name: placeholder,
					description: t('Automatic pre-upgrade safety snapshot'),
					trigger_type: 'pre_upgrade',
				});
				if (res.status !== 'confirmed') {
					openPopUp(t('Error'), t(res.localeKey), t('OK'));
					return;
				}
				let name = res.data?.name ?? placeholder;
				if (res.data?.id) {
					const gwVersion = res.data.gateway_version;
					const finalName = gwVersion ? `pre-upgrade-${gwVersion}` : name;
					const pin = await request_patch_snapshot(res.data.id, {pinned: true, name: finalName});
					if (pin.status !== 'confirmed') {
						// The snapshot exists but is NOT pinned — say so honestly.
						openPopUp(t('Warning'), t('Snapshot "{{name}}" was created but pinning failed: {{error}}', {name, error: t(pin.localeKey)}), t('OK'));
						refreshAll();
						return;
					}
					name = finalName;
				}
				openPopUp(t('Success'), t('Pinned pre-upgrade snapshot "{{name}}" created.', {name}), t('OK'));
				refreshAll();
			},
		);
	};

	const handleUpload = () => {
		if (!instanceId) return;
		uploadFormRef.current = null;
		const form = (
			<UploadSnapshotForm
				key={Date.now()}
				onChange={data => {
					uploadFormRef.current = data;
					enableYes(data.isValid);
				}}
			/>
		);
		openPopUp('', form, t('Upload'), t('Cancel'), async () => {
			if (!uploadFormRef.current?.file) return;
			const {file, name, description} = uploadFormRef.current;
			const res = await request_upload_snapshot(instanceId, file, {name: name.trim() || undefined, description: description.trim() || undefined});
			reportResult(res, t('Snapshot uploaded.'));
		}, true);
	};

	//---------------------------------------------------------
	// Schedule
	//---------------------------------------------------------
	const handleSchedule = () => {
		if (!instanceId) return;
		scheduleFormRef.current = null;
		const form = (
			<SnapshotScheduleForm
				key={Date.now()}
				initial={{
					enabled: schedule?.enabled ?? false,
					interval_hours: schedule?.interval_hours ?? 24,
					retain_count: schedule?.retain_count ?? 10,
				}}
				onChange={data => {
					scheduleFormRef.current = data;
					enableYes(data.isValid);
				}}
			/>
		);
		openPopUp('', form, t('Save'), t('Cancel'), async () => {
			if (!scheduleFormRef.current) return;
			const {enabled, interval_hours, retain_count} = scheduleFormRef.current;
			const res = await request_put_snapshot_schedule(instanceId, {enabled, interval_hours, retain_count});
			reportResult(res, t('Snapshot schedule saved.'));
		}, true);
	};

	//---------------------------------------------------------
	// Row actions (single selection)
	//---------------------------------------------------------
	const handleDownload = async () => {
		if (!selected?.id || downloading) return;
		setDownloading(true);
		try {
			await request_download_snapshot(selected.id, selected.name ?? selected.id);
		} catch (e: any) {
			// Honest failure: show the server's error, never a silent no-op.
			openPopUp(t('Error'), t('Download failed: {{error}}', {error: e?.message ?? String(e)}), t('OK'));
		} finally {
			setDownloading(false);
		}
	};

	const handlePinToggle = async () => {
		if (!selected?.id) return;
		const next = !selected.pinned;
		const res = await request_patch_snapshot(selected.id, {pinned: next});
		reportResult(res, next ? t('Snapshot "{{name}}" pinned.', {name: selected.name}) : t('Snapshot "{{name}}" unpinned.', {name: selected.name}));
	};

	// Typed-confirm delete (§5.3). Pinned snapshots are blocked here — the UI
	// mirrors the API's force semantics instead of silently passing force=true.
	const handleDelete = () => {
		if (!selected?.id) return;
		if (selected.pinned) {
			openPopUp(t('Pinned snapshot'), t('"{{name}}" is pinned. Unpin it first to delete it.', {name: selected.name}), t('OK'));
			return;
		}
		const snapName = selected.name ?? '';
		const sid = selected.id;
		deleteConfirmRef.current = '';
		const confirm_form = (
			<Stack spacing={2} key={Date.now()}>
				<Typography variant="body1">
					{t('This permanently deletes snapshot "{{name}}" and its stored configuration document. This cannot be undone.', {name: snapName})}
				</Typography>
				<ParamBox
					label={t('Type the snapshot name to confirm')}
					value={''}
					onChange={(v: string) => {
						deleteConfirmRef.current = v;
						enableYes(v === snapName);
					}}
					param_desc={{type: 'string', description: snapName, required: true}}
				/>
			</Stack>
		);
		openPopUp(t('WARNING!! Delete Snapshot'), confirm_form, t('Delete'), t('Cancel'), async () => {
			if (deleteConfirmRef.current !== snapName) return;
			const res = await request_delete_snapshot(sid);
			reportResult(res, t('Snapshot "{{name}}" deleted.', {name: snapName}));
		}, true);
	};

	//---------------------------------------------------------
	// Render
	//---------------------------------------------------------
	const scheduleStrip = schedule?.enabled ? (
		<Alert severity="info" icon={<ScheduleIcon fontSize="inherit" />} sx={{width: '100%'}}>
			{t('Scheduled snapshots: every {{hours}}h · keep {{retain}}', {hours: schedule.interval_hours, retain: schedule.retain_count})}
			{schedule.last_run_at
				? ` · ${t('last run')} ${new Date(schedule.last_run_at).toLocaleString()} ${schedule.last_run_result === 'ok' ? t('OK') : schedule.last_run_result ?? ''}`
				: ` · ${t('not run yet')}`}
		</Alert>
	) : null;

	return (
		<Fragment>
			{/* Tracks the now-uncapped DataTable width so the action strip and
			    schedule alert stay aligned with the table below. */}
			<Stack spacing={1} sx={{mb: 1}} width="100%">
				{can_manage_config && (
					<Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
						<Button variant="outlined" size="small" startIcon={<AddAPhotoIcon />} onClick={handleTake}>
							{t('Take Snapshot')}
						</Button>
						<Button variant="outlined" size="small" color="warning" startIcon={<UpgradeIcon />} onClick={handlePreUpgrade}>
							{t('Pre-Upgrade Snapshot')}
						</Button>
						<Button variant="outlined" size="small" startIcon={<UploadFileIcon />} onClick={handleUpload}>
							{t('Upload')}
						</Button>
						<Button variant="outlined" size="small" startIcon={<ScheduleIcon />} onClick={handleSchedule}>
							{t('Schedule')}
						</Button>
					</Stack>
				)}

				{scheduleStrip}

				{can_manage_config && (
					<Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
						<Typography variant="caption" color="text.secondary">
							{t('Selected snapshot')}:
						</Typography>
						{selected ? <Chip size="small" label={selected.name} sx={{borderRadius: '4px'}} /> : <Typography variant="caption" color="text.disabled">{t('none')}</Typography>}
						<Button
							variant="contained"
							size="small"
							color="error"
							startIcon={<SettingsBackupRestoreIcon />}
							disabled={!selected || selectedCorrupt}
							onClick={() => selected && setRestoreTarget(selected)}
						>
							{t('Restore…')}
						</Button>
						<Button variant="outlined" size="small" startIcon={<DownloadIcon />} disabled={!selected || selectedCorrupt || downloading} onClick={handleDownload}>
							{t('Download')}
						</Button>
						<Button
							variant="outlined"
							size="small"
							startIcon={selected?.pinned ? <BookmarkRemoveIcon /> : <BookmarkAddIcon />}
							disabled={!selected}
							onClick={handlePinToggle}
						>
							{selected?.pinned ? t('Unpin') : t('Pin')}
						</Button>
						<Button variant="outlined" size="small" color="warning" disabled={!selected} onClick={handleDelete}>
							{t('Delete')}
						</Button>
						{selectedCorrupt && (
							<Typography variant="caption" color="error">
								{t('This snapshot failed its integrity check — Restore and Download are disabled.')}
							</Typography>
						)}
					</Stack>
				)}

				{!isLoading && !isError && snapshots.length === 0 && (
					<Alert severity="info" sx={{width: '100%'}}>
						{t('No snapshots yet. A snapshot captures the complete gateway configuration of this instance and can restore it after an upgrade or a bad change.')}
					</Alert>
				)}

				{totalCount > snapshots.length && (
					<Alert severity="warning" sx={{width: '100%'}}>
						{t('Showing the newest {{shown}} of {{total}} snapshots.', {shown: snapshots.length, total: totalCount})}
					</Alert>
				)}
			</Stack>

			<SnapshotTable
				data={snapshots}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onRefresh={refreshAll}
				state={toPageState(snapshot_query, {op: 'snapshot.list'})}
			/>

			<Box sx={{mt: 1}}>
				<Typography variant="caption" color="text.secondary">
					{t('Snapshots contain the full gateway configuration including IPsec secrets; download and restore are admin-only.')}
				</Typography>
			</Box>

			{restoreTarget && (
				<RestoreWizard
					open={restoreTarget !== null}
					snapshot={restoreTarget}
					instanceName={inst?.name ?? ''}
					onClose={() => {
						// Refetch even after a cancelled commit attempt: a failed
						// commit still created a pre_restore row on the server.
						setRestoreTarget(null);
						refreshAll();
					}}
				/>
			)}
		</Fragment>
	);
}
