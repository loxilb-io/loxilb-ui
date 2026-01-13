//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_size_str, formatRate, getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {useInstanceName} from 'hooks/query/instanceHook';
import {t} from 'i18next';
import {IDataTableColumnDef} from 'types/global';
import {IPolicyConfiguration} from 'types/qos';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function QoSTable(props: {data: IPolicyConfiguration; selected_rows: number[]; onChangeSelectedRows: any; onAdd?: any; onDelete?: any; onRefresh?: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh} = props;

	const inst_name = useInstanceName();

	const cols: IDataTableColumnDef[] = [
		{data_key: 'policyIdent', header: 'Name'},
		{data_key: 'type', header: 'Type', width: 'medium', tooltip: 'Qos Type (0-TrTCM, 1-SrTCM)'},
		{data_key: 'attachment', header: 'Attachment', width: 'wide', type: 'link', tooltip: 'Target Attachment(0-LB Rule Name, 1-Port Name)'},
		{data_key: 'rate', header: `${t('Info Rate')}\n${t('(Committed / Peak)')}`, type: 'multi-line', align: 'right', width: 'super_wide'},
		{data_key: 'blocksize', header: `${t('Block Size')}\n${t('(Committed / Excess)')}`, type: 'multi-line', align: 'right', width: 'super_wide'},
		{data_key: 'colorAware', header: 'Color Aware', align: 'right'},
	];

   // Hash function for QoS policy
   const getHashKey = (item: any) => {
	   const str = `${item.policyIdent || ''}_${item.policyInfo.type || ''}_${item.targetObject.attachment || ''}_${item.targetObject.polObjName || ''}`;
	   return getStableHash(str);
   };

   const rows = data.polAttr
	   ? (() => {
		   const sorted = [...data.polAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map((item, index) => {
			   return {
				   id: index,
				   policyIdent: item.policyIdent,
				   type: item.policyInfo.type,
				   rate: `${formatRate(item.policyInfo.committedInfoRate, 'bps')} / ${formatRate(item.policyInfo.peakInfoRate, 'bps')}`,
				   blocksize: `${get_size_str(item.policyInfo.committedBlkSize)} / ${get_size_str(item.policyInfo.excessBlkSize)}`,
				   attachment: {
					   data: `${item.targetObject.attachment}(${item.targetObject.polObjName})`,
					   url:
						   item.targetObject.attachment === 1
							   ? `/instance/network/port?name=${inst_name}&port=${item.targetObject.polObjName}`
							   : `/instance/traffic/lb?name=${inst_name}&rule=${item.targetObject.polObjName}`,
				   },
				   colorAware: item.policyInfo.colorAware ? 'True' : 'False',
				   _uniqueKey: getHashKey(item),
			   };
		   });
	   })()
	   : undefined;

	return <DataTable name={'QoS'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} onRefresh={onRefresh} hideCheckbox={true} />;
}
