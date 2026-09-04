//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IModelProfileEntry} from 'types/ai_gateway';
import {PageDataState} from 'components/state/pageState';

/** Display form of an artifact digest: enough hex to eyeball, full value in the detail panel. */
export function shortDigest(digest?: string): string {
	if (!digest) return '';
	return digest.length > 12 ? `${digest.slice(0, 12)}…` : digest;
}

//---------------------------------------------------------
// Functional Component
//
// READ-ONLY by requirement (AC-12): the published-profile inventory takes
// no onAdd/onDelete handlers — the registry is operator-published on the
// gateway and this UI must never offer a mutation affordance for it.
//---------------------------------------------------------
export default function ModelProfileTable(props: {
	data: IModelProfileEntry[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	onRefresh?: () => void;
	state?: PageDataState<unknown>;
}) {
	const {data, selected_rows, onChangeSelectedRows, onRefresh, state} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'profileId', header: 'Profile ID', width: 'medium', type: 'mono'},
		{data_key: 'baseModel', header: 'Base Model', width: 'wide', type: 'mono'},
		{data_key: 'aliases', header: 'Aliases', width: 'medium', type: 'mono', tooltip: 'Additional served model names admitted by the alias policy (empty = base model only)'},
		{data_key: 'apis', header: 'APIs', width: 'medium', tooltip: 'Request surfaces this profile serves'},
		{data_key: 'gen', header: 'Gen', align: 'right', type: 'mono', tooltip: 'Registry generation this profile was published at'},
		{data_key: 'tokenizer', header: 'Tokenizer', width: 'medium', type: 'mono', tooltip: 'sha256 of the pinned tokenizer artifact (short form; full digest in the detail panel)'},
		{data_key: 'template', header: 'Chat Template', tooltip: 'Whether a chat template artifact is bound to this profile'},
	];

	const rows = data.map(item => ({
		id: getStableHash(item.profileId ?? ''),
		profileId: item.profileId ?? '',
		baseModel: item.baseModel ?? '',
		aliases: (item.allowedAliases ?? []).join(', '),
		apis: (item.supportedApis ?? []).join(', '),
		gen: item.gen ?? 0,
		tokenizer: shortDigest(item.tokenizerSha256),
		template: item.templateSha256 ? 'Yes' : 'No',
	}));

	return (
		<DataTable
			name={'Published Model Profiles'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onRefresh={onRefresh}
			state={state}
		/>
	);
}
