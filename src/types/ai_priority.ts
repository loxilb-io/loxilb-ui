//---------------------------------------------------------
// Request priority on identities: priority class, default objective and
// allowed objectives (gateway 9f5017e2).
//
// The same three fields sit on API keys and tenants; a JWT profile carries the
// class only. Their omission semantics differ by owner, and the help text must
// say which one applies:
//
//   key / JWT  priority_class omitted   no cap from this identity
//              allowed_objectives []    narrows nothing (the tenant's allowance applies)
//   tenant     priority_class omitted   held at standard
//              allowed_objectives []    authorizes no raises
//
// In every case the allowance governs RAISES only: a hint at or below what a
// request gets without one needs no entry. A key's default objective counts
// only when its tenant allows it.
//
// The UI never invents a class. Unset is a real choice and the default one.
//---------------------------------------------------------
import type {GwSchema} from 'api';

export type IAIObjectiveEntry = GwSchema<'AIObjectiveEntry'>;

export const PRIORITY_CLASSES = ['critical', 'standard', 'sheddable'] as const;
export type PriorityClass = (typeof PRIORITY_CLASSES)[number];

/** Who owns the priority fields; their omission means something different on each. */
export type PriorityScope = 'key' | 'tenant' | 'jwt';

/** The body tiers an allowance may also name (requests ask for them by service_tier). */
export const BODY_TIERS = ['tier:priority', 'tier:fast', 'tier:flex'] as const;

/** The gateway's limit on one allowance list. */
export const MAX_ALLOWED_OBJECTIVES = 64;

const RANK: Record<PriorityClass, number> = {sheddable: 0, standard: 1, critical: 2};

export function isPriorityClass(value: unknown): value is PriorityClass {
	return typeof value === 'string' && (PRIORITY_CLASSES as readonly string[]).includes(value);
}

/** The class an objective's signed priority puts a request in. */
export function objectiveClass(priority: number | undefined): PriorityClass {
	const value = priority ?? 0;
	if (value > 0) return 'critical';
	if (value < 0) return 'sheddable';
	return 'standard';
}

/** Comma-separated text → trimmed, non-empty names, in order. */
export function parseObjectiveList(text: string): string[] {
	return text
		.split(',')
		.map(name => name.trim())
		.filter(name => name.length > 0);
}

export function objectiveListText(list: readonly string[] | null | undefined): string {
	return (list ?? []).join(', ');
}

/** The priority fields as an identity form holds them: raw text, '' = unset. */
export interface IPriorityDraft {
	priority_class: string;
	default_objective: string;
	allowed_objectives: string;
}

/** The priority fields as an identity reads back. */
export interface IPriorityFields {
	priority_class?: string | null;
	default_objective?: string | null;
	allowed_objectives?: string[] | null;
}

/** The priority fields as a write sends them: never null. */
export interface IPriorityWrite {
	priority_class?: string;
	default_objective?: string;
	allowed_objectives?: string[];
}

export function priorityDraftFrom(fields: IPriorityFields | null | undefined): IPriorityDraft {
	return {
		priority_class: fields?.priority_class ?? '',
		default_objective: fields?.default_objective ?? '',
		allowed_objectives: objectiveListText(fields?.allowed_objectives),
	};
}

/** Whether an identity declares any priority setting at all. */
export function hasPrioritySettings(fields: IPriorityFields | null | undefined): boolean {
	return !!fields?.priority_class || !!fields?.default_objective || (fields?.allowed_objectives?.length ?? 0) > 0;
}

/**
 * A create body: only what is set. Omission is the unset state on every owner,
 * so nothing is sent for a blank field.
 */
export function priorityCreateFields(draft: IPriorityDraft, scope: PriorityScope): IPriorityWrite {
	const out: IPriorityWrite = {};
	if (draft.priority_class !== '') out.priority_class = draft.priority_class;
	if (scope === 'jwt') return out;
	if (draft.default_objective.trim() !== '') out.default_objective = draft.default_objective.trim();
	const allowed = parseObjectiveList(draft.allowed_objectives);
	if (allowed.length > 0) out.allowed_objectives = allowed;
	return out;
}

/**
 * A change body for a key PATCH or a tenant POST: only the fields that differ
 * from the identity as read. An emptied field is sent as '' or [], which
 * clears it; an untouched one is omitted, which keeps it.
 */
export function priorityChangedFields(draft: IPriorityDraft, current: IPriorityFields | null | undefined, scope: PriorityScope): IPriorityWrite {
	const out: IPriorityWrite = {};
	if (draft.priority_class !== (current?.priority_class ?? '')) out.priority_class = draft.priority_class;
	if (scope === 'jwt') return out;
	const objective = draft.default_objective.trim();
	if (objective !== (current?.default_objective ?? '')) out.default_objective = objective;
	const allowed = parseObjectiveList(draft.allowed_objectives);
	if (allowed.join(',') !== (current?.allowed_objectives ?? []).join(',')) out.allowed_objectives = allowed;
	return out;
}

/** Field errors the gateway would refuse anyway; English source strings. */
export function validatePriorityDraft(draft: IPriorityDraft, scope: PriorityScope): string[] {
	const errors: string[] = [];
	if (draft.priority_class !== '' && !isPriorityClass(draft.priority_class)) errors.push('Priority class must be critical, standard or sheddable.');
	if (scope === 'jwt') return errors;
	if (draft.default_objective.includes(',')) errors.push('The default objective is one name.');
	const allowed = parseObjectiveList(draft.allowed_objectives);
	if (allowed.length > MAX_ALLOWED_OBJECTIVES) errors.push(`At most ${MAX_ALLOWED_OBJECTIVES} allowed objectives.`);
	const seen = new Set<string>();
	for (const name of allowed) {
		if (seen.has(name)) errors.push(`Allowed objective ${name} is duplicated.`);
		seen.add(name);
	}
	return errors;
}

/** A warning as a locale key and its values, so the form can translate it. */
export interface IPriorityWarning {
	key: string;
	values?: Record<string, string>;
}

/**
 * Warnings, never refusals: the gateway decides what is valid, and an
 * objective may be created after the identity that names it.
 * `objectives` is the list as read, or undefined when it could not be read.
 */
export function priorityWarnings(draft: IPriorityDraft, scope: PriorityScope, objectives: readonly IAIObjectiveEntry[] | undefined): IPriorityWarning[] {
	if (scope === 'jwt' || objectives === undefined) return [];
	const warnings: IPriorityWarning[] = [];
	const known = new Map(objectives.map(objective => [objective.name, objective]));
	const objective = draft.default_objective.trim();
	if (objective !== '' && !known.has(objective)) {
		warnings.push({key: 'The default objective names no objective that exists now. Requests are then treated as asking for an unknown objective.'});
	}
	const unknown = parseObjectiveList(draft.allowed_objectives).filter(name => !known.has(name) && !(BODY_TIERS as readonly string[]).includes(name));
	if (unknown.length > 0) warnings.push({key: 'Not an objective that exists now: {{names}}.', values: {names: unknown.join(', ')}});
	const target = known.get(objective);
	if (target) {
		// A tenant with no class is held at standard; a key or profile with no
		// class adds no cap of its own.
		const cap = isPriorityClass(draft.priority_class) ? draft.priority_class : scope === 'tenant' ? 'standard' : undefined;
		const wanted = objectiveClass(target.priority);
		if (cap !== undefined && RANK[wanted] > RANK[cap]) {
			warnings.push({key: 'The default objective is {{wanted}}, above the {{cap}} cap: its requests are held at {{cap}}.', values: {wanted, cap}});
		}
	}
	return warnings;
}
