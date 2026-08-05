//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IIPsecCACertificate, IIPsecCertificate} from 'types/ipsec';

//---------------------------------------------------------
// Helpers
//---------------------------------------------------------
const EXPIRY_WARN_DAYS = 30;

export function expiryStatus(notAfter?: string): string {
	if (!notAfter) return '';
	const expiry = Date.parse(notAfter);
	if (isNaN(expiry)) return '';
	const daysLeft = (expiry - Date.now()) / (24 * 3600 * 1000);
	if (daysLeft < 0) return 'EXPIRED';
	if (daysLeft < EXPIRY_WARN_DAYS) return `EXPIRES IN ${Math.ceil(daysLeft)}d`;
	return 'VALID';
}

//---------------------------------------------------------
// Functional Components
//---------------------------------------------------------
export function IPsecCertTable(props: {
	data: IIPsecCertificate[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	onAdd?: () => void;
	onDelete?: () => void;
	onRefresh?: () => void;
	error?: boolean;
}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'name', header: 'Name', width: 'medium'},
		{data_key: 'subject', header: 'Subject', width: 'wide'},
		{data_key: 'issuer', header: 'Issuer', width: 'wide'},
		{data_key: 'status', header: 'Status', tooltip: `Warns ${EXPIRY_WARN_DAYS} days before expiry`},
		{data_key: 'notAfter', header: 'Expires', width: 'medium', type: 'mono'},
		{data_key: 'description', header: 'Description', width: 'medium'},
	];

	const rows = data.map((item, index) => ({
		id: index,
		name: item.name ?? '',
		subject: item.subject ?? '',
		issuer: item.issuer ?? '',
		status: expiryStatus(item.notAfter),
		notAfter: item.notAfter ?? '',
		description: item.description ?? '',
	}));

	return (
		<DataTable
			name={'IPsec Certificates'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			onRefresh={onRefresh}
			error={error}
			hideCheckbox={true}
		/>
	);
}

export function IPsecCACertTable(props: {
	data: IIPsecCACertificate[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	onAdd?: () => void;
	onDelete?: () => void;
	onRefresh?: () => void;
	error?: boolean;
}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'name', header: 'Name', width: 'medium'},
		{data_key: 'subject', header: 'Subject', width: 'wide'},
		{data_key: 'status', header: 'Status', tooltip: `Warns ${EXPIRY_WARN_DAYS} days before expiry`},
		{data_key: 'notAfter', header: 'Expires', width: 'medium', type: 'mono'},
		{data_key: 'description', header: 'Description', width: 'medium'},
	];

	const rows = data.map((item, index) => ({
		id: index,
		name: item.name ?? '',
		subject: item.subject ?? '',
		status: expiryStatus(item.notAfter),
		notAfter: item.notAfter ?? '',
		description: item.description ?? '',
	}));

	return (
		<DataTable
			name={'CA Certificates'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			onRefresh={onRefresh}
			error={error}
			hideCheckbox={true}
		/>
	);
}
