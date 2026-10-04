//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IJWTAuthProfileEntry, JWT_PROFILE_DEFAULTS} from 'types/ai_jwt';
import {PageDataState} from 'components/state/pageState';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function JWTAuthProfileTable(props: {
	data: IJWTAuthProfileEntry[];
	// Rule names per profile, so an operator sees what blocks a delete BEFORE
	// trying it rather than decoding a 409 afterwards.
	referencesByName: Readonly<Record<string, string[]>>;
	selected_rows: number[];
	onChangeSelectedRows: any;
	onAdd?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
	onRefresh?: () => void;
	state?: PageDataState<unknown>;
	error?: boolean;
}) {
	const {data, referencesByName, selected_rows, onChangeSelectedRows, onAdd, onEdit, onDelete, onRefresh, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'name', header: 'Name', width: 'medium', type: 'mono'},
		{data_key: 'issuer', header: 'Issuer', width: 'wide', type: 'mono'},
		{data_key: 'jwks', header: 'JWKS', width: 'medium', type: 'mono', tooltip: 'Explicit JWKS URL, or OIDC discovery from the issuer'},
		{data_key: 'audiences', header: 'Audiences', width: 'medium', type: 'mono', tooltip: 'Empty skips the audience check entirely'},
		{data_key: 'model_authz', header: 'Model authz', width: 'medium', tooltip: 'claims-required denies every model when none can be derived from the token'},
		{data_key: 'referenced_by', header: 'Referenced by', width: 'medium', tooltip: 'LB rules whose bearer arm resolves against this profile; a referenced profile cannot be deleted'},
	];

	const rows = data.map(item => {
		const refs = referencesByName[item.name ?? ''] ?? [];
		return {
			id: getStableHash(item.name ?? ''),
			name: item.name ?? '',
			issuer: item.issuer ?? '',
			// "Discovery" is the real behaviour when the field is blank, and
			// reads better than an empty cell that looks like missing data.
			jwks: item.jwks_url?.trim() ? item.jwks_url : t('OIDC discovery'),
			// An empty accept-list is not "none configured" — it disables the
			// check. Say that rather than leaving the cell blank.
			audiences: (item.audiences ?? []).length > 0 ? (item.audiences ?? []).join(', ') : t('Any (check skipped)'),
			model_authz: item.model_authz ?? JWT_PROFILE_DEFAULTS.model_authz,
			referenced_by: refs.length === 0 ? t('None') : refs.join(', '),
		};
	});

	return (
		<DataTable
			name={'JWT Auth Profiles'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onEdit={onEdit}
			onDelete={onDelete}
			onRefresh={onRefresh}
			state={state}
			error={error}
		/>
	);
}
