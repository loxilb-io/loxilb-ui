//---------------------------------------------------------
// Instance snapshot types (docs/SNAPSHOT_UI_DESIGN.md).
//
// Wire shapes are aliases of the generated OAM contract (src/api) — nothing
// here restates a server schema. The one exception is IGatewayRestoreResult:
// OAM passes the gateway's restore response through verbatim as opaque JSON
// (`RestoreOutcome.gateway_response`), so its inner shape cannot come from the
// OAM spec. It follows what the gateway serialises, which is its restore
// engine's own result and not the swagger RestoreResult model: `plan` and
// `errors` are always sent and are `null` when empty, `compatible` is always
// sent, and `result` is left out when the pipeline stopped before APPLY.
//---------------------------------------------------------
import type {OamSchema} from 'api';

export type ISnapshot = OamSchema<'models.InstanceSnapshot'>;
export type ISnapshotList = OamSchema<'models.PaginatedSnapshotsResponse'>;
export type ISnapshotSchedule = OamSchema<'models.InstanceSnapshotSchedule'>;
export type IRestoreOutcome = OamSchema<'models.RestoreOutcome'>;

export type ISnapshotTriggerType = 'manual' | 'scheduled' | 'pre_upgrade' | 'pre_restore';
export type IRestoreResultKind = 'ok' | 'rolled-back' | 'ROLLBACK-FAILED';

// Gateway swagger `RestorePlanItem` / `RestoreResult`, reached only through
// OAM's opaque gateway_response pass-through (see header comment).
export interface IGatewayRestorePlanItem {
	domain?: string;
	to_delete?: number;
	to_apply?: number;
}

export interface IGatewayRestoreResult {
	mode?: 'dry-run' | 'commit' | 'boot';
	compatible?: boolean;
	schema_version?: string;
	snapshot_gateway_version?: string;
	current_gateway_version?: string;
	plan?: IGatewayRestorePlanItem[] | null;
	/**
	 * Not only failures: a commit that applied but could not be written to the
	 * boot configuration answers `result: "ok"` with the reason here.
	 */
	errors?: string[] | null;
	/** ok, rolled-back, or ROLLBACK-FAILED; absent when the pipeline stopped before APPLY. */
	result?: string;
	/**
	 * Sent on a commit that answered `ok`, and only there: whether the applied
	 * configuration was also written to the boot configuration. `false` is sent
	 * explicitly — the restore is live and a restart undoes it.
	 */
	persisted?: boolean;
	pre_restore_snapshot_persisted?: string;
	/**
	 * Non-fatal findings the gateway reports alongside a result — including a
	 * SUCCESSFUL one. Populated by `restore.go` for inbound secrets that had to
	 * be re-encrypted under this node's secret, for OPTIONAL recovery
	 * dependencies (which are informational and never verified), and for items
	 * APPLY skipped as already-existing duplicates.
	 *
	 * ⚠️ These were modelled and rendered nowhere, so a restore the gateway
	 * qualified rendered as an unqualified success — the exact thing
	 * `snapshots.spec.ts` names as its first honesty invariant ("the page never
	 * reports success the server didn't return"). Dry-run emits them too:
	 * dependency verification runs there on purpose, so these are the operator's
	 * only warning BEFORE they commit.
	 */
	warnings?: string[];
}

// A restore outcome with the pass-through blob narrowed for rendering.
export type IRestoreOutcomeParsed = Omit<IRestoreOutcome, 'gateway_response'> & {
	gateway_response?: IGatewayRestoreResult;
};

//---------------------------------------------------------
// UI-only state (restore wizard, §5.2)
//---------------------------------------------------------
export type TRestoreWizardStep = 'dry-run' | 'confirm' | 'committing' | 'result';

export const SNAPSHOT_UPLOAD_MAX_BYTES = 16 * 1024 * 1024; // mirrors OAM's 413 cap
export const SNAPSHOT_NAME_MAX_LEN = 128;
export const SCHEDULE_INTERVAL_HOURS_MIN = 1;
export const SCHEDULE_INTERVAL_HOURS_MAX = 168;
export const SCHEDULE_RETAIN_MIN = 1;
export const SCHEDULE_RETAIN_MAX = 100;
