//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {getManifestFamily} from './metricManifest';

//---------------------------------------------------------
// Why a family is absent (Stage 3.5)
//---------------------------------------------------------
// Until now the ten-state classifier reasoned about this by hand, once per
// panel: is an empty exposition a lazy series that has not been written yet,
// a precondition that has not been met, or a gateway failing to export
// something it always should? Each panel re-derived it, and a wrong guess
// reaches an operator as either a false alarm or a hidden fault. The manifest
// answers it for all 193 gateway-scrape families, so this module reads the
// answer instead of guessing it.
//
// ⭐⭐ THE DISTINCTION THIS MODULE IS BUILT ON, and the reason the stage brief
// ("feed the loader and the state classifier from it") needed unpacking: the
// manifest carries TWO orthogonal facts that are easy to conflate.
//
//   `activation` + `activationPrecondition`  ->  is ABSENCE expected?
//   `implementationStatus`                   ->  is a PRESENT value worth trusting?
//
// A `writer-mapped` family is registered exactly as eagerly as a
// `verified-runtime` one — the difference is that nothing has ever proven its
// writer fires. So implementation status must NOT feed the absence reading:
// doing so would excuse a genuinely missing eager family as "unverified" and
// hide the export defect. It is exposed separately, as `valueTrust`.
//
// ⚠️⚠️ AND THE ORDERING TRAP, which is why `activationPrecondition` is checked
// BEFORE `activationKind`: **eager does not mean always-present.** 14 of the
// 193 gateway-scrape families are eager AND carry a precondition — the
// `loxilb_ai_jwks_*` set is registered at init but emits one series per
// configured JWT auth profile, so with no profile configured the family is
// legitimately absent. Reading the activation code first would call that a
// fault, which is exactly the Stage 3.1 false alarm this campaign already
// paid for once.

/** Why a single family is not in the exposition. */
export type AbsenceReading =
	// ⚠️ Not in the manifest at all. Deny by default: a panel referencing a
	// name no constructor emits is registry drift, not an explained absence.
	| {kind: 'not-in-manifest'}
	// ⭐ A documented precondition has not been met. Benign AND actionable:
	// the text says what to configure.
	| {kind: 'conditional'; precondition: string}
	// Behind a datapath / DPU / build gate the UI cannot inspect.
	| {kind: 'gated'}
	// A lazy child that appears on first write. The expected reading on an
	// idle gateway.
	| {kind: 'until-used'}
	// ⭐⭐ Registered at init with no precondition, and still missing. The
	// one reading that indicates something is wrong rather than merely unused.
	| {kind: 'unexpected'}
	// The activation code is not in this build's vocabulary.
	| {kind: 'indeterminate'};

/**
 * Why `name` would be absent, from the manifest contract alone.
 *
 * ⚠️ Says nothing about whether it IS absent — callers establish that from
 * the snapshot. Keeping the two apart is what lets this be a pure lookup.
 */
export function absenceReading(name: string): AbsenceReading {
	const family = getManifestFamily(name);
	if (!family) return {kind: 'not-in-manifest'};

	// ⚠️⚠️ FIRST, before the activation kind. An eager family with a
	// precondition is legitimately absent until that precondition holds, and
	// 14 gateway-scrape families are exactly that.
	const precondition = family.activationPrecondition.trim();
	if (precondition.length > 0) return {kind: 'conditional', precondition};

	switch (family.activationKind) {
		case 'gated':
			return {kind: 'gated'};
		case 'lazy':
			return {kind: 'until-used'};
		case 'unknown':
			return {kind: 'indeterminate'};
		case 'eager':
			return {kind: 'unexpected'};
	}
}

/**
 * How much a PRESENT value is worth — deliberately separate from absence.
 *
 * `conditional-with-proven-writer` counts as verified: its writer IS proven,
 * it merely needs a precondition, and that precondition is already reported
 * through `absenceReading`.
 */
export type ValueTrust = 'verified' | 'unverified' | 'unknown';

export function valueTrust(name: string): ValueTrust {
	const family = getManifestFamily(name);
	if (!family) return 'unknown';
	switch (family.implementationStatus) {
		case 'verified-runtime':
		case 'verified-static':
		case 'conditional-with-proven-writer':
			return 'verified';
		case 'writer-mapped':
			return 'unverified';
		case 'unknown':
			return 'unknown';
	}
}

/**
 * Severity order for summarising a panel that needs several families.
 *
 * ⭐ `unexpected` and `not-in-manifest` outrank every benign explanation: if
 * ONE of a panel's families should always be there and is not, that fact must
 * not be buried under another family's "appears once used". Conversely
 * `until-used` ranks last, because it is the reading that explains the least.
 */
const ABSENCE_SEVERITY: Readonly<Record<AbsenceReading['kind'], number>> = {
	'not-in-manifest': 0,
	unexpected: 1,
	indeterminate: 2,
	gated: 3,
	conditional: 4,
	'until-used': 5,
};

export interface IAbsenceExplanation {
	/** The most severe reading across the absent families. */
	reading: AbsenceReading;
	/** The panel's families that are not in the exposition. */
	absentFamilies: readonly string[];
	/** How many of the panel's families the scrape does carry. */
	presentCount: number;
}

/**
 * Explain why a panel has nothing to show.
 *
 * Returns `undefined` when every family the panel needs IS present — the
 * panel's emptiness is then about samples or selectors, not about the
 * exposition, and inventing a contract explanation for it would mislead.
 */
export function explainAbsence(
	families: readonly string[],
	snapshot: IMetricsSnapshot | undefined,
): IAbsenceExplanation | undefined {
	// ⚠️ A failed scrape is not an absent family. The view state already
	// reports that, and reading the manifest here would dress a transport
	// failure up as a configuration precondition.
	if (!snapshot || snapshot.failure) return undefined;

	const absentFamilies = families.filter(name => snapshot.families.get(name) === undefined);
	if (absentFamilies.length === 0) return undefined;

	let reading = absenceReading(absentFamilies[0]);
	for (const name of absentFamilies.slice(1)) {
		const candidate = absenceReading(name);
		if (ABSENCE_SEVERITY[candidate.kind] < ABSENCE_SEVERITY[reading.kind]) reading = candidate;
	}

	return {
		reading,
		absentFamilies,
		presentCount: families.length - absentFamilies.length,
	};
}
