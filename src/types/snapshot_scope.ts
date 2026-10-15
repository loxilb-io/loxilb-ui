// A projection of a stored document, never a second copy of its payload.
export interface SnapshotScope {
	schema: string;
	included: string[] | null;
	excluded: string[] | null;
	dependencies: {type: string; required: boolean}[] | null;
}
function names(value: unknown): string[] | null {
	return Array.isArray(value) && value.every(x => typeof x === 'string') ? [...new Set(value)].sort() : null;
}
export function snapshotScope(raw: unknown): SnapshotScope {
	if (!raw || typeof raw !== 'object') throw new Error('Invalid snapshot document');
	const doc = raw as Record<string, unknown>;
	if (doc.kind !== 'loxilb-snapshot' || typeof doc.schema_version !== 'string' || !doc.schema_version || !doc.domains || typeof doc.domains !== 'object' || Array.isArray(doc.domains)) {
		throw new Error('Invalid snapshot document');
	}
	// Older schemas lack included_domains. Object keys are not an inclusion
	// contract (omitted/null payloads can be meaningful), so report unknown.
	const dependencies = Array.isArray(doc.recovery_dependencies) && doc.recovery_dependencies.every(d =>
		d && typeof d === 'object' && typeof d.type === 'string' && typeof d.required === 'boolean',
	) ? doc.recovery_dependencies.map(d => ({type: d.type as string, required: d.required as boolean})) : null;
	return {schema:doc.schema_version, included:names(doc.included_domains), excluded:names(doc.excluded_domains), dependencies};
}
