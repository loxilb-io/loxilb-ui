//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_size_str, get_speed_rate_str} from 'common';
import DataTable from 'components/table/DataTable';
import {useInstanceName} from 'hooks/query/instanceHook';
import {t} from 'i18next';
import {IDataTableColumnDef} from 'types/global';
import {IPolicyConfiguration} from 'types/qos';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function QoSTable(props: {data: IPolicyConfiguration; selected_rows: number[]; onChangeSelectedRows: any; onAdd?: any; onDelete?: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const inst_name = useInstanceName();

	const cols: IDataTableColumnDef[] = [
		{data_key: 'policyIdent', header: 'Name'},
		{data_key: 'type', header: 'Type', width: 'medium', tooltip: 'Type (The lower value, the higher the priority → 1 is the highest priority)'},
		{data_key: 'attachment', header: 'Attachment', width: 'wide', type: 'link', tooltip: 'The object or connection point (endpoint) to which the QoS policy is applied.'},
		{data_key: 'rate', header: `${t('Info Rate')}\n${t('(Committed / Peak)')}`, type: 'multi-line', align: 'right', width: 'super_wide'},
		{data_key: 'blocksize', header: `${t('Block Size')}\n${t('(Committed / Excess)')}`, type: 'multi-line', align: 'right', width: 'super_wide'},
		{data_key: 'colorAware', header: 'Color Aware', align: 'right'},
	];

	const rows = data.polAttr.map((item, index) => {
		return {
			id: index,
			policyIdent: item.policyIdent,
			type: item.policyInfo.type,
			rate: `${get_speed_rate_str(item.policyInfo.committedInfoRate)} / ${get_speed_rate_str(item.policyInfo.peakInfoRate)}`,
			blocksize: `${get_size_str(item.policyInfo.committedBlkSize)} / ${get_size_str(item.policyInfo.excessBlkSize)}`,
			attachment: {
				data: `${item.targetObject.attachment}(${item.targetObject.polObjName})`,
				url:
					item.targetObject.attachment === 1
						? `/instance/network/port?name=${inst_name}&port=${item.targetObject.polObjName}`
						: `/instance/traffic/lb?name=${inst_name}&rule=${item.targetObject.polObjName}`,
			},
			colorAware: item.policyInfo.colorAware ? 'True' : 'False',
		};
	});

	return <DataTable name={'QoS'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />;
}
