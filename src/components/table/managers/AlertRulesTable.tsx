//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IAlertRule} from 'types/alerts';

//---------------------------------------------------------
// Interface
//---------------------------------------------------------
interface AlertRulesTableProps {
	data: {rules: IAlertRule[]};
	selected_rows: number[];
	onChangeSelectedRows: (indices: number[]) => void;
	onAdd: () => void;
	onDelete: () => void;
	onUpdate?: (ruleId: string, updateData: any) => void;
	onTest?: (ruleId: string, testData: any) => void;
	onToggleEnabled?: (ruleId: string, enabled: boolean) => void;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AlertRulesTable(props: AlertRulesTableProps) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		// {data_key: 'id', header: 'ID', width: 'narrow'},
		{data_key: 'name', header: 'Rule Name', width: 'wide'},
		{data_key: 'severity', header: 'Severity', width: 'medium'},
		{data_key: 'metric_name', header: 'Metric', width: 'wide'},
		{data_key: 'condition', header: 'Condition', width: 'medium'},
		{data_key: 'window', header: 'Window', width: 'narrow'},
		{data_key: 'status', header: 'Status', width: 'narrow'},
		{data_key: 'last_triggered', header: 'Last Triggered', width: 'medium'},
		{data_key: 'alert_count', header: 'Alert Count', width: 'medium'},
	];

	// Hash function for alert rule
	const getHashKey = (item: any) => {
		const str = `${item.id || ''}_${item.name || ''}_${item.metric_name || ''}`;
		return getStableHash(str);
	};

	// Generate rows and sort by hash key
	const rows = data.rules
		? (() => {
			const sorted = [...data.rules].sort((a, b) => getHashKey(a) - getHashKey(b));
			return sorted.map((item, index) => {
				const getOperatorSymbol = (operator: string): string => {
					switch (operator) {
						case 'greater_than': return '>';
						case 'less_than': return '<';
						case 'equals': return '=';
						case 'not_equals': return '≠';
						case 'greater_equal': return '≥';
						case 'less_equal': return '≤';
						default: return operator;
					}
				};

				return {
					id: index,
					name: item.name || `Rule ${index + 1}`,
					severity: item.severity?.toUpperCase() || 'INFO',
					metric_name: item.metric_name || 'cpu_usage',
					condition: `${getOperatorSymbol(item.condition || 'greater_than')} ${item.threshold || 0}`,
					window: item.duration ? `${item.duration}s` : '-',
					status: item.enabled ? 'Active' : 'Inactive',
					last_triggered: 'Never', // Simplified as not in interface
					alert_count: 0, // Simplified as not in interface
					_uniqueKey: getHashKey(item),
				};
			});
		})()
		: undefined;

	return (
		<DataTable
			name={'Alert Rules'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
		/>
	);
}