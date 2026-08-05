//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash, formatBytes, formatNumberForAxis} from 'common';
import DataTable from 'components/table/DataTable';
import {useMemo} from 'react';
import {IIPFilterEntry} from 'types/security';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IPFilterTable(props: {
	data: IIPFilterEntry[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	onAdd?: any;
	onDelete?: any;
	onRefresh?: any;
	error?: boolean;
}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'filterType', header: 'Filter Type', width: 'medium', type: 'tag'},
		{data_key: 'cidr', header: 'CIDR', width: 'wide', type: 'mono'},
		{data_key: 'action', header: 'Action', width: 'narrow', type: 'tag'},
		{data_key: 'priority', header: 'Priority', width: 'narrow', align: 'right', type: 'mono', tooltip: 'Higher value = more important'},
		{data_key: 'zone', header: 'Zone', width: 'narrow', align: 'right', type: 'mono', tooltip: '0 = all zones'},
		{data_key: 'packets', header: 'Packets', width: 'medium', align: 'right', type: 'mono', tooltip: 'Packet counter'},
		{data_key: 'bytes', header: 'Bytes', width: 'medium', align: 'right', type: 'mono', tooltip: 'Byte counter'},
	];

	// Hash function for IP filter rule
	const getHashKey = (item: IIPFilterEntry) => {
		const str = `${item.filterType}_${item.cidr}_${item.zone ?? 0}_${item.priority ?? 100}`;
		return getStableHash(str);
	};

	const rows = useMemo(() => {
		if (!data) return [];

		const sorted = [...data].sort((a, b) => getHashKey(a) - getHashKey(b));
		return sorted.map(item => ({
			id: getHashKey(item),
			filterType: item.filterType,
			cidr: item.cidr,
			action: item.action,
			priority: item.priority?.toString() ?? '100',
			zone: item.zone?.toString() ?? '0',
			packets: formatNumberForAxis(item.packets ?? 0),
			bytes: formatBytes(item.bytes ?? 0),
			_uniqueKey: getHashKey(item),
		}));
	}, [data]);

	return (
		<DataTable
			name={'IP Filter'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			onRefresh={onRefresh}
			error={error}
		/>
	);
}
