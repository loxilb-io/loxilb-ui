//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IPolicyAttribute} from 'types/qos';
import {IMetricsSnapshot} from 'types/observability';
import {selectSamples} from './selectors';

//---------------------------------------------------------
// Policer attachment — "configured but shaping nothing" (Stage 3.3)
//---------------------------------------------------------
// A policer may legitimately be created before its attachment target exists:
// the control path flags the attachment and the 10-second housekeeping ticker
// re-drives it until the target appears. That design is sound but it fails
// silently — a policer whose target NEVER materialises (a typo'd VIP, a rule
// that was deleted underneath it) reports success at create time and then
// shapes nothing, forever. Surfacing that state is the whole point of this
// panel.
//
// ⭐⭐ THE CORRECTION THIS MODULE IS BUILT ON. The two sources this panel
// reads are NOT independent, and the campaign brief assumed they were —
// "REST `attached` is recorded state, the gauge is datapath reality, so the
// panel's value is the mismatch". Read at the writers, that is false:
//
//   pkg/loxinet/qospol.go:175   Attached: p.attached()   → the gauge's store
//   pkg/loxinet/qospol.go:203   pol.Attached = pe.attached() → the REST body
//
// Both call the SAME `PolEntry.attached()` predicate over the same `PolMap`
// under the same lock. There is no "desired vs actual" axis here at all: it
// is one predicate read at two different TIMES. REST computes it live per
// request; the gauge serves a store republished on every policer mutation and
// on every housekeeping tick (`LoxinetTiVal = 10`s).
//
// ⚠️ So a DISAGREEMENT between them cannot mean datapath drift, and must not
// be alarmed on. Its only possible meaning is staleness bounded by one tick
// plus the scrape interval — a policer created seconds ago is legitimately
// mid-re-drive, and a panel that called that a fault would fire on every
// healthy policer creation. `'conflict'` is therefore reported as a
// re-read-in-a-moment caveat, never as a finding.
//
// ⭐ What IS actionable is the value both sources agree on: `attached=false`
// means at least one attachment point is pending re-drive and the policer
// currently shapes nothing. That is the finding, and it needs only one
// source to be believed.
//
// ⭐ Pattern 5 from Stage 3.2 still governs, in its exact form: ask REST what
// a zero is SUPPOSED to look like. The collector emits nothing at all when no
// policer is configured, so an absent family is the CORRECT reading of an
// unused feature — and the identical absence while REST lists policers is a
// metrics-path fault. Only the REST list tells those two apart, which is why
// an absent family does not short-circuit this report the way it does in 3.2:
// REST may still carry the entire answer on its own.

export const POLICER_ATTACHED = 'loxilb_policer_attached';

const IDENT = 'ident';

/**
 * How well a single policer's attachment state is known.
 *
 * Deliberately ORTHOGONAL to the attachment answer itself: `attached` says
 * whether the policer is shaping, this says how much to trust that. Folding
 * the two together is what produces copy that reports a transient skew as a
 * datapath fault.
 */
export type PolicerCorroboration =
	// Both sources answered and agree. The ordinary case.
	| 'agreed'
	// ⚠️ Both answered and differ. Bounded staleness (≤ one 10s tick + the
	// scrape interval), NOT drift — the two are the same predicate. Only
	// meaningful if it persists across several refreshes.
	| 'conflict'
	// Only the gauge answered: either REST does not list this policer (a
	// delete the store has not caught up with) or this gateway build omits
	// the read-only `attached` field.
	| 'metric-only'
	// Only REST answered — no series for this ident. Within a tick of
	// creation that is expected; persisting, the metrics path is the suspect.
	| 'rest-only'
	// Neither source has an opinion: listed by REST, but the build omits
	// `attached` and the gauge has no series for it.
	| 'unreported';

export interface IPolicerAttachmentRow {
	/** The policer name. Joins `policyIdent` to the `ident` label. */
	ident: string;
	/**
	 * Best available answer to "is this policer programmed and shaping".
	 * `undefined` when the sources conflict or neither answered — never
	 * defaulted to `false`, which would invent the finding.
	 */
	attached: boolean | undefined;
	corroboration: PolicerCorroboration;
	/** Whether the REST policy list contains this ident at all. */
	listedInRest: boolean;
	/** The gauge's answer for this ident; `undefined` when it has no series. */
	metricAttached: boolean | undefined;
	/** REST's answer; `undefined` when unlisted or the build omits the field. */
	restAttached: boolean | undefined;
}

/**
 * The single judgement, computed once here so no renderer re-derives it and
 * gets the idle case backwards.
 */
export type PolicerAttachmentVerdict =
	// The REST policy list is unavailable, so "no policer configured" cannot
	// be told apart from "policers configured and the gauge is broken".
	// Judgement withheld; whatever the gauge does report is still shown.
	| 'unknown-configuration'
	// ⭐ REST lists no policer. The gauge's silence is then exactly correct
	// and there is nothing here to fix — QoS policing is simply not in use.
	| 'none-configured'
	// ⭐⭐ The one actionable state: at least one configured policer is
	// pending attachment and therefore shaping nothing.
	| 'pending-attachment'
	// Every configured policer is programmed.
	| 'all-attached'
	// Policers are configured, none is known-pending, but at least one state
	// could not be established (conflict, or no series and no REST field).
	| 'incomplete';

export type PolicerAttachmentReport =
	// No snapshot, or the scrape itself failed.
	| {kind: 'unavailable'}
	| {
			kind: 'ok';
			rows: readonly IPolicerAttachmentRow[];
			verdict: PolicerAttachmentVerdict;
			/**
			 * Whether the gauge family appeared in the scrape at all.
			 * ⚠️ Absence is NOT an error on its own — with no policer
			 * configured the collector correctly emits nothing. It only
			 * becomes a metrics-path fault next to a non-empty REST list.
			 */
			familyExported: boolean;
			/** Configured policers, per REST; `undefined` when unavailable. */
			configured: number | undefined;
			pending: number;
			attached: number;
			conflicts: number;
			/** Rows whose state could not be established at all. */
			unknown: number;
	  };

/**
 * Read the gauge into `ident → attached`.
 *
 * ⚠️ A non-finite sample is not a boolean and is dropped rather than coerced:
 * `NaN > 0` is false, which would silently manufacture a "pending" finding.
 * The gauge is written as exactly 0 or 1, so anything else is a scrape
 * defect and withholding the row's metric side is the honest answer.
 */
function metricAttachment(snapshot: IMetricsSnapshot): Map<string, boolean> {
	const byIdent = new Map<string, boolean>();
	for (const sample of selectSamples(snapshot, POLICER_ATTACHED)) {
		const ident = sample.labels[IDENT];
		// An unlabelled series cannot be joined to a policer.
		if (ident === undefined) continue;
		if (!Number.isFinite(sample.value)) continue;
		byIdent.set(ident, sample.value !== 0);
	}
	return byIdent;
}

function corroborate(
	metricAttached: boolean | undefined,
	restAttached: boolean | undefined,
): {attached: boolean | undefined; corroboration: PolicerCorroboration} {
	if (metricAttached !== undefined && restAttached !== undefined) {
		return metricAttached === restAttached
			? {attached: metricAttached, corroboration: 'agreed'}
			: // ⚠️ No winner is picked. The two are the same predicate at
				// different times, so neither is "more true" — the honest
				// answer is that the state is in flight.
				{attached: undefined, corroboration: 'conflict'};
	}
	if (metricAttached !== undefined) return {attached: metricAttached, corroboration: 'metric-only'};
	if (restAttached !== undefined) return {attached: restAttached, corroboration: 'rest-only'};
	// Only reachable for a REST-listed policer on a build that omits
	// `attached`: a row sourced from the gauge always carries a finite value,
	// because `metricAttachment` drops the ones that do not.
	return {attached: undefined, corroboration: 'unreported'};
}

export function policerAttachment(
	snapshot: IMetricsSnapshot | undefined,
	policies: readonly IPolicyAttribute[] | undefined,
): PolicerAttachmentReport {
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};

	const familyExported = snapshot.families.get(POLICER_ATTACHED) !== undefined;
	const metric = metricAttachment(snapshot);

	// ⚠️ The row set is the UNION of both sources, keyed byte-wise. The
	// collector passes `s.Ident` to the label verbatim and REST reads the same
	// `PolEntry.Key.PolName`, so there is no sanitisation step between them
	// and no normalisation is warranted here — 3.1's byte-wise lesson applies
	// as a licence to join exactly, not as a reason to fold case or trim.
	const idents = new Set<string>();
	// REST order first so the table's natural order is the configured order.
	if (policies) for (const policy of policies) idents.add(policy.policyIdent);
	for (const ident of metric.keys()) idents.add(ident);

	// A duplicate ident cannot happen (PolMap is keyed by name), so last-wins
	// here is a formality rather than a policy decision.
	const restByIdent = new Map<string, IPolicyAttribute>();
	if (policies) for (const policy of policies) restByIdent.set(policy.policyIdent, policy);

	const rows = [...idents]
		.map<IPolicerAttachmentRow>(ident => {
			const metricAttached = metric.get(ident);
			const restAttached = restByIdent.get(ident)?.attached;
			return {
				ident,
				listedInRest: restByIdent.has(ident),
				metricAttached,
				restAttached,
				...corroborate(metricAttached, restAttached),
			};
		})
		// Pending first — the finding should not be below the fold on a
		// gateway with many healthy policers — then unknown, then by name so
		// the table does not reshuffle between polls.
		.sort((a, b) => rank(a) - rank(b) || a.ident.localeCompare(b.ident));

	const pending = rows.filter(r => r.attached === false).length;
	const attached = rows.filter(r => r.attached === true).length;
	const conflicts = rows.filter(r => r.corroboration === 'conflict').length;
	const unknown = rows.filter(r => r.attached === undefined).length;

	return {
		kind: 'ok',
		rows,
		familyExported,
		configured: policies ? policies.length : undefined,
		pending,
		attached,
		conflicts,
		unknown,
		verdict: attachmentVerdict(policies, rows),
	};
}

/** Sort rank: the actionable state first, then the unknown, then the healthy. */
function rank(row: IPolicerAttachmentRow): number {
	if (row.attached === false) return 0;
	if (row.attached === undefined) return 1;
	return 2;
}

export function attachmentVerdict(
	policies: readonly IPolicyAttribute[] | undefined,
	rows: readonly IPolicerAttachmentRow[],
): PolicerAttachmentVerdict {
	// Order matters, and the first two both mean "the question was not
	// answered" — either must win over a verdict that would read as a
	// measurement of the datapath.
	if (!policies) return 'unknown-configuration';
	// ⭐ REST is authoritative on EXISTENCE. Zero configured policers makes
	// the gauge's silence correct by construction; any lingering series is a
	// scrape older than a delete and says nothing about a live policer.
	if (policies.length === 0) return 'none-configured';
	// ⭐⭐ One known-pending policer is the finding, and it outranks any
	// observability gap: it is true regardless of which source established it.
	if (rows.some(r => r.attached === false)) return 'pending-attachment';
	if (rows.some(r => r.attached === undefined)) return 'incomplete';
	return 'all-attached';
}
