import {IFdbAttribute} from './fdb';

export type IdentifiedFdbEntry = {
	id: string;
	entry: IFdbAttribute;
};

/**
 * The Gateway may return duplicate FDB rows for the same device/MAC tuple.
 * DataGrid still requires every rendered row to have a unique identity, so
 * include the tuple occurrence while retaining a deterministic, opaque key.
 */
export function identifyFdbEntries(entries: IFdbAttribute[]): IdentifiedFdbEntry[] {
	const occurrences = new Map<string, number>();

	return entries.map(entry => {
		const tuple = JSON.stringify([entry.dev ?? '', entry.macAddress ?? '']);
		const occurrence = occurrences.get(tuple) ?? 0;
		occurrences.set(tuple, occurrence + 1);

		return {
			id: JSON.stringify([entry.dev ?? '', entry.macAddress ?? '', occurrence]),
			entry,
		};
	});
}
