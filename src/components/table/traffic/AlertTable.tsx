//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { getStableHash } from 'common';
import DataTable from 'components/table/DataTable';
import { IDataTableColumnDef } from 'types/global';
import { IAlert } from 'types/alerts';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export interface IAlertData {
	alerts: IAlert[];
}

export default function AlertTable(props: {
	data: IAlertData;
	selected_rows: number[];
	onChangeSelectedRows: any;
	onResolve: any;
	onDelete?: any;
	onRefresh?: any;
}) {
	const { data, selected_rows, onChangeSelectedRows, onResolve, onDelete, onRefresh } = props;

	const cols: IDataTableColumnDef[] = [
		{ data_key: 'alertId', header: 'Raw_ID', width: 'narrow' },
		{ data_key: 'severity', header: 'Severity', width: 'narrow' },
		{ data_key: 'status', header: 'Status', width: 'narrow' },
		{ data_key: 'rule_name', header: 'Rule Name', width: 'wide' },
		{ data_key: 'metric_name', header: 'Metric', width: 'wide' },
		{ data_key: 'message', header: 'Message', width: 'super_wide' },
		{ data_key: 'triggered_at', header: 'Triggered At', width: 'wide' },
		{ data_key: 'resolved_at', header: 'Resolved At', width: 'wide' },
	];

	// Hash function for alert (using id as primary key)
	const getHashKey = (item: IAlert) => {
		const str = `${item.id || ''}_${item.rule_name || ''}_${item.triggered_at || ''}`;
		return getStableHash(str);
	};

	// Generate rows and sort by triggered_at (most recent first)
	const rows = data.alerts
		? (() => {
				const sorted = [...data.alerts].sort((a, b) => {
					// Sort by triggered_at descending (most recent first)
					const aTime = a.triggered_at || 0;
					const bTime = b.triggered_at || 0;
					return bTime - aTime;
				});
				return sorted.map((item, index) => {
					const hashKey = getHashKey(item);
					
					// Format timestamps
					const triggeredAt = item.triggered_at 
						? new Date(item.triggered_at * 1000).toLocaleString()
						: '-';
					const resolvedAt = item.resolved_at 
						? new Date(item.resolved_at * 1000).toLocaleString()
						: '-';

					// Truncate long messages
					const message = item.message && item.message.length > 100
						? item.message.substring(0, 100) + '...'
						: item.message || '';

					// Show full ID in the ID column
					const displayId = item.id || '';

					return {
						id: index,  // Row identifier for DataTable
						alertId: displayId,  // Full alert ID
						severity: item.severity || '',
						status: item.status || '',
						rule_name: item.rule_name || '',
						metric_name: item.metric_name || '',
						message: message,
						triggered_at: triggeredAt,
						resolved_at: resolvedAt,
						// Unique key for sorting and selection
						_uniqueKey: hashKey,
					};
				});
		  })()
		: [];

	return (
		<DataTable
			name={'Alerts'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onEdit={onResolve}
			onDelete={onDelete}
			onRefresh={onRefresh}
		/>
	);
}